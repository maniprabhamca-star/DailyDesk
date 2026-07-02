/// <reference lib="webworker" />
// PDF rewrite worker — runs pdf-lib OFF the main thread so big-file rewrites
// (rotate/delete on 100MB+ documents) never freeze the page. The input buffer
// arrives transferred (zero-copy) and the output transfers back the same way.
import { PDFDocument, degrees } from 'pdf-lib';

export type RewriteOp =
  | { type: 'rotate'; deltas: number[] } // per-page delta in degrees (0 = untouched)
  | { type: 'delete'; indices: number[] }; // 0-based page indices to remove

self.onmessage = async (e: MessageEvent<{ buffer: ArrayBuffer; op: RewriteOp }>) => {
  const post = self.postMessage.bind(self) as (msg: unknown, transfer?: Transferable[]) => void;
  try {
    const { buffer, op } = e.data;
    const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
    if (op.type === 'rotate') {
      const pages = doc.getPages();
      op.deltas.forEach((d, i) => {
        if (!d || !pages[i]) return;
        const cur = pages[i].getRotation().angle || 0;
        pages[i].setRotation(degrees((((cur + d) % 360) + 360) % 360));
      });
    } else {
      [...op.indices].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
    }
    const out = await doc.save();
    post({ ok: true, bytes: out }, [out.buffer]);
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : 'Could not rewrite the PDF.' });
  }
};
