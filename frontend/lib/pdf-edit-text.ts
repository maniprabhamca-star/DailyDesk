// True re-encoding export for Edit PDF (see docs/edit-pdf-approach.md).
//
// The component works out the exact layout (cover rectangle + each redrawn word's
// position/size, with reflow) against the on-screen render, then hands us a flat
// list of positioned word draws per line. We just cover the affected span and
// re-encode those words as REAL vector text in matched fonts — so the export is a
// 1:1 match of the preview, and every UNtouched word stays the original PDF text.
//
// Font tiers (both "true re-encoding"):
//   • base-14 (Helvetica / Times / Courier + bold/italic) — no embedding, tiny.
//   • embeddable — the bundled OFL TTF for the matched family (fontkit subset).
//
// Note: covering paints over the original glyphs; they remain in the page's text
// layer underneath (pdf-lib can't surgically delete content-stream operators), so
// a text-copy of an edited word may still yield the original underneath. For true
// removal of sensitive text, that's what Redact is for.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { FAMILIES, type Family, loadFontBytes } from './fonts';

// One positioned word to (re)draw.
export type PartDraw = {
  text: string;
  xFrac: number;    // left edge (fraction of page width)
  sizeFrac: number; // font size (fraction of page height)
  family: Family;
  color: string;    // 'rgb(r,g,b)'
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  strike?: boolean;
};

export type LineEdit = {
  page: number;      // 0-based
  yFrac: number;     // line box top (fraction of page height, y-down)
  hFrac: number;     // line height (fraction of page height)
  bg: string;        // 'rgb(r,g,b)' cover colour
  coverLFrac: number; // cover rect left / right (fraction of page width)
  coverRFrac: number;
  draws: PartDraw[];  // the edited word(s) + everything after it, repositioned
};

// A whole edited PARAGRAPH: cover its box and re-flow the text (word-wrapped to
// the block width) in the matching font — the Smallpdf-style edit.
export type BlockEdit = {
  page: number;
  xFrac: number; yFrac: number; wFrac: number; hFrac: number; // draw box (y-down)
  coverXFrac?: number; coverYFrac?: number; coverWFrac?: number; coverHFrac?: number; // original box to hide
  bg: string;
  sizeFrac: number;   // font size (fraction of page height)
  lineHFrac: number;  // line-to-line spacing (fraction of page height)
  text: string;       // full text; \n = hard line break, otherwise wrapped
  family: Family; color: string; bold: boolean; italic: boolean;
  underline?: boolean; strike?: boolean; align?: 'left' | 'center' | 'right';
};

// Cover bleed + baseline factors — MUST match the preview overlay in
// edit-tool.tsx so the exported result is faithful to what the user saw.
export const COVER_TOP = 0.18;   // extend cover this·h above the box top
export const COVER_H = 1.36;     // total cover height in ·h
export const BASELINE = 0.8;     // baseline sits this·h below the box top

function parseRgb(s: string): [number, number, number] {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (!m) return [0, 0, 0];
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
}

function standardFontName(fam: Family, bold: boolean, italic: boolean): string | null {
  if (fam === 'times') return bold && italic ? StandardFonts.TimesRomanBoldItalic : bold ? StandardFonts.TimesRomanBold : italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  if (fam === 'courier') return bold && italic ? StandardFonts.CourierBoldOblique : bold ? StandardFonts.CourierBold : italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  if (fam === 'helvetica') return bold && italic ? StandardFonts.HelveticaBoldOblique : bold ? StandardFonts.HelveticaBold : italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
  return null; // embeddable family
}

function drawDecoration(page: ReturnType<PDFDocument['getPages']>[number], x: number, baseline: number, width: number, size: number, color: ReturnType<typeof rgb>, underline?: boolean, strike?: boolean) {
  if (width <= 0) return;
  const thickness = Math.max(0.6, size * 0.06);
  if (underline) page.drawLine({ start: { x, y: baseline - size * 0.14 }, end: { x: x + width, y: baseline - size * 0.14 }, thickness, color });
  if (strike) page.drawLine({ start: { x, y: baseline + size * 0.32 }, end: { x: x + width, y: baseline + size * 0.32 }, thickness, color });
}

/** Apply the positioned word edits to a PDF, returning new bytes. Pure — no DOM,
 * so it runs in a Node test the same way it runs in the browser. */
