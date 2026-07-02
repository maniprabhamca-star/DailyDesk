/// <reference lib="webworker" />
// PDF rewrite worker — runs pdf-lib OFF the main thread so big-file rewrites
// (rotate/delete/reorder/merge/split/page-numbers/watermark on 100MB+
// documents) never freeze the page. Input buffers arrive transferred
// (zero-copy) and every output buffer transfers back the same way. All op
// logic lives in pdf-rewrite-core (shared with the inline fallback).
import { executeRewrite, type RewriteOp } from './pdf-rewrite-core';

export type { RewriteOp };

self.onmessage = async (e: MessageEvent<{ buffers: ArrayBuffer[]; op: RewriteOp }>) => {
  const post = self.postMessage.bind(self) as (msg: unknown, transfer?: Transferable[]) => void;
  try {
    const list = await executeRewrite(e.data.buffers, e.data.op);
    post({ ok: true, list }, list.map((u) => u.buffer as ArrayBuffer));
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : 'Could not rewrite the PDF.' });
  }
};
