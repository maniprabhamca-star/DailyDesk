// Every PDF rewrite operation in ONE place, executed by BOTH the Web Worker
// (lib/pdf-rewrite.worker.ts — the normal path, page stays responsive) and the
// main-thread inline fallback in lib/pdf-rewrite.ts — single source of truth,
// the two paths can't drift. This module imports pdf-lib statically: only load
// it from the worker or via dynamic import.
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { StampCore } from './pdf-stamp';
import { parseRanges } from './page-ranges';

export type PageNumberOpts = {
  pageNums: number[]; // 1-based pages to stamp, in the order they get numbers
  start: number; // first number assigned
  /** Label template — {n} = the assigned number, {p} = the last assigned
   * number (so "of {p}" can never read "5 of 3"). */
  template: string;
  fontSize: number;
  margin: number; // pt from the page edge
  colorRgb: [number, number, number];
  pos: 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
};

export type WatermarkOpts = StampCore & {
  /** Page range string ("1-3, 7"); empty = every page. Resolved here so the
   * main thread never has to open a huge file just to count pages. */
  range: string;
  /** Custom TTF bytes (already the right bold/italic variant) — embedded with
   * fontkit + subsetting. Omit to use `standardFont`. */
  fontBytes?: ArrayBuffer;
  standardFont?: string; // a StandardFonts value; default Helvetica
  imageBytes?: ArrayBuffer;
  imageIsPng?: boolean;
};

export type RewriteOp =
  | { type: 'rotate'; deltas: number[] } // per-page delta in degrees (0 = untouched)
  | { type: 'delete'; indices: number[] } // 0-based page indices to remove
  | { type: 'reorder'; order: number[] } // new page order (original 0-based indices)
  | { type: 'merge' } // all input buffers merged in order
  | { type: 'extract'; indices: number[] } // 0-based pages into one new PDF
  | { type: 'split-each' } // one output PDF per page
  | { type: 'split-chunks'; every: number } // fixed ranges: one output per N pages
  | { type: 'page-numbers'; opts: PageNumberOpts }
  | { type: 'watermark'; opts: WatermarkOpts };

export async function executeRewrite(buffers: ArrayBuffer[], op: RewriteOp): Promise<Uint8Array[]> {
  if (op.type === 'merge') {
    const out = await PDFDocument.create();
    for (const b of buffers) {
      const src = await PDFDocument.load(new Uint8Array(b), { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
    }
    return [await out.save()];
  }

  const doc = await PDFDocument.load(new Uint8Array(buffers[0]), { ignoreEncryption: true });

  switch (op.type) {
    case 'rotate': {
      const pages = doc.getPages();
      op.deltas.forEach((d, i) => {
        if (!d || !pages[i]) return;
        const cur = pages[i].getRotation().angle || 0;
        pages[i].setRotation(degrees((((cur + d) % 360) + 360) % 360));
      });
      return [await doc.save()];
    }
    case 'delete': {
      [...op.indices].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
      return [await doc.save()];
    }
    case 'reorder': {
      const dest = await PDFDocument.create();
      (await dest.copyPages(doc, op.order)).forEach((p) => dest.addPage(p));
      return [await dest.save()];
    }
    case 'extract': {
      const dest = await PDFDocument.create();
      (await dest.copyPages(doc, op.indices)).forEach((p) => dest.addPage(p));
      return [await dest.save()];
    }
    case 'split-each':
    case 'split-chunks': {
      const total = doc.getPageCount();
      const every = op.type === 'split-chunks' ? Math.max(1, op.every) : 1;
      const outs: Uint8Array[] = [];
      for (let from = 0; from < total; from += every) {
        const dest = await PDFDocument.create();
        const indices = Array.from({ length: Math.min(every, total - from) }, (_, i) => from + i);
        (await dest.copyPages(doc, indices)).forEach((p) => dest.addPage(p));
        outs.push(await dest.save());
      }
      return outs;
    }
    case 'page-numbers': {
      const o = op.opts;
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const denom = o.start + o.pageNums.length - 1;
      o.pageNums.forEach((pageNo, i) => {
        const page = pages[pageNo - 1];
        if (!page) return;
        const { width, height } = page.getSize();
        const text = o.template.replace(/\{n\}/g, String(o.start + i)).replace(/\{p\}/g, String(denom));
        const tw = font.widthOfTextAtSize(text, o.fontSize);
        const left = o.pos.endsWith('l');
        const center = o.pos.endsWith('c');
        const x = left ? o.margin : center ? (width - tw) / 2 : width - o.margin - tw;
        const y = o.pos.startsWith('t') ? height - o.margin - o.fontSize : o.margin;
        page.drawText(text, { x, y, size: o.fontSize, font, color: rgb(o.colorRgb[0], o.colorRgb[1], o.colorRgb[2]) });
      });
      return [await doc.save()];
    }
    case 'watermark': {
      const o = op.opts;
      const count = doc.getPageCount();
      const pageNums = o.range.trim() ? parseRanges(o.range, count) : Array.from({ length: count }, (_, i) => i + 1);
      let font = null;
      let image = null;
      if (o.mode === 'text') {
        if (o.fontBytes && o.fontBytes.byteLength > 0) {
          const fkMod = (await import('@pdf-lib/fontkit')) as { default?: unknown };
          doc.registerFontkit((fkMod.default ?? fkMod) as Parameters<typeof doc.registerFontkit>[0]);
          font = await doc.embedFont(new Uint8Array(o.fontBytes), { subset: true });
        } else {
          font = await doc.embedFont(o.standardFont || StandardFonts.Helvetica);
        }
      } else if (o.imageBytes && o.imageBytes.byteLength > 0) {
        image = o.imageIsPng ? await doc.embedPng(new Uint8Array(o.imageBytes)) : await doc.embedJpg(new Uint8Array(o.imageBytes));
      } else {
        throw new Error('Add a logo image first.');
      }
      const { stampPages } = await import('./pdf-stamp');
      stampPages(doc, pageNums, o, font, image);
      return [await doc.save()];
    }
  }
}
