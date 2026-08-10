import { getPdfjs, pdfDocOptions } from './pdf-render';

// Page one of a PDF, as a PNG blob URL.
//
// Kept in its own module so the grid can import it lazily — a folder with no
// PDFs in it should never pay for pdf.js.
//
// ⚠️ THE TRAP: `page.render()` without `intent: 'print'` paces itself on
// requestAnimationFrame, which never fires in a backgrounded tab, and the
// promise then hangs forever. A grid renders many PDFs while someone flicks to
// another tab, so this is not a hypothetical here — it is the single most likely
// way this tool dies. See [[dailydesk-render-handle-bloburl-gotcha]].

export async function renderFirstPage(file: File, maxLong = 420): Promise<string> {
  const pdfjs = await getPdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument(pdfDocOptions(bytes));
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxLong / Math.max(base.width, base.height), 2);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      // Non-negotiable — see the note above.
      intent: 'print',
    } as unknown as Parameters<typeof page.render>[0]).promise;

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    canvas.width = 0; canvas.height = 0; // release the backing store promptly
    if (!blob) throw new Error('could not encode the page');
    return URL.createObjectURL(blob);
  } finally {
    // destroy() invalidates anything still referencing the document, so it runs
    // only after the bitmap is safely a blob.
    await task.destroy().catch(() => {});
  }
}
