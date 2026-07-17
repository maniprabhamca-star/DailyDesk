// Shared, cancellable, cached pdf.js page renderer used by every PDF preview in
// the app: the thumbnail grids (Rotate / Delete pages), the multi-page preview
// strip, the big page preview, and the before/after viewer. Open a PDF ONCE per
// loaded file (openPdf) and reuse the handle for every page render — far cheaper
// than re-opening per page. All rendering is DPR-aware (render well above display
// size, then let the browser/loupe downsample) for crisp text. Fully client-side.
//
// pdf.js v6 decodes JPEG 2000 (JPXDecode) and JBIG2 images with WASM decoders —
// ~16× faster than the old v3 JavaScript path (measured: 216ms vs 3463ms per page
// on a real 27MB JPX-scanned book). The WASM/cmap/font assets live under
// /public/pdfjs/ and are fetched on demand only.
//
// Note: pdf.js rendering needs the worker, which works in real browsers but hangs
// in the Claude preview sandbox — verify render output via the Node harness
// (scratchpad, disableWorker) per the pdfjs-render-harness memo.

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type RenderedPage = { url: string; w: number; h: number };

export type PdfHandle = {
  numPages: number;
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
  // internal — render cache (page@long -> rendered blob url), bounded LRU
  _cache: Map<string, RenderedPage>;
  // internal — set on destroy so queued background prefetch jobs skip cleanly
  _dead?: boolean;
};

const CACHE_CAP = 140; // bound memory: ~140 cached page bitmaps max per file

// Static assets copied from pdfjs-dist into /public (worker at /pdf.worker.min.mjs,
// the rest under /public/pdfjs/). All are lazily fetched by pdf.js when needed.
const ASSETS = '/pdfjs/';

/** getDocument() options every tool should use — wires up the WASM image decoders
 * (JPEG 2000/JBIG2), ICC color, CJK cmaps, and standard fonts.
 * `password` decrypts protected PDFs ON THIS DEVICE — it is passed straight to
 * pdf.js in the tab and never sent anywhere. Bank e-statements are protected by
 * default, so every tool that opens PDFs needs this path. */
export function pdfDocOptions(data: Uint8Array, password?: string) {
  return {
    data,
    ...(password ? { password } : {}),
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
  };
}

/** Why did opening fail? Lets a tool show an inline password prompt instead of a
 * dead end. pdf.js PasswordResponses: NEED_PASSWORD = 1, INCORRECT_PASSWORD = 2. */
export function passwordErrorKind(err: unknown): 'need' | 'wrong' | null {
  const e = err as { name?: string; code?: number; message?: string } | null;
  if (!e) return null;
  const isPwd = e.name === 'PasswordException' || /password/i.test(e.message || '');
  if (!isPwd) return null;
  return e.code === 2 || /incorrect/i.test(e.message || '') ? 'wrong' : 'need';
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
export async function getPdfjs() {
  if (!pdfjsPromise) {
    // Legacy build = widest browser support; the .mjs worker loads as a module
    // worker (pdf.js falls back to a main-thread "fake worker" where unsupported,
    // so no browser dead-ends — just slower there).
    pdfjsPromise = (import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<typeof import('pdfjs-dist')>).then((m) => {
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return m;
    });
  }
  return pdfjsPromise;
}

/** Yield to the event loop WITHOUT setTimeout — background tabs throttle timers
 * to ~1s/tick, which would make long jobs (compress, convert) crawl the moment
 * the user switches tabs. MessageChannel tasks aren't throttled, and still let
 * pending input/paint run when the tab is visible. */
export function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => { mc.port1.close(); resolve(); };
    mc.port2.postMessage(0);
  });
}

// DPR-aware target long edge: render ~`mult`× the displayed CSS size (capped) so
// downsampling stays crisp and the loupe has real pixels to magnify.
export function dprTarget(cssLong: number, mult = 2.4, cap = 1800): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(cap, Math.round(cssLong * Math.max(mult, dpr)));
}

/** Open a PDF once per loaded file and reuse the handle for every page render.
 * `password` unlocks protected PDFs locally; on failure the caller can use
 * passwordErrorKind() to prompt for it and retry. */
export async function openPdf(src: File | Blob, password?: string): Promise<PdfHandle> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await src.arrayBuffer());
  const task = pdfjs.getDocument(pdfDocOptions(data, password));
  const doc = await task.promise;
  const cache = new Map<string, RenderedPage>();
  const handle: PdfHandle = {
    numPages: doc.numPages,
    doc,
    _cache: cache,
    destroy: async () => {
      handle._dead = true;
      cache.forEach((p) => URL.revokeObjectURL(p.url));
      cache.clear();
      try { await task.destroy(); } catch { /* already gone */ }
    },
  };
  return handle;
}

