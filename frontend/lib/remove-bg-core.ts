// Shared inference core for on-device background removal. Model = ISNet
// (`isnet-general-use`, Apache-2.0, github.com/xuebinqin/DIS) dynamically
// quantized to QUInt8 (~43MB) so the one-time download stays reasonable.
// Runs on onnxruntime-web (MIT): WebGPU when available, WASM everywhere else.
//
// This file is imported by BOTH lib/remove-bg.worker.ts (the normal path)
// and the main-thread fallback in lib/remove-bg.ts, so the logic exists once.
// QA: dev-harness + scratchpad bg-qa (onnxruntime-node) compare the quantized
// matte against fp32 and gate on subject/background separation.

export const BG_MODEL_URL = '/models/isnet-quint8.onnx';
export const BG_SIDE = 1024; // ISNet input resolution (squash-resized, like rembg)

// Minimal structural type so the core works with onnxruntime-web in the
// browser AND onnxruntime-node in the QA harness.
type OrtModule = {
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create(data: Uint8Array | string, opts?: unknown): Promise<OrtSession>;
  };
  env?: { wasm?: { wasmPaths?: string; numThreads?: number } };
};
type OrtSession = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
};

export async function fetchModelBytes(url: string, onPct?: (pct: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model download failed (${res.status})`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const buf = new Uint8Array(total);
  let off = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf.set(value, off);
    off += value.length;
    onPct?.(Math.round((off / total) * 100));
  }
  return buf.subarray(0, off);
}

export async function createBgSession(ort: OrtModule, modelBytes: Uint8Array): Promise<OrtSession> {
  if (ort.env?.wasm) {
    ort.env.wasm.wasmPaths = '/ort/';
    // Multi-threading needs crossOriginIsolated (COOP/COEP) — we don't set
    // those headers, so stay single-threaded rather than let ort try+warn.
    ort.env.wasm.numThreads = 1;
  }
  try {
    return await ort.InferenceSession.create(modelBytes, { executionProviders: ['webgpu', 'wasm'] });
  } catch {
    return await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
  }
}

// data = Float32 CHW [1,3,1024,1024], values (x/255 - 0.5) — ISNet/rembg norm.
// Returns the min-max-normalized alpha matte as 0-255 bytes (1024*1024).
export async function runBgMatte(ort: OrtModule, session: OrtSession, data: Float32Array): Promise<Uint8ClampedArray> {
  const input = new ort.Tensor('float32', data, [1, 3, BG_SIDE, BG_SIDE]);
  const out = await session.run({ [session.inputNames[0]]: input });
  const matte = out[session.outputNames[0]].data;
  let mi = Infinity, ma = -Infinity;
  for (let i = 0; i < matte.length; i++) {
    const v = matte[i];
    if (v < mi) mi = v;
    if (v > ma) ma = v;
  }
  const range = ma - mi || 1;
  const alpha = new Uint8ClampedArray(matte.length);
  for (let i = 0; i < matte.length; i++) alpha[i] = ((matte[i] - mi) / range) * 255;
  return alpha;
}
