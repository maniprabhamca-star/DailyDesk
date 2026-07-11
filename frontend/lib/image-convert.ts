// Shared client-side image engine for Resize/Convert: decode → (optional)
// high-quality resample → encode. JPG goes through mozjpeg (same studio-grade
// encoder as everywhere else); PNG/WebP use the native encoder. WebP encoding
// is feature-detected (Safari can't) — callers get a clear signal, never a
// silently-broken download.

import { encodeJpeg } from './mozjpeg';

export type OutFormat = 'jpg' | 'png' | 'webp';

export function canEncodeWebp(): boolean {
  try {
    return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export async function decodeImage(file: File | Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('Could not read that image. (iPhone HEIC photos: convert them with our HEIC to JPG tool first.)');
  }
}

/** High-quality resample: progressive halving for big downscales (plain
 * drawImage gets muddy past ~2×), then one final smooth pass. */
export function resample(src: CanvasImageSource & { width: number; height: number }, w: number, h: number): HTMLCanvasElement {
  let cur: CanvasImageSource & { width: number; height: number } = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= w && ch / 2 >= h && cw > 32 && ch > 32) {
    cw = Math.max(w, Math.round(cw / 2));
    ch = Math.max(h, Math.round(ch / 2));
    const step = document.createElement('canvas');
    step.width = cw;
    step.height = ch;
    const sctx = step.getContext('2d')!;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(cur, 0, 0, cw, ch);
    cur = step;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, w, h);
  return out;
}

/** Encode a canvas. quality is 1-100 (lossy formats only). JPG gets a white
 * background baked in (no alpha in JPEG). */
export async function encodeCanvas(canvas: HTMLCanvasElement, format: OutFormat, quality: number): Promise<Blob> {
  if (format === 'jpg') {
    // flatten alpha onto white, then mozjpeg
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const fctx = flat.getContext('2d')!;
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(canvas, 0, 0);
    const data = fctx.getImageData(0, 0, flat.width, flat.height);
    try {
      return await encodeJpeg(data, quality);
    } catch {
      const b = await new Promise<Blob | null>((r) => flat.toBlob(r, 'image/jpeg', quality / 100));
      if (!b) throw new Error('Could not encode the image.');
      return b;
    }
  }
  const mime = format === 'png' ? 'image/png' : 'image/webp';
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, format === 'webp' ? quality / 100 : undefined));
  if (!blob || (format === 'webp' && blob.type !== 'image/webp')) {
    throw new Error(format === 'webp' ? 'This browser can’t create WebP — choose JPG or PNG instead.' : 'Could not encode the image.');
  }
  return blob;
}

// Live-preview helpers (quality-preview pass): re-encoding a full 48MP photo on
// every slider tick is wasteful, so we build ONE capped source canvas per file
// and re-encode just that at the selected setting. Artifacts are per-block, so a
// ~1600px sample shows the real quality (and the loupe zooms it 2.4×).
export const PREVIEW_MAX = 1600;

/** Build a capped, high-quality preview canvas from a decoded image, honouring an
 * optional extra long-edge cap (e.g. a chosen resize target). */
export function buildPreviewCanvas(
  bmp: CanvasImageSource & { width: number; height: number },
  extraCap = Infinity,
): { canvas: HTMLCanvasElement; w: number; h: number } {
  const cap = Math.min(PREVIEW_MAX, extraCap);
  const scale = Math.min(1, cap / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  return { canvas: resample(bmp, w, h), w, h };
}

/** Lossless PNG snapshot of a canvas — the "before" reference pane. */
export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const b = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!b) throw new Error('Could not render the preview.');
  return b;
}

export function detectFormat(f: File): OutFormat | 'other' {
  if (/jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name)) return 'jpg';
  if (/png$/i.test(f.type) || /\.png$/i.test(f.name)) return 'png';
  if (/webp$/i.test(f.type) || /\.webp$/i.test(f.name)) return 'webp';
  return 'other';
}

// ── Headless batch cores ──────────────────────────────────────────────────
// The SAME on-device pipelines the Convert/Resize tools run for a single file,
// extracted so the BatchRunner (Pro on-device batch) can loop them over many
// files. Kept equivalent to each tool's single-file run() so batch output is
// byte-for-byte what a user would get one at a time.

export type BatchImageResult = { blob: Blob; name: string; before: number; after: number };

/** Convert one image to `format` at `quality` — mirrors ConvertImageTool.run(). */
export async function convertImageFile(file: File, opts: { format: OutFormat; quality: number }): Promise<BatchImageResult> {
  const bm = await decodeImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = bm.width;
  canvas.height = bm.height;
  canvas.getContext('2d')!.drawImage(bm, 0, 0);
  bm.close();
  const blob = await encodeCanvas(canvas, opts.format, opts.quality);
  canvas.width = 0; canvas.height = 0;
  const name = `${file.name.replace(/\.[^.]+$/, '')}.${opts.format}`;
  return { blob, name, before: file.size, after: blob.size };
}

export type BatchResizeMode = 'percent' | 'fit';

/** Resize one image keeping aspect — mirrors ResizeImageTool.run(), but sized
 * for a mixed batch: absolute pixels can't apply across differently-sized
 * images, so batch offers a percentage or a "fit within a max long edge" cap
 * (fit only ever downscales). */
export async function resizeImageFile(
  file: File,
  opts: { mode: BatchResizeMode; percent: number; maxEdge: number; format: OutFormat; quality: number },
): Promise<BatchImageResult> {
  const bm = await decodeImage(file);
  const scale = opts.mode === 'percent'
    ? Math.max(1, opts.percent) / 100
    : Math.min(1, opts.maxEdge / Math.max(bm.width, bm.height)); // fit: downscale only
  const w = Math.max(1, Math.round(bm.width * scale));
  const h = Math.max(1, Math.round(bm.height * scale));
  const canvas = resample(bm, w, h);
  bm.close();
  const blob = await encodeCanvas(canvas, opts.format, opts.quality);
  canvas.width = 0; canvas.height = 0;
  const name = `${file.name.replace(/\.[^.]+$/, '')}-${w}x${h}.${opts.format}`;
  return { blob, name, before: file.size, after: blob.size };
}
