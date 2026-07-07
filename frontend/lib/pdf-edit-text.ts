// True re-encoding export for Edit PDF (see docs/edit-pdf-approach.md).
//
// A PDF line of text is one unit: you can't make a word longer without the rest
// of the line moving. So we edit at the LINE level — cover the original line and
// redraw it word-by-word in matched fonts/sizes/colours, with the edited word
// swapped in. Trailing words reflow automatically (no overlap, no overflow), and
// every glyph is REAL vector text (crisp + selectable). Unedited lines are left
// completely untouched, so the rest of the page stays pixel-perfect.
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

// One styled segment of a line (a word, or a run of spaces with text=' ').
export type PartStyle = {
  text: string;
  origText?: string; // the ORIGINAL word — lets us fit relative to original width
  family: Family;
  sizeFrac?: number; // drawn size (defaults to the line's hFrac)
  color: string;     // 'rgb(r,g,b)'
  bold: boolean;
  italic: boolean;
};

export type LineEdit = {
  page: number;   // 0-based
  xFrac: number;  // line box left  (fraction of page width)
  yFrac: number;  // line box top   (fraction of page height, y-down)
  wFrac: number;  // original line width (fraction of page width) — cover width
  hFrac: number;  // font size / line height (fraction of page height)
  bg: string;     // 'rgb(r,g,b)' cover colour
  parts: PartStyle[]; // whole line, in order
};

// Cover bleed + baseline factors — MUST match the preview overlay in
// edit-tool.tsx so the exported result is faithful to what the user saw.
export const COVER_TOP = 0.18;   // extend cover this·h above the box top
export const COVER_H = 1.36;     // total cover height in ·h
export const BASELINE = 0.8;     // baseline sits this·h below the box top
export const FIT_FLOOR = 0.8;    // shrink a too-long line no smaller than this·size

/** How much to scale a whole line so it fits its original width (never grows;
 * shrinks a longer replacement to the FIT_FLOOR so it can't spill into the next
 * run). Shared formula so preview and export agree. */
export function lineFitScale(naturalWidth: number, maxWidth: number): number {
  if (naturalWidth <= maxWidth || naturalWidth <= 0 || maxWidth <= 0) return 1;
  return Math.max(FIT_FLOOR, maxWidth / naturalWidth);
}

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

/** Apply line edits to a PDF, returning new bytes. Pure — no DOM, so it runs in
 * a Node test the same way it runs in the browser (base-14 tier needs no fetch). */
export async function applyLineEdits(src: ArrayBuffer | Uint8Array, edits: LineEdit[]): Promise<Uint8Array> {
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
      f = await doc.embedFont(bytes, { subset: true });
      cache.set(key, f);
    }
    return f;
  }

  for (const L of edits) {
    const page = pages[L.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const h = L.hFrac * H;
    const bx = Math.max(1, L.wFrac * W * 0.02 + h * 0.06);

    // 1) cover the whole original line.
    const [br, bgc, bb] = parseRgb(L.bg);
    page.drawRectangle({
      x: L.xFrac * W - bx,
      y: H * (1 - L.yFrac - (COVER_H - COVER_TOP) * L.hFrac),
      width: L.wFrac * W + bx * 2,
      height: COVER_H * h,
      color: rgb(br, bgc, bb),
    });

    // 2) redraw the line, part by part, advancing x by each part's real width so
    //    everything after an edit reflows exactly like a text editor. First
    //    measure the whole line and shrink it to fit the original width, so a
    //    longer replacement can't spill into a neighbouring run.
    const baseY = H * (1 - L.yFrac - BASELINE * L.hFrac);
    const fonts = await Promise.all(L.parts.map((p) => getFont(p.family, p.bold, p.italic)));
    // Fit relative to the ORIGINAL content width (like-for-like in the redraw
    // font), so unchanged / shorter edits never shrink; only a longer edit does.
    let natCur = 0, natOrig = 0;
    L.parts.forEach((p, i) => {
      const size = (p.sizeFrac ?? L.hFrac) * H;
      natCur += fonts[i].widthOfTextAtSize(p.text || ' ', size);
      natOrig += fonts[i].widthOfTextAtSize((p.origText ?? p.text) || ' ', size);
    });
    const fit = natOrig > 0 ? lineFitScale(natCur, natOrig) : lineFitScale(natCur, L.wFrac * W);
    let x = L.xFrac * W;
    L.parts.forEach((p, i) => {
      if (!p.text) return;
      const font = fonts[i];
      const size = (p.sizeFrac ?? L.hFrac) * H * fit;
      if (p.text.trim()) {
        const [cr, cg, cb] = parseRgb(p.color);
        page.drawText(p.text, { x, y: baseY, size, font, color: rgb(cr, cg, cb) });
      }
      x += font.widthOfTextAtSize(p.text, size);
    });
  }

  return doc.save();
}
