// Shared watermark stamp geometry — used by the watermark tool's live preview
// (main thread, page 1 only) AND by the pdf-rewrite worker's full apply, so
// the preview and the output can never drift apart. This module imports
// pdf-lib statically: always load it DYNAMICALLY from page components.
import type { PDFDocument, PDFFont, PDFImage } from 'pdf-lib';
import { PDFArray, rgb, degrees } from 'pdf-lib';

export type StampLayer = 'over' | 'under';
export type StampCore = {
  mode: 'text' | 'image';
  text: string;
  colorRgb: [number, number, number];
  sizeFrac: number; // text size as a fraction of the page's short edge
  opacity: number;
  position: string; // 'tl'|'tc'|'tr'|'ml'|'mc'|'mr'|'bl'|'bc'|'br' | 'tiled'
  rotation: number; // degrees
  imageScale: number; // fraction of page width (image mode)
  /** 'under' draws the stamp BEHIND the page content (iLovePDF's "below
   * content") — the original text/images paint over the watermark. */
  layer: StampLayer;
};

const MARGIN = 36; // pt from page edges for anchored positions

// "Behind the content": pdf-lib writes our stamp operators into a NEW content
// stream appended after the originals — moving that stream to the FRONT of the
// page's Contents array makes the original content paint OVER the stamp.
// pdf-lib wraps the pre-existing streams in q/Q when a page is first drawn on,
// so graphics state can't leak between the stamp and the original content.
function sinkLatestStream(page: ReturnType<PDFDocument['getPage']>): void {
  const contents = page.node.Contents();
  if (contents instanceof PDFArray && contents.size() > 1) {
    const last = contents.get(contents.size() - 1);
    contents.remove(contents.size() - 1);
    contents.insert(0, last);
  }
}

/** Stamp the given 1-based pages. Text mode requires `font`; image mode
 * requires `image`. Geometry is identical for preview and apply. */
export function stampPages(doc: PDFDocument, pageNums: number[], s: StampCore, font: PDFFont | null, image: PDFImage | null): void {
  const color = rgb(s.colorRgb[0], s.colorRgb[1], s.colorRgb[2]);
  const text = s.text.trim() || 'CONFIDENTIAL';
  // Multi-line: pdf-lib drawText doesn't handle "\n", so we split and stack the
  // lines ourselves (empty lines keep their height via a space).
  const lines = text.split('\n').map((l) => (l.length ? l : ' '));
  const pages = doc.getPages();
  for (const n of pageNums) {
    const page = pages[n - 1];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const rot = s.rotation;
    const rad = (rot * Math.PI) / 180;

    // Element size: text box or scaled image.
    const fontSize = Math.max(8, Math.min(W, H) * s.sizeFrac);
    const lineH = font ? font.heightAtSize(fontSize) * 1.2 : 0;
    let elW: number;
    let elH: number;
    if (image) {
      elW = W * s.imageScale;
      elH = (image.height / image.width) * elW;
    } else if (font) {
      elW = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, fontSize)));
      elH = lines.length * lineH;
    } else {
      continue;
    }

    const drawOne = (x: number, y: number) => {
      if (image) { page.drawImage(image, { x, y, width: elW, height: elH, opacity: s.opacity, rotate: degrees(rot) }); return; }
      // Stack lines perpendicular to the (possibly rotated) baseline; top line highest.
      const ux = -Math.sin(rad), uy = Math.cos(rad); // page-space "up" after rotation
      for (let i = 0; i < lines.length; i++) {
        const row = lines.length - 1 - i;
        page.drawText(lines[i], { x: x + ux * row * lineH, y: y + uy * row * lineH, size: fontSize, font: font!, color, opacity: s.opacity, rotate: degrees(rot) });
      }
    };

    if (s.position === 'tiled') {
      const stepX = elW + fontSize * 3 || elW * 1.6;
      const stepY = elH + fontSize * 4 || elH * 2.2;
      for (let y = -stepY; y < H + stepY; y += stepY) {
        for (let x = -stepX; x < W + stepX; x += stepX) drawOne(x, y);
      }
    } else {
      const ax = s.position[1]; // l | c | r
      const ay = s.position[0]; // t | m | b
      let x = ax === 'l' ? MARGIN : ax === 'c' ? (W - elW) / 2 : W - elW - MARGIN;
      let y = ay === 't' ? H - elH - MARGIN : ay === 'm' ? (H - elH) / 2 : MARGIN;
      if (s.position === 'mc' && rot !== 0) {
        // Keep the rotated stamp visually centered (rotation pivots at x,y).
        x = W / 2 - (elW / 2) * Math.cos(rad) + (elH / 2) * Math.sin(rad) * 0.5;
        y = H / 2 - (elW / 2) * Math.sin(rad) - (elH / 2) * Math.cos(rad) * 0.5;
      }
      drawOne(x, y);
    }

    if (s.layer === 'under') sinkLatestStream(page);
  }
}
