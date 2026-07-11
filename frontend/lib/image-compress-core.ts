// Headless, reusable image-compression core — the SAME on-device pipeline the
// Compress Image tool runs for a single file, extracted so it can be looped over
// many files by the BatchRunner (Pro on-device batch). Decode → optional
// downscale → mozjpeg re-encode (native-canvas fallback) → never bigger.
import { encodeJpeg } from './mozjpeg';

export type ImgLevel = 'light' | 'recommended' | 'strong';
export type ImgResize = 'original' | '2560' | '1920' | '1280';

// Quality numbers must match the Compress Image tool's LEVELS.q.
export const IMG_QUALITY: Record<ImgLevel, number> = { light: 82, recommended: 72, strong: 55 };
const HARD_MAX_DIM = 8000; // never-hang clamp (a 100MP canvas OOMs low-RAM phones)

export async function decodeImage(f: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(f); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(f);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('decode'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type CompressedImage = { blob: Blob; name: string; before: number; after: number; w: number; h: number; optimized: boolean };

export async function compressImageFile(file: File, opts: { level: ImgLevel; resize: ImgResize }): Promise<CompressedImage> {
  const q = IMG_QUALITY[opts.level];
  const bmp = await decodeImage(file);
  const maxDim = Math.min(opts.resize === 'original' ? HARD_MAX_DIM : parseInt(opts.resize, 10), HARD_MAX_DIM);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Your browser blocked canvas access.');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.fillStyle = '#ffffff'; // JPEG has no alpha — flatten transparency to white
  cx.fillRect(0, 0, w, h);
  cx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
  (bmp as ImageBitmap).close?.();

  let blob: Blob;
  try {
    blob = await encodeJpeg(cx.getImageData(0, 0, w, h), q);
  } catch {
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q / 100));
  }
  canvas.width = 0; canvas.height = 0;

  // Never hand back a bigger file (when the user didn't ask for a resize).
  if (blob.size >= file.size && scale === 1) {
    return { blob: file, name: file.name, before: file.size, after: file.size, w, h, optimized: true };
  }
  const name = `${file.name.replace(/\.(jpe?g|png|webp)$/i, '')}-compressed.jpg`;
  return { blob, name, before: file.size, after: blob.size, w, h, optimized: false };
}
