'use client';

// Scan to PDF — turn phone-camera shots (or chosen photos) into a clean PDF,
// 100% on-device. Each captured page is drawn to a canvas, put through the
// lighting-flattening pass in lib/scan-enhance (which is what makes a photo of
// paper look scanned rather than photographed), re-encoded as JPEG, and placed
// on its own page.

import { enhanceScan, type ScanMode } from '@/lib/scan-enhance';
import { flattenDocument, type Quad } from '@/lib/doc-scan';

export type { ScanMode };
/**
 * A captured page.
 *
 *  is the SAME pixels before the lighting pass. It is kept so that
 * changing the mode re-renders pages you have already taken — without it the
 * control only affects the next capture, which is not what a mode control
 * means to anyone. It costs one extra JPEG per page in memory and nothing on
 * disk: it never reaches the PDF.
 */
export type ScanPage = { id: string; dataUrl: string; rawUrl: string; w: number; h: number };

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

  const rawUrl = c.toDataURL('image/jpeg', 0.9);
  {
    // Every mode flattens the lighting; only the colour handling differs.
    const img = ctx.getImageData(0, 0, w, h);
    enhanceScan(img.data, w, h, mode);
    ctx.putImageData(img, 0, 0);
  }

  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  c.width = c.height = 0;
  return { id: newId(), dataUrl, rawUrl, w, h };
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
  return { id: page.id, dataUrl, rawUrl: page.rawUrl, w, h };
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

  const rawUrl = c.toDataURL('image/jpeg', 0.9);
  {
    const data = ctx.getImageData(0, 0, c.width, c.height);
    enhanceScan(data.data, c.width, c.height, mode);
    ctx.putImageData(data, 0, 0);
  }

  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  const w = c.width, h = c.height;
  c.width = c.height = 0;
  return { id: newId(), dataUrl, rawUrl, w, h };
}

/**
 * Re-apply a mode to a page that was already captured.
 *
 * Without this the mode control is a lie: you tap "Black & white", the pages
 * you can see do not change, and the setting silently applies only to the next
 * capture. `rawUrl` exists so this can work — the original pixels are still
 * there to run the pass over again.
 */
export async function recolourPage(page: ScanPage, mode: ScanMode): Promise<ScanPage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not re-open this page.'));
    i.src = page.rawUrl;
  });
  const w = img.naturalWidth || page.w, h = img.naturalHeight || page.h;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  enhanceScan(data.data, w, h, mode);
  ctx.putImageData(data, 0, 0);
  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  c.width = c.height = 0;
  // Same id and same raw pixels: this is the same page, processed differently.
  return { id: page.id, dataUrl, rawUrl: page.rawUrl, w, h };
}

/**
 * Crop a captured page to four corners the person placed by hand.
 *
 * Automatic detection cannot find an edge that is not in the picture, and on a
 * white envelope lying on a white quilt it is genuinely not there — measured
 * across all three visible edges of the owner's own capture, the paper and the
 * bedspread differ by two or three grey levels, which is less than the sensor
 * noise. No amount of thresholding invents a boundary, so the honest answer is
 * to let someone who CAN see it say where it is. Every scanner app has this;
 * ours should have had it before it had anything else.
 *
 * `corners` are fractions of the page's own width and height, so they survive
 * the image being displayed at any size. They run through the same
 * flattenDocument the automatic path uses, so a hand-placed quad is corrected
 * for perspective exactly like a detected one.
 */
export async function cropPage(page: ScanPage, corners: Quad, mode: ScanMode): Promise<ScanPage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not re-open this page to crop it.'));
    i.src = page.rawUrl;
  });
  const sw = img.naturalWidth || page.w, sh = img.naturalHeight || page.h;
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const quad = corners.map((p) => ({ x: p.x * sw, y: p.y * sh })) as Quad;
  const flat = flattenDocument(ctx.getImageData(0, 0, sw, sh), quad);
  c.width = c.height = 0;
  if (!flat) throw new Error('Those corners do not make a page — try again.');

  // From here it is an ordinary captured page: keep the flattened pixels as the
  // new raw, so the mode buttons still work on it afterwards.
  const out = document.createElement('canvas');
  out.width = flat.width; out.height = flat.height;
  const octx = out.getContext('2d')!;
  octx.putImageData(flat, 0, 0);
  const rawUrl = out.toDataURL('image/jpeg', 0.9);
  const data = octx.getImageData(0, 0, out.width, out.height);
  enhanceScan(data.data, out.width, out.height, mode);
  octx.putImageData(data, 0, 0);
  const dataUrl = out.toDataURL('image/jpeg', 0.82);
  const w = out.width, h = out.height;
  out.width = out.height = 0;
  return { id: page.id, dataUrl, rawUrl, w, h };
}
