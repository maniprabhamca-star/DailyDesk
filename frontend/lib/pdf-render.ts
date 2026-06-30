// Shared, cancellable, cached pdf.js page renderer used by the multi-page preview
// strip, the big page preview, and the before/after viewer. Open a PDF ONCE per
// loaded file (openPdf) and reuse the handle for every page render — far cheaper
// than re-opening per page. All rendering is DPR-aware (render well above display
// size, then let the browser/loupe downsample) for crisp text. Fully client-side.
//
// Note: pdf.js rendering needs the worker, which works in real browsers but hangs
// in the Claude preview sandbox — verify render output via the Node harness
// (scratchpad/pdfrender, disableWorker:true). See the pdfjs-render-harness memo.

import type { PDFDocumentProxy } from 'pdfjs-dist';

export type RenderedPage = { url: string; w: number; h: number };

export type PdfHandle = {
  numPages: number;
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
  // internal — render cache (page@long -> rendered blob url), bounded LRU
  _cache: Map<string, RenderedPage>;
};

const CACHE_CAP = 140; // bound memory: ~140 cached page bitmaps max per file

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((m) => {
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      return m;
    });
  }
  return pdfjsPromise;
}

// DPR-aware target long edge: render ~`mult`× the displayed CSS size (capped) so
// downsampling stays crisp and the loupe has real pixels to magnify.
export function dprTarget(cssLong: number, mult = 2.4, cap = 1800): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(cap, Math.round(cssLong * Math.max(mult, dpr)));
}

export async function openPdf(src: File | Blob): Promise<PdfHandle> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await src.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const cache = new Map<string, RenderedPage>();
  return {
    numPages: doc.numPages,
    doc,
    _cache: cache,
    destroy: async () => {
      cache.forEach((p) => URL.revokeObjectURL(p.url));
      cache.clear();
      try { await task.destroy(); } catch { /* already gone */ }
    },
  };
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

  const task = page.render({ canvasContext: cx, viewport, background: 'rgba(255,255,255,1)' });
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
