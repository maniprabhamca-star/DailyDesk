'use client';

// Scan to PDF — turn phone-camera shots (or chosen photos) into a clean PDF,
// 100% on-device. Each captured page is drawn to a canvas, put through the
// lighting-flattening pass in lib/scan-enhance (which is what makes a photo of
// paper look scanned rather than photographed), re-encoded as JPEG, and placed
// on its own page.

import { enhanceScan, type ScanMode } from '@/lib/scan-enhance';

export type { ScanMode };
export type ScanPage = { id: string; dataUrl: string; w: number; h: number };

let idc = 0;
export const newId = () => `p${++idc}-${performance.now().toFixed(0)}`;

// Downscale a captured frame to a sane print resolution, then flatten its
// lighting so the paper reads as white wherever it sits in the picture.
export function processFrame(source: CanvasImageSource, sw: number, sh: number, mode: ScanMode): ScanPage {
  const MAX = 2200; // long edge — ~150-200 DPI on a page, small file, sharp text
  const scale = Math.min(1, MAX / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);

  {
    // Every mode flattens the lighting; only the colour handling differs.
    const img = ctx.getImageData(0, 0, w, h);
    enhanceScan(img.data, w, h, mode);
    ctx.putImageData(img, 0, 0);
  }

  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  c.width = c.height = 0;
  return { id: newId(), dataUrl, w, h };
}

/**
 * Turn a captured page a quarter turn clockwise.
 *
 * This is where rotation belongs, and the scanner no longer has any: turning
 * the live camera preview was tried three times and went wrong three times,
 * because nobody can see whether a moving picture is "right" until they have
 * something to compare it against. A captured page is still, the thumbnail
 * shows the result immediately, and a wrong tap costs one more tap.
 */
export async function rotatePage(page: ScanPage): Promise<ScanPage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not re-open this page to turn it.'));
    i.src = page.dataUrl;
  });
  const w = img.naturalHeight || page.h, h = img.naturalWidth || page.w;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -h / 2, -w / 2);
  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  c.width = c.height = 0;
  // Same id: this is the same page, turned — not a new one. Keeping the id
  // means it stays where it is in the list instead of jumping to the end.
  return { id: page.id, dataUrl, w, h };
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

/**
 * Turn an already-flattened page (from lib/doc-scan) into a ScanPage.
 *
 * The scanner hands back ImageData that has already had its perspective and
 * background removed, so it must NOT go through processFrame's downscale-from-
 * a-video-element path — it is finished pixels, not a frame to sample. The
 * enhance pass is the same one, because a flattened page still benefits from
 * having the paper lifted toward white.
 */
export function pageFromImageData(img: ImageData, mode: ScanMode): ScanPage {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(img, 0, 0);

  {
    const data = ctx.getImageData(0, 0, c.width, c.height);
    enhanceScan(data.data, c.width, c.height, mode);
    ctx.putImageData(data, 0, 0);
  }

  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  const w = c.width, h = c.height;
  c.width = c.height = 0;
  return { id: newId(), dataUrl, w, h };
}