export async function applyLineEdits(src: ArrayBuffer | Uint8Array, edits: LineEdit[], blocks: BlockEdit[] = []): Promise<Uint8Array> {
  const doc = await PDFDocument.load(src, { ignoreEncryption: true });
  const pages = doc.getPages();
  const cache = new Map<string, PDFFont>();
  let fontkitReady = false;

  async function getFont(fam: Family, bold: boolean, italic: boolean): Promise<PDFFont> {
    const std = standardFontName(fam, bold, italic);
    if (std) {
      const key = `std:${std}`;
      let f = cache.get(key);
      if (!f) { f = await doc.embedFont(std); cache.set(key, f); }
      return f;
    }
    const info = FAMILIES[fam];
    const file = (bold && info.files?.bold) || (italic && info.files?.italic) || info.files?.regular;
    if (!file) return getFont('helvetica', bold, italic);
    const key = `ttf:${file}`;
    let f = cache.get(key);
    if (!f) {
      if (!fontkitReady) {
        const fk = (await import('@pdf-lib/fontkit')) as { default?: unknown };
        doc.registerFontkit((fk.default ?? fk) as Parameters<typeof doc.registerFontkit>[0]);
        fontkitReady = true;
      }
      const bytes = await loadFontBytes(file);
      // NOT subset — fontkit's subsetting corrupts some of these fonts' glyph
      // tables (Carlito rendered as scrambled letters). Embedding the full font
      // is a bit larger but renders correctly; it's cached per document.
      f = await doc.embedFont(bytes, { subset: false });
      cache.set(key, f);
    }
    return f;
  }

  for (const L of edits) {
    const page = pages[L.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const h = L.hFrac * H;

    // Cover the affected span (edited word onward), in the sampled bg colour.
    const [br, bgc, bb] = parseRgb(L.bg);
    const coverBottom = H * (1 - L.yFrac - (COVER_H - COVER_TOP) * L.hFrac);
    page.drawRectangle({ x: L.coverLFrac * W, y: coverBottom, width: (L.coverRFrac - L.coverLFrac) * W, height: COVER_H * h, color: rgb(br, bgc, bb) });

    // Re-encode each word as real vector text on the original baseline.
    const baseY = H * (1 - L.yFrac - BASELINE * L.hFrac);
    for (const d of L.draws) {
      if (!d.text.trim()) continue;
      const font = await getFont(d.family, d.bold, d.italic);
      const [cr, cg, cb] = parseRgb(d.color);
      const color = rgb(cr, cg, cb);
      const size = d.sizeFrac * H;
      const x = d.xFrac * W;
      page.drawText(d.text, { x, y: baseY, size, font, color });
      drawDecoration(page, x, baseY, font.widthOfTextAtSize(d.text, size), size, color, d.underline, d.strike);
    }
  }

  // Paragraph blocks: cover the box, then re-flow the text word-wrapped to the
  // block width in the matching font.
  for (const B of blocks) {
    const page = pages[B.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const [br, bgc, bb] = parseRgb(B.bg);
    const size = B.sizeFrac * H;
    const lineH = B.lineHFrac * H || size * 1.2;
    const maxW = B.wFrac * W;
    const padY = size * 0.35;
    // Cover the whole paragraph (bleed a little above/below).
    const coverX = B.coverXFrac ?? B.xFrac;
    const coverY = B.coverYFrac ?? B.yFrac;
    const coverW = B.coverWFrac ?? B.wFrac;
    const coverH = B.coverHFrac ?? B.hFrac;
    page.drawRectangle({ x: coverX * W - size * 0.1, y: H * (1 - coverY - coverH) - padY, width: coverW * W + size * 0.25, height: coverH * H + padY * 2, color: rgb(br, bgc, bb) });
    const font = await getFont(B.family, B.bold, B.italic);
    const [cr, cg, cb] = parseRgb(B.color);
    const color = rgb(cr, cg, cb);
    const safe = (t: string) => t.replace(/[^\S\r\n]+/g, ' '); // collapse odd whitespace
    let baseline = H * (1 - B.yFrac - BASELINE * B.sizeFrac);
    const x = B.xFrac * W;
    const alignX = (s: string) => {
      const width = font.widthOfTextAtSize(s, size);
      if (B.align === 'center') return x + Math.max(0, (maxW - width) / 2);
      if (B.align === 'right') return x + Math.max(0, maxW - width);
      return x;
    };
    for (const para of safe(B.text).split('\n')) {
      const words = para.split(' ');
      let cur = '';
      const put = (s: string) => {
        if (s) {
          try {
            const lineX = alignX(s);
            page.drawText(s, { x: lineX, y: baseline, size, font, color });
            drawDecoration(page, lineX, baseline, font.widthOfTextAtSize(s, size), size, color, B.underline, B.strike);
          } catch { /* skip unencodable */ }
        }
        baseline -= lineH;
      };
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (cur && font.widthOfTextAtSize(test, size) > maxW) { put(cur); cur = w; }
        else cur = test;
      }
      put(cur); // last line of the paragraph (or a blank line advances too)
    }
  }

  return doc.save();
}
