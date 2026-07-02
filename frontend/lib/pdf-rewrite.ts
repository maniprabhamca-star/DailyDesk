// Main-thread entry for PDF rewrites (rotate/delete). Prefers the Web Worker —
// the page stays fully responsive while pdf-lib crunches (critical for 100MB+
// files, which used to freeze the tab for minutes) — and falls back to an
// inline rewrite when workers are unavailable (never a dead end).
import type { RewriteOp } from './pdf-rewrite.worker';

export type { RewriteOp };

function runInWorker(buffer: ArrayBuffer, op: RewriteOp): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./pdf-rewrite.worker.ts', import.meta.url));
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; bytes?: Uint8Array; error?: string }>) => {
      worker.terminate();
      if (e.data.ok && e.data.bytes) resolve(e.data.bytes);
      else reject(new Error(e.data.error || 'Could not rewrite the PDF.'));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('worker-failed'));
    };
    worker.postMessage({ buffer, op }, [buffer]); // transfer, zero-copy
  });
}

async function runInline(buffer: ArrayBuffer, op: RewriteOp): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  if (op.type === 'rotate') {
    const pages = doc.getPages();
    op.deltas.forEach((d, i) => {
      if (!d || !pages[i]) return;
      const cur = pages[i].getRotation().angle || 0;
      pages[i].setRotation(degrees((((cur + d) % 360) + 360) % 360));
    });
  } else if (op.type === 'delete') {
    [...op.indices].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
  } else {
    const dest = await PDFDocument.create();
    const copied = await dest.copyPages(doc, op.order);
    copied.forEach((p) => dest.addPage(p));
    return dest.save();
  }
  return doc.save();
}

export async function rewritePdf(src: File | Blob, op: RewriteOp): Promise<Uint8Array> {
  try {
    // The buffer is TRANSFERRED to the worker (detached here) — on any worker
    // failure we re-read the file for the inline fallback.
    return await runInWorker(await src.arrayBuffer(), op);
  } catch {
    return runInline(await src.arrayBuffer(), op);
  }
}
