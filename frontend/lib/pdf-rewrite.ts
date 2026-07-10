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
  if (op.type === 'page-numbers') return op.opts.fontBytes ? [op.opts.fontBytes] : [];
  return [];
}

/** Thrown when a rewrite is cancelled via its AbortSignal. Callers can detect
 * it with `isCancel(e)` and quietly reset instead of showing an error. */
export function isCancel(e: unknown): boolean {
  return e instanceof DOMException ? e.name === 'AbortError' : (e as { name?: string })?.name === 'AbortError';
}
function abortError(): DOMException { return new DOMException('Cancelled', 'AbortError'); }

function runInWorker(buffers: ArrayBuffer[], op: RewriteOp, signal?: AbortSignal): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    let worker: Worker;
    try {
      worker = new Worker(new URL('./pdf-rewrite.worker.ts', import.meta.url));
    } catch (e) {
      reject(e);
      return;
    }
    let onAbort: (() => void) | null = null;
    const detach = () => { if (onAbort && signal) signal.removeEventListener('abort', onAbort); };
    worker.onmessage = (e: MessageEvent<{ ok: boolean; list?: Uint8Array[]; error?: string }>) => {
      detach();
      worker.terminate();
      if (e.data.ok && e.data.list) resolve(e.data.list);
      else reject(new Error(e.data.error || 'Could not rewrite the PDF.'));
    };
    worker.onerror = () => {
      detach();
      worker.terminate();
      reject(new Error('worker-failed'));
    };
    if (signal) {
      onAbort = () => { detach(); worker.terminate(); reject(abortError()); }; // kill the crunch immediately
      signal.addEventListener('abort', onAbort);
    }
    worker.postMessage({ buffers, op }, [...buffers, ...opExtraTransfers(op)]); // transfer, zero-copy
  });
}

async function run(srcs: (File | Blob)[], op: RewriteOp, signal?: AbortSignal): Promise<Uint8Array[]> {
  if (signal?.aborted) throw abortError();
  // Buffers (and any font/image bytes inside the op) are TRANSFERRED to the
  // worker — detached here. Snapshot copies of the op extras up front so the
  // inline fallback still has them; file buffers are simply re-read.
  let fallbackOp = op;
  if (op.type === 'watermark' && (op.opts.fontBytes || op.opts.imageBytes)) {
    fallbackOp = { ...op, opts: { ...op.opts, fontBytes: op.opts.fontBytes?.slice(0), imageBytes: op.opts.imageBytes?.slice(0) } };
  } else if (op.type === 'place-image') {
    fallbackOp = { ...op, opts: { ...op.opts, imageBytes: op.opts.imageBytes.slice(0) } };
  } else if (op.type === 'page-numbers' && op.opts.fontBytes) {
    fallbackOp = { ...op, opts: { ...op.opts, fontBytes: op.opts.fontBytes.slice(0) } };
  }
  try {
    return await runInWorker(await Promise.all(srcs.map((s) => s.arrayBuffer())), op, signal);
  } catch (e) {
    if (isCancel(e)) throw e; // a cancel must NOT silently fall back to an uncancellable inline run
    const { executeRewrite } = await import('./pdf-rewrite-core');
    return executeRewrite(await Promise.all(srcs.map((s) => s.arrayBuffer())), fallbackOp);
  }
}

type RewriteOpts = { signal?: AbortSignal };

/** Single-input, single-output rewrites (rotate/delete/reorder/extract/
 * page-numbers/watermark). Pass `{ signal }` to make it cancellable. */
export async function rewritePdf(src: File | Blob, op: RewriteOp, opts?: RewriteOpts): Promise<Uint8Array> {
  return (await run([src], op, opts?.signal))[0];
}

/** Merge several PDFs into one, in the given order. */
export async function mergePdfs(srcs: (File | Blob)[], opts?: RewriteOpts): Promise<Uint8Array> {
  return (await run(srcs, { type: 'merge' }, opts?.signal))[0];
}

/** Visual page-level merge: `plan[i] = { src, page }` — the i-th output page is
 * page `page` (0-based) of `srcs[src]`. Pages can come from any file in any order. */
export async function mergePdfPages(srcs: (File | Blob)[], plan: { src: number; page: number }[], opts?: RewriteOpts): Promise<Uint8Array> {
  return (await run(srcs, { type: 'merge-pages', plan }, opts?.signal))[0];
}

/** Split into many PDFs: one per page, or one per chunk of `every` pages. */
export async function splitPdf(src: File | Blob, op: { type: 'split-each' } | { type: 'split-chunks'; every: number } | { type: 'split-size'; maxBytes: number } | { type: 'split-groups'; groups: number[][] }, opts?: RewriteOpts): Promise<Uint8Array[]> {
  return run([src], op, opts?.signal);
}
