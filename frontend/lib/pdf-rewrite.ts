// Main-thread entry for PDF rewrites (rotate/delete/reorder/merge/split/
// page-numbers/watermark). Prefers the Web Worker — the page stays fully
// responsive while pdf-lib crunches (critical for 100MB+ files, which used to
// freeze the tab for minutes) — and falls back to an inline run of the SAME
// op core when workers are unavailable (never a dead end).
import type { RewriteOp, PageNumberOpts, WatermarkOpts } from './pdf-rewrite-core';

export type { RewriteOp, PageNumberOpts, WatermarkOpts };

function opExtraTransfers(op: RewriteOp): ArrayBuffer[] {
  if (op.type === 'watermark') {
    const t: ArrayBuffer[] = [];
    if (op.opts.fontBytes) t.push(op.opts.fontBytes);
    if (op.opts.imageBytes) t.push(op.opts.imageBytes);
    return t;
  }
  if (op.type === 'place-image') return [op.opts.imageBytes];
  return [];
}

function runInWorker(buffers: ArrayBuffer[], op: RewriteOp): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./pdf-rewrite.worker.ts', import.meta.url));
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; list?: Uint8Array[]; error?: string }>) => {
      worker.terminate();
      if (e.data.ok && e.data.list) resolve(e.data.list);
      else reject(new Error(e.data.error || 'Could not rewrite the PDF.'));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('worker-failed'));
    };
    worker.postMessage({ buffers, op }, [...buffers, ...opExtraTransfers(op)]); // transfer, zero-copy
  });
}

async function run(srcs: (File | Blob)[], op: RewriteOp): Promise<Uint8Array[]> {
  // Buffers (and any font/image bytes inside the op) are TRANSFERRED to the
  // worker — detached here. Snapshot copies of the op extras up front so the
  // inline fallback still has them; file buffers are simply re-read.
  let fallbackOp = op;
  if (op.type === 'watermark' && (op.opts.fontBytes || op.opts.imageBytes)) {
    fallbackOp = { ...op, opts: { ...op.opts, fontBytes: op.opts.fontBytes?.slice(0), imageBytes: op.opts.imageBytes?.slice(0) } };
  } else if (op.type === 'place-image') {
    fallbackOp = { ...op, opts: { ...op.opts, imageBytes: op.opts.imageBytes.slice(0) } };
  }
  try {
    return await runInWorker(await Promise.all(srcs.map((s) => s.arrayBuffer())), op);
  } catch {
    const { executeRewrite } = await import('./pdf-rewrite-core');
    return executeRewrite(await Promise.all(srcs.map((s) => s.arrayBuffer())), fallbackOp);
  }
}

/** Single-input, single-output rewrites (rotate/delete/reorder/extract/
 * page-numbers/watermark). */
export async function rewritePdf(src: File | Blob, op: RewriteOp): Promise<Uint8Array> {
  return (await run([src], op))[0];
}

/** Merge several PDFs into one, in the given order. */
export async function mergePdfs(srcs: (File | Blob)[]): Promise<Uint8Array> {
  return (await run(srcs, { type: 'merge' }))[0];
}

/** Split into many PDFs: one per page, or one per chunk of `every` pages. */
export async function splitPdf(src: File | Blob, op: { type: 'split-each' } | { type: 'split-chunks'; every: number }): Promise<Uint8Array[]> {
  return run([src], op);
}
