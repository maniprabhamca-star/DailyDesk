'use client';

// Page-geometry operations: rebuild a document's pages rather than edit their
// contents. Halving, N-up and resizing are all the same move — make a new page
// of some size and draw the old one onto it at some scale and offset — so they
// share this file instead of growing three near-identical copies.
//
// All of it runs on pdf-lib in the browser. Nothing is uploaded.

export type PaperName = 'A3' | 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal' | 'Tabloid';

// Points at 72/inch, portrait.
export const PAPER: Record<PaperName, [number, number]> = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  A6: [297.64, 419.53],
  Letter: [612, 792],
  Legal: [612, 1008],
  Tabloid: [792, 1224],
};

export type Orientation = 'portrait' | 'landscape' | 'auto';

export function paperSize(name: PaperName, orientation: Orientation, sourceIsLandscape = false): [number, number] {
  const [w, h] = PAPER[name];
  const landscape = orientation === 'landscape' || (orientation === 'auto' && sourceIsLandscape);
  return landscape ? [h, w] : [w, h];
}

type Lib = typeof import('pdf-lib');

/**
 * Cut every page in two.
 *
 * The case this exists for: a scanned book or magazine, where each scan holds
 * two facing pages and every reader shows them as one wide sheet. `vertical`
 * cuts down the middle (the spread case); `horizontal` cuts across, for a sheet
 * holding two stacked slips.
 *
 * The halves are produced by drawing the same embedded page onto two narrower
 * pages at different offsets, so text stays text — nothing is rasterised.
 */
export async function halvePages(
  bytes: Uint8Array,
  opts: { axis: 'vertical' | 'horizontal'; rightToLeft?: boolean },
): Promise<Uint8Array> {
  const { PDFDocument } = (await import('pdf-lib')) as Lib;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const count = src.getPageCount();
  const embedded = await out.embedPdf(src, Array.from({ length: count }, (_, i) => i));

  for (let i = 0; i < count; i++) {
    const ep = embedded[i];
    const w = ep.width, h = ep.height;
    if (opts.axis === 'vertical') {
      const halfW = w / 2;
      // Left half, then right — reversed for right-to-left scripts, where the
      // left page of a spread is the SECOND page.
      const order: Array<0 | 1> = opts.rightToLeft ? [1, 0] : [0, 1];
      for (const side of order) {
        const p = out.addPage([halfW, h]);
        p.drawPage(ep, { x: side === 0 ? 0 : -halfW, y: 0, width: w, height: h });
      }
    } else {
      const halfH = h / 2;
      // Top half first: in PDF space y grows upward, so the top half needs the
      // page pushed DOWN by half its height.
      for (const part of [0, 1] as const) {
        const p = out.addPage([w, halfH]);
        p.drawPage(ep, { x: 0, y: part === 0 ? -halfH : 0, width: w, height: h });
      }
    }
  }
  return out.save();
}

/**
 * Put several pages on one sheet (N-up), for printing a long document short.
 * Pages are laid left-to-right, top-to-bottom, each scaled to fit its cell
 * while keeping its proportions.
 */
export async function pagesPerSheet(
  bytes: Uint8Array,
  opts: {
    per: 2 | 4 | 6 | 8 | 9 | 16;
    paper: PaperName;
    orientation: Orientation;
    marginPt: number;
    gapPt: number;
    border: boolean;
    rightToLeft?: boolean;
  },
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = (await import('pdf-lib')) as Lib;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const count = src.getPageCount();
  const embedded = await out.embedPdf(src, Array.from({ length: count }, (_, i) => i));

  // Grid shape per N. Chosen so the cells stay as square as possible.
  const GRID: Record<number, [number, number]> = { 2: [1, 2], 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3], 16: [4, 4] };
  const [cols, rows] = GRID[opts.per];

  const first = embedded[0];
  const [pw, ph] = paperSize(opts.paper, opts.orientation, !!first && first.width > first.height);

  const cellW = (pw - opts.marginPt * 2 - opts.gapPt * (cols - 1)) / cols;
  const cellH = (ph - opts.marginPt * 2 - opts.gapPt * (rows - 1)) / rows;

  for (let i = 0; i < count; i += opts.per) {
    const sheet = out.addPage([pw, ph]);
    for (let slot = 0; slot < opts.per; slot++) {
      const ep = embedded[i + slot];
      if (!ep) break;
      let col = slot % cols;
      const row = Math.floor(slot / cols);
      if (opts.rightToLeft) col = cols - 1 - col;
      const cx = opts.marginPt + col * (cellW + opts.gapPt);
      // Row 0 is the TOP row, and y grows upward, so count rows down from the top.
      const cy = ph - opts.marginPt - (row + 1) * cellH - row * opts.gapPt;
      const k = Math.min(cellW / ep.width, cellH / ep.height);
      const w = ep.width * k, h = ep.height * k;
      sheet.drawPage(ep, { x: cx + (cellW - w) / 2, y: cy + (cellH - h) / 2, width: w, height: h });
      if (opts.border) {
        sheet.drawRectangle({
          x: cx, y: cy, width: cellW, height: cellH,
          borderColor: rgb(0.75, 0.75, 0.78), borderWidth: 0.75,
        });
      }
    }
  }
  return out.save();
}

/**
 * Give every page one size.
 *
 * Two jobs in one, and the second is the one people actually need: setting a
 * specific size (A4, Letter…), and UNIFYING a document whose pages disagree —
 * which is what merging things from different sources leaves you with.
 * Content is scaled to fit and centred, never cropped.
 */
export async function resizePages(
  bytes: Uint8Array,
  opts: { mode: 'preset' | 'unify'; paper: PaperName; orientation: Orientation },
): Promise<Uint8Array> {
  const { PDFDocument } = (await import('pdf-lib')) as Lib;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const count = src.getPageCount();
  const embedded = await out.embedPdf(src, Array.from({ length: count }, (_, i) => i));

  // Unify: adopt the size the document already uses most, so a document that is
  // mostly A4 with two stray pages becomes all A4 rather than all something new.
  let target: [number, number] | null = null;
  if (opts.mode === 'unify') {
    const tally = new Map<string, { n: number; size: [number, number] }>();
    for (const ep of embedded) {
      const key = `${Math.round(ep.width)}x${Math.round(ep.height)}`;
      const hit = tally.get(key);
      if (hit) hit.n++;
      else tally.set(key, { n: 1, size: [ep.width, ep.height] });
    }
    let best = 0;
    tally.forEach((v) => { if (v.n > best) { best = v.n; target = v.size; } });
  }

  for (const ep of embedded) {
    const [pw, ph] = target ?? paperSize(opts.paper, opts.orientation, ep.width > ep.height);
    const p = out.addPage([pw, ph]);
    const k = Math.min(pw / ep.width, ph / ep.height);
    const w = ep.width * k, h = ep.height * k;
    p.drawPage(ep, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return out.save();
}

/** Every distinct page size in the file, for telling the reader what they have. */
export async function pageSizeSummary(bytes: Uint8Array): Promise<{ label: string; count: number }[]> {
  const { PDFDocument } = (await import('pdf-lib')) as Lib;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const tally = new Map<string, number>();
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    const mm = (pt: number) => Math.round((pt / 72) * 25.4);
    tally.set(`${mm(width)} × ${mm(height)} mm`, (tally.get(`${mm(width)} × ${mm(height)} mm`) || 0) + 1);
  }
  const rows: { label: string; count: number }[] = [];
  tally.forEach((count, label) => rows.push({ label, count }));
  return rows.sort((a, b) => b.count - a.count);
}
