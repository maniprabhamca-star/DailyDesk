// "Lock pages as images" mode for Flatten PDF: render every page with pdf.js at
// a chosen DPI, re-encode with mozjpeg (the same encoder every raster output in
// the app uses), and rebuild a PDF whose pages are those images at the ORIGINAL
// page size in points — so the file prints at the same physical dimensions.
// Text becomes pixels: nothing is selectable, copyable, or editable afterwards.
// Runs fully in the browser; yields between pages so the tab never freezes and
// keeps working in background tabs (MessageChannel, not timers).
import { PDFDocument } from 'pdf-lib';
import { getPdfjs, pdfDocOptions, yieldToLoop } from './pdf-render';
import { encodeJpeg } from './mozjpeg';
import { RASTER_PRESETS, type RasterPreset } from './raster-presets';

export type { RasterPreset };

const MAX_DIM = 5000; // hard clamp on the long edge — huge pages degrade gracefully

export async function rasterizePdf(
  src: File | Blob,
  preset: RasterPreset,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { dpi, quality } = RASTER_PRESETS[preset];
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await src.arrayBuffer());
  const task = pdfjs.getDocument(pdfDocOptions(data));
  const doc = await task.promise;
  try {
    const out = await PDFDocument.create();
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      // scale 1 = 72 DPI; the base viewport already folds in the page /Rotate,
      // so the output page keeps the orientation the reader actually sees.
      const base = page.getViewport({ scale: 1 });
      const long = Math.max(base.width, base.height);
      const scale = Math.min(dpi / 72, MAX_DIM / long);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const cx = canvas.getContext('2d');
      if (!cx) throw new Error('no 2d context');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      // intent:'print' renders annotation/field appearances too and never waits
      // on requestAnimationFrame (which stops firing in background tabs).
      await page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;

      const jpg = await encodeJpeg(cx.getImageData(0, 0, canvas.width, canvas.height), quality);
      canvas.width = 0; canvas.height = 0; // free the bitmap right away
      const embedded = await out.embedJpg(await jpg.arrayBuffer());
      const p = out.addPage([base.width, base.height]);
      p.drawImage(embedded, { x: 0, y: 0, width: base.width, height: base.height });

      page.cleanup();
      onProgress?.(i, doc.numPages);
      await yieldToLoop();
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    try { await task.destroy(); } catch { /* already gone */ }
  }
}