// Render a single page (0-based index) to a JPEG blob URL at the given long edge.
// Cached by page+size; honours an AbortSignal (cancels the in-flight render when
// the user switches pages). Throws on abort so callers can ignore stale renders.
export async function renderPage(
  handle: PdfHandle,
  index: number,
  targetLong: number,
  signal?: AbortSignal,
): Promise<RenderedPage> {
  const key = `${index}@${targetLong}`;
  const hit = handle._cache.get(key);
  if (hit) {
    // refresh LRU position
    handle._cache.delete(key);
    handle._cache.set(key, hit);
    return hit;
  }
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');

  const page = await handle.doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = targetLong / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('no 2d context');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, canvas.width, canvas.height);

  // intent:'print' renders straight through (no requestAnimationFrame pacing) —
  // rAF never fires in hidden/background tabs, which would freeze previews and
  // long jobs the moment the user switches tabs. Print intent keeps work moving.
  const task = page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' });
  const onAbort = () => task.cancel();
  signal?.addEventListener('abort', onAbort);
  try {
    await task.promise;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted) { canvas.width = 0; canvas.height = 0; throw new DOMException('aborted', 'AbortError'); }

  const url = await new Promise<string>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92),
  );
  const out: RenderedPage = { url, w: canvas.width, h: canvas.height };
  canvas.width = 0; canvas.height = 0;

  handle._cache.set(key, out);
  if (handle._cache.size > CACHE_CAP) {
    const oldest = handle._cache.keys().next().value as string | undefined;
    if (oldest) {
      const evicted = handle._cache.get(oldest);
      handle._cache.delete(oldest);
      if (evicted) URL.revokeObjectURL(evicted.url);
    }
  }
  return out;
}

// ---- Lazy thumbnails (shared by every page grid / strip) --------------------
// A page-wide LIFO queue with small concurrency: tiles enqueue themselves when
// they (nearly) scroll into view, newest first — so what the user is looking at
// renders first, and a 1000-page document costs nothing until it's scrolled.

const thumbQueue: Array<() => Promise<void>> = [];
let thumbActive = 0;
const THUMB_CONCURRENCY = 3;

function pumpThumbs() {
  while (thumbActive < THUMB_CONCURRENCY && thumbQueue.length > 0) {
    const job = thumbQueue.pop()!; // LIFO: most recently visible first
    thumbActive++;
    void job().finally(() => {
      thumbActive--;
      pumpThumbs();
    });
  }
}

// Render the first rows without waiting for the IntersectionObserver — they're
// visible anyway, and IO delivery can lag (it only fires on rendering frames).
const EAGER_PAGES = 8;

/** Warm the thumbnail cache in the background so scrolling never hits a spinner.
 * Jobs go to the FRONT of the LIFO queue = lowest priority: anything the user
 * actually scrolls to (pushed later, popped first) always renders ahead of the
 * prefetch. Bounded by the LRU cache cap, and kept modest on weak devices. */
export function prefetchPageThumbs(handle: PdfHandle, cssLong = 150) {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const limit = Math.min(handle.numPages, cores <= 2 ? 24 : CACHE_CAP);
  const target = dprTarget(cssLong, 2.2, 340);
  // Unshift ascending so the queue drains ascending (pop takes from the end:
  // after unshift(0), unshift(1)… the array is [L-1, …, 1, 0] and pops page 0 first).
  for (let i = 0; i < limit; i++) {
    const idx = i;
    thumbQueue.unshift(async () => {
      if (handle._dead) return;
      try { await renderPage(handle, idx, target); } catch { /* tile retries via IO if visible */ }
    });
  }
  pumpThumbs();
}

/** Lazily render page `index`'s thumbnail once the returned ref's element nears
 * the viewport (first EAGER_PAGES render immediately). Returns a blob URL when
 * ready (cached per handle, LRU-bounded). */
export function useLazyPageThumb<T extends Element>(
  handle: PdfHandle | null,
  index: number,
  cssLong = 150,
): { ref: React.RefObject<T>; url: string | null; failed: boolean } {
  const ref = useRef<T>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    const el = ref.current;
    if (!handle || !el) return;
    let cancelled = false;
    const enqueue = () => {
      thumbQueue.push(async () => {
        if (cancelled) return;
        try {
          const p = await renderPage(handle, index, dprTarget(cssLong, 2.2, 340));
          if (!cancelled) setUrl(p.url);
        } catch {
          if (!cancelled) setFailed(true);
        }
      });
      pumpThumbs();
    };
    if (index < EAGER_PAGES) {
      enqueue();
      return () => { cancelled = true; };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        enqueue();
      },
      { rootMargin: '500px' },
    );
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [handle, index, cssLong]);

  return { ref, url, failed };
}
