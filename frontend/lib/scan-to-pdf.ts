'use client';

// Scan to PDF — turn phone-camera shots (or chosen photos) into a clean PDF,
// 100% on-device. Each captured page is drawn to a canvas, optionally enhanced
// for legibility (a light grayscale + contrast lift that makes a photographed
// document read like a scan), re-encoded as JPEG, and placed on its own page.

export type ScanPage = { id: string; dataUrl: string; w: number; h: number };

let idc = 0;
export const newId = () => `p${++idc}-${performance.now().toFixed(0)}`;

// Downscale a captured frame to a sane print resolution and, if asked, boost it
// toward a document scan: desaturate, then push contrast so paper goes white and
// ink goes dark. Kept deliberately mild — aggressive thresholding eats faint text.
export function processFrame(source: CanvasImageSource, sw: number, sh: number, enhance: boolean): ScanPage {
  const MAX = 2200; // long edge — ~150-200 DPI on a page, small file, sharp text
  const scale = Math.min(1, MAX / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);

  if (enhance) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const contrast = 1.35, mid = 128;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = (g - mid) * contrast + mid + 12; // +12 lifts the paper toward white
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }

  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  c.width = c.height = 0;
  return { id: newId(), dataUrl, w, h };
}

const dataUrlToBytes = (u: string): Uint8Array => {
  const b64 = u.slice(u.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// Assemble the pages into a PDF. A4 portrait/landscape chosen per image so a
// wide capture doesn't get letterboxed; each image fills its page with a small
// margin. pdf-lib embeds the JPEG bytes directly — no re-encode, no quality loss.
export async function buildScanPdf(pages: ScanPage[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setProducer('DiemDesk — scanned on your device');
  const A4 = 595.28; // points, short edge
  const A4_LONG = 841.89;
  for (const p of pages) {
    const landscape = p.w > p.h;
    const pw = landscape ? A4_LONG : A4;
    const ph = landscape ? A4 : A4_LONG;
    const page = doc.addPage([pw, ph]);
    const jpg = await doc.embedJpg(dataUrlToBytes(p.dataUrl));
    const margin = 18;
    const maxW = pw - margin * 2, maxH = ph - margin * 2;
    const s = Math.min(maxW / jpg.width, maxH / jpg.height);
    const dw = jpg.width * s, dh = jpg.height * s;
    page.drawImage(jpg, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}
