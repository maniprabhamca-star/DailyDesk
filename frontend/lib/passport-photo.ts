// Passport-photo engine — all on-device. Renders the user's crop into the exact
// pixel size a country requires, optionally swapping the background (reusing our
// background remover), hitting the file-size cap, and tiling a print sheet.
import { encodeJpeg } from './mozjpeg';
import { removeBackground, type BgProgress } from './remove-bg';
import type { PassportSpec } from './passport-specs';

// Crop rectangle in SOURCE-image pixels that maps to the whole output frame.
export type Crop = { sx: number; sy: number; sw: number; sh: number };

async function encodeToCap(data: ImageData, maxKB?: number): Promise<Blob> {
  if (!maxKB) return encodeJpeg(data, 92);
  const cap = maxKB * 1024;
  const low = await encodeJpeg(data, 40);
  if (low.size > cap) return low; // can't get under — hand back the smallest
  let lo = 41, hi = 95, best = low;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = await encodeJpeg(data, mid);
    if (b.size <= cap) { best = b; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

// Cut the subject out on-device → a transparent bitmap we can drop on any bg.
export async function prepareCutout(file: File, onProgress?: (p: BgProgress) => void): Promise<ImageBitmap> {
  const { png } = await removeBackground(file, onProgress);
  return createImageBitmap(png);
}

export async function renderPassport(opts: { source: CanvasImageSource; spec: PassportSpec; crop: Crop; bg: string }): Promise<Blob> {
  const { source, spec, crop, bg } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = spec.wPx; canvas.height = spec.hPx;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Your browser blocked canvas access.');
  cx.fillStyle = bg || '#ffffff';
  cx.fillRect(0, 0, spec.wPx, spec.hPx); // shows through where the cutout is transparent
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, spec.wPx, spec.hPx);
  const data = cx.getImageData(0, 0, spec.wPx, spec.hPx);
  canvas.width = 0; canvas.height = 0;
  return encodeToCap(data, spec.maxKB);
}

// A 4×6 in print sheet (1200×1800 @ 300 DPI) tiled with as many copies as fit at
// the photo's true physical size, with light cut guides.
export async function buildPrintSheet(photo: Blob, spec: PassportSpec): Promise<{ blob: Blob; copies: number }> {
  const bmp = await createImageBitmap(photo);
  const SW = 1200, SH = 1800, gap = 18, margin = 30;
  const cols = Math.max(1, Math.floor((SW - 2 * margin + gap) / (spec.wPx + gap)));
  const rows = Math.max(1, Math.floor((SH - 2 * margin + gap) / (spec.hPx + gap)));
  const gridW = cols * spec.wPx + (cols - 1) * gap;
  const gridH = rows * spec.hPx + (rows - 1) * gap;
  const offX = Math.round((SW - gridW) / 2), offY = Math.round((SH - gridH) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = SW; canvas.height = SH;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('Your browser blocked canvas access.');
  cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, SW, SH);
  cx.imageSmoothingQuality = 'high';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offX + c * (spec.wPx + gap), y = offY + r * (spec.hPx + gap);
      cx.drawImage(bmp, x, y, spec.wPx, spec.hPx);
      cx.strokeStyle = '#cfcfcf'; cx.lineWidth = 1;
      cx.strokeRect(x + 0.5, y + 0.5, spec.wPx, spec.hPx);
    }
  }
  bmp.close?.();
  const data = cx.getImageData(0, 0, SW, SH);
  canvas.width = 0; canvas.height = 0;
  return { blob: await encodeJpeg(data, 92), copies: rows * cols };
}
