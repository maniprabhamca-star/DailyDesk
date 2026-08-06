// Shared scan-cleanup engine. Two consumers:
//  - the Clean scanned PDF tool (preview + export)
//  - the Saved Workflows "Clean scanned" step
// Keeping the pixel maths and the render/rebuild loop here means the tool and
// the workflow step can never drift apart. Runs entirely on-device: pdf.js
// rasterises each page, we clean the pixels on a canvas, and pdf-lib rebuilds
// a PDF from the cleaned JPEGs.

import { openPdf, type PdfHandle } from '@/lib/pdf-render';

export type CleanMode = 'clean' | 'bw';

/** Long-edge raster target. Scanned pages stay readable well below print DPI;
 *  B&W keeps a touch more resolution so thin strokes survive the threshold. */
export const cleanTargetLong = (mode: CleanMode) => (mode === 'bw' ? 1650 : 1500);

/** Grey → contrast boost → (B&W threshold | slight lift). Mutates in place. */
export function applyCleanPixels(d: Uint8ClampedArray, mode: CleanMode, contrast: number): void {
  const boost = 1 + contrast / 60;
  for (let p = 0; p < d.length; p += 4) {
    const gray = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    let v = (gray - 128) * boost + 128;
    if (mode === 'bw') v = v > 178 ? 255 : 0;
    else v = Math.max(0, Math.min(255, v + 8));
    d[p] = v; d[p + 1] = v; d[p + 2] = v;
  }
}

/** Export-path renderer: render a pdf.js page STRAIGHT to a canvas, clean the
 * pixels, and encode ONE JPEG. Avoids the preview path's extra JPEG encode +
 * fetch + createImageBitmap decode per page (roughly halves the work), and
 * returns the page's point size so the output page matches the original. */
export async function renderCleanToJpeg(handle: PdfHandle, index: number, mode: CleanMode, contrast: number, targetLong: number) {
  const page = await handle.doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = targetLong / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas context.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyCleanPixels(imgData.data, mode, contrast);
  ctx.putImageData(imgData, 0, 0);
  const jpeg = await new Promise<ArrayBuffer>((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve) : reject(new Error('Could not encode page image.'))), 'image/jpeg', mode === 'bw' ? 0.85 : 0.88),
  );
  canvas.width = 0;
  canvas.height = 0;
  return { jpeg, w: base.width, h: base.height };
}

function abortError(): DOMException { return new DOMException('Cancelled', 'AbortError'); }

/** Clean every page of a scanned PDF and rebuild it. Pages are rendered a few
 *  at a time (pdf.js decode + JPEG encode overlap) but embedded in order, so
 *  peak memory stays at ~`conc` pages — safe for documents of any length. */
export async function cleanScanToPdf(
  file: File | Blob,
  opts: { mode: CleanMode; contrast: number; signal?: AbortSignal; onMsg?: (m: string) => void },
): Promise<Uint8Array> {
  const { mode, contrast, signal, onMsg } = opts;
  if (signal?.aborted) throw abortError();
  let handle: PdfHandle | null = null;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const out = await PDFDocument.create();
    handle = await openPdf(file);
    const total = handle.numPages;
    const targetLong = cleanTargetLong(mode);
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const conc = Math.max(2, Math.min(4, cores));
    let processed = 0;
    for (let start = 0; start < total; start += conc) {
      if (signal?.aborted) throw abortError();
      const batch: number[] = [];
      for (let i = start; i < Math.min(start + conc, total); i++) batch.push(i);
      const results = await Promise.all(batch.map((i) => renderCleanToJpeg(handle as PdfHandle, i, mode, contrast, targetLong)));
      for (const r of results) {
        const img = await out.embedJpg(r.jpeg);
        const page = out.addPage([r.w, r.h]);
        page.drawImage(img, { x: 0, y: 0, width: r.w, height: r.h });
        processed++;
      }
      onMsg?.(`Cleaning page ${Math.min(processed, total)} of ${total}`);
    }
    return await out.save();
  } finally {
    if (handle) void handle.destroy();
  }
}
