// Fill-a-PDF-form engine — all on-device. Detects AcroForm fields (for the
// "N fillable fields" hint) and exports the filled PDF by rendering each placed
// element (text, tick, X, date, signature) to a crisp transparent PNG and drawing
// it onto the page with pdf-lib, then flattening any existing form so the result
// can't be changed. Coordinates are page fractions so the editor and the output
// stay pixel-for-pixel identical.
export type FillKind = 'text' | 'check' | 'x' | 'date' | 'signature';

export type FillEl = {
  id: string;
  page: number;      // 0-based
  kind: FillKind;
  text: string;
  xFrac: number;     // top-left, fraction of page width
  yFrac: number;     // top-left, fraction of page height
  fontFrac: number;  // font size as a fraction of page height
  color: string;
};

export function fontFamilyFor(kind: FillKind): string {
  return kind === 'signature' ? '"Segoe Script","Brush Script MT","Snell Roundhand",cursive' : 'Arial, "Helvetica Neue", sans-serif';
}
export function glyphFor(kind: FillKind, text: string): string {
  return kind === 'check' ? '✓' : kind === 'x' ? '✗' : text;
}

// Draw an element to a tightly-cropped transparent canvas at the given px size.
export function elementToCanvas(el: FillEl, fontPx: number): HTMLCanvasElement {
  const family = fontFamilyFor(el.kind);
  const bold = el.kind === 'check' || el.kind === 'x';
  const text = glyphFor(el.kind, el.text) || ' ';
  const font = `${bold ? 'bold ' : ''}${fontPx}px ${family}`;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Your browser blocked canvas access.');
  measure.font = font;
  const w = Math.max(1, Math.ceil(measure.measureText(text).width) + Math.ceil(fontPx * 0.12));
  const h = Math.ceil(fontPx * 1.3);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Your browser blocked canvas access.');
  cx.font = font;
  cx.fillStyle = el.color || '#1e3a8a';
  cx.textBaseline = 'middle';
  cx.fillText(text, Math.ceil(fontPx * 0.06), h / 2);
  return canvas;
}

export async function detectFieldCount(file: File): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
    return doc.getForm().getFields().length;
  } catch {
    return 0;
  }
}

export async function exportFilledPdf(file: File, els: FillEl[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
  const pages = doc.getPages();

  for (const el of els) {
    const page = pages[el.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const fontPt = Math.max(4, el.fontFrac * H);
    const canvas = elementToCanvas(el, fontPt * 4); // 4× supersample for crisp text
    const pngBlob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
    const img = await doc.embedPng(await pngBlob.arrayBuffer());
    const imgH = fontPt * 1.3;
    const imgW = imgH * (canvas.width / canvas.height);
    const x = el.xFrac * W;
    const y = H - el.yFrac * H - imgH; // PDF origin is bottom-left
    page.drawImage(img, { x, y, width: imgW, height: imgH });
  }

  // Lock it: bake any existing form fields so the result can't be re-edited.
  try { doc.getForm().flatten(); } catch { /* no form, or nothing to flatten */ }

  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
