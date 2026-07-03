// On-device background removal — public API for the tool component.
//
// Pipeline (never-hang mandate: the heavy inference runs in a module worker;
// canvas pre/post-processing on the main thread is tens of ms):
//   decode → squash-resize to 1024² → normalized Float32 CHW tensor
//   → worker (ISNet via onnxruntime-web, WebGPU→WASM) → 1024² alpha matte
//   → matte upscaled to the original size (canvas high-quality smoothing)
//   → alpha-composited onto the original pixels → transparent PNG.
//
// Fallback chain per the cross-browser rule: classic worker (/bg-worker.js,
// no bundler contact — ort's ESM bundle breaks webpack worker chunks via
// import.meta) → main-thread inference via the same UMD loaded with a script
// tag (blocks longer but always completes).

import { decodeImage } from '@/lib/image-convert';
import { BG_MODEL_URL, BG_SIDE, createBgSession, fetchModelBytes, runBgMatte } from '@/lib/remove-bg-core';

export type BgStage = 'model' | 'init' | 'infer' | 'compose';
export type BgProgress = { stage: BgStage; pct: number };

let worker: Worker | null = null;
let workerBroken = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/bg-worker.js');
  }
  return worker;
}

// Main-thread fallback: load the UMD ort build once via script tag, keep the
// session cached. `window.ort` is set by /ort/ort.all.min.js.
type UmdOrt = Parameters<typeof createBgSession>[0];
let mainOrtPromise: Promise<{ ort: UmdOrt; session: Awaited<ReturnType<typeof createBgSession>> }> | null = null;

function loadOrtUmd(): Promise<UmdOrt> {
  const w = window as unknown as { ort?: UmdOrt };
  if (w.ort) return Promise.resolve(w.ort);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/ort/ort.all.min.js';
    s.onload = () => (w.ort ? res(w.ort) : rej(new Error('AI runtime failed to initialize')));
    s.onerror = () => rej(new Error('Could not load the AI runtime'));
    document.head.appendChild(s);
  });
}

async function inferOnMainThread(data: Float32Array, onProgress?: (p: BgProgress) => void): Promise<Uint8ClampedArray> {
  if (!mainOrtPromise) {
    mainOrtPromise = (async () => {
      const ort = await loadOrtUmd();
      const bytes = await fetchModelBytes(BG_MODEL_URL, (pct) => onProgress?.({ stage: 'model', pct }));
      onProgress?.({ stage: 'init', pct: 0 });
      const session = await createBgSession(ort, bytes);
      return { ort, session };
    })();
    mainOrtPromise.catch(() => { mainOrtPromise = null; });
  }
  const { ort, session } = await mainOrtPromise;
  onProgress?.({ stage: 'infer', pct: 0 });
  return runBgMatte(ort, session, data);
}

function inferInWorker(data: Float32Array, onProgress?: (p: BgProgress) => void): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    let w: Worker;
    try {
      w = getWorker();
    } catch (e) {
      workerBroken = true;
      reject(e);
      return;
    }
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === 'progress') onProgress?.({ stage: m.stage, pct: m.pct });
      else if (m?.type === 'matte') { cleanup(); resolve(m.alpha as Uint8ClampedArray); }
      else if (m?.type === 'error') { cleanup(); reject(new Error(m.message)); }
    };
    const onError = (e: ErrorEvent) => {
      // Worker failed to boot (e.g. module workers unsupported) — flag so the
      // caller falls back to main-thread inference.
      workerBroken = true;
      cleanup();
      reject(new Error(e.message || 'Worker failed'));
    };
    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ type: 'run', data }, [data.buffer]);
  });
}

export async function removeBackground(
  file: File | Blob,
  onProgress?: (p: BgProgress) => void,
): Promise<{ png: Blob; width: number; height: number; ms: number }> {
  const t0 = performance.now();
  const bm = await decodeImage(file);
  const W = bm.width, H = bm.height;

  // Preprocess: squash-resize (no letterbox — matches ISNet/rembg training).
  const c = document.createElement('canvas');
  c.width = BG_SIDE; c.height = BG_SIDE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bm, 0, 0, BG_SIDE, BG_SIDE);
  const px = ctx.getImageData(0, 0, BG_SIDE, BG_SIDE).data;
  const plane = BG_SIDE * BG_SIDE;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    data[i] = px[i * 4] / 255 - 0.5;
    data[plane + i] = px[i * 4 + 1] / 255 - 0.5;
    data[2 * plane + i] = px[i * 4 + 2] / 255 - 0.5;
  }

  let alpha: Uint8ClampedArray;
  if (workerBroken || typeof Worker === 'undefined') {
    alpha = await inferOnMainThread(data, onProgress);
  } else {
    try {
      alpha = await inferInWorker(data, onProgress);
    } catch {
      // One retry on the main thread — data buffer may have been transferred,
      // so rebuild it from the canvas we still hold.
      const px2 = ctx.getImageData(0, 0, BG_SIDE, BG_SIDE).data;
      const data2 = new Float32Array(3 * plane);
      for (let i = 0; i < plane; i++) {
        data2[i] = px2[i * 4] / 255 - 0.5;
        data2[plane + i] = px2[i * 4 + 1] / 255 - 0.5;
        data2[2 * plane + i] = px2[i * 4 + 2] / 255 - 0.5;
      }
      alpha = await inferOnMainThread(data2, onProgress);
    }
  }

  onProgress?.({ stage: 'compose', pct: 0 });

  // Matte 1024² → original size with high-quality smoothing.
  const mc = document.createElement('canvas');
  mc.width = BG_SIDE; mc.height = BG_SIDE;
  const mctx = mc.getContext('2d')!;
  const mid = mctx.createImageData(BG_SIDE, BG_SIDE);
  for (let i = 0; i < plane; i++) {
    const v = alpha[i];
    const o = i * 4;
    mid.data[o] = v; mid.data[o + 1] = v; mid.data[o + 2] = v; mid.data[o + 3] = 255;
  }
  mctx.putImageData(mid, 0, 0);
  const ms = document.createElement('canvas');
  ms.width = W; ms.height = H;
  const msctx = ms.getContext('2d', { willReadFrequently: true })!;
  msctx.imageSmoothingEnabled = true;
  msctx.imageSmoothingQuality = 'high';
  msctx.drawImage(mc, 0, 0, W, H);
  const matteBig = msctx.getImageData(0, 0, W, H).data;

  // Composite: original pixels, matte as alpha.
  const oc = document.createElement('canvas');
  oc.width = W; oc.height = H;
  const octx = oc.getContext('2d', { willReadFrequently: true })!;
  octx.drawImage(bm, 0, 0);
  bm.close();
  const img = octx.getImageData(0, 0, W, H);
  for (let i = 0, n = W * H; i < n; i++) img.data[i * 4 + 3] = matteBig[i * 4];
  octx.putImageData(img, 0, 0);
  const png: Blob = await new Promise((res, rej) =>
    oc.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'),
  );

  // Free the big canvases immediately (frugality rule).
  c.width = c.height = 0;
  mc.width = mc.height = 0;
  ms.width = ms.height = 0;
  oc.width = oc.height = 0;

  return { png, width: W, height: H, ms: Math.round(performance.now() - t0) };
}
