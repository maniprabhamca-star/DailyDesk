// Compress-to-target-size engine — hit an exact byte ceiling (an exam/visa/court
// portal limit, an email cap) for images AND PDFs, fully on-device. Reuses the
// app's proven cores: the mozjpeg encoder for images and lib/pdf-rasterize for
// PDFs. We search the quality/resolution knob for the HIGHEST fidelity that still
// lands under the target — so the result is as good as the limit allows.
import { decodeImage } from './image-compress-core';
import { encodeJpeg } from './mozjpeg';
import { rasterizePdf } from './pdf-rasterize';

export type TargetResult = {
  blob: Blob;
  name: string;
  before: number;
  after: number;
  reached: boolean;   // false = target was too small; this is the smallest we could make
  unchanged?: boolean; // true = file was already under the target, returned as-is
};

function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

// Throw an AbortError the caller can recognise (Cancel button → aborts the run).
function ckAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

// ---------------------------------------------------------------- IMAGE -------
// Binary-search JPEG quality at full size; if even low quality is still too big,
// step the dimensions down a ladder and search again. Favours resolution first
// (largest size that can meet the target), then the best quality at that size.
export async function compressImageToTarget(
  file: File,
  targetBytes: number,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<TargetResult> {
  const before = file.size;
  if (before <= targetBytes) {
    return { blob: file, name: file.name, before, after: before, reached: true, unchanged: true };
  }
  const bmp = await decodeImage(file);
  const ow = (bmp as { width: number }).width;
  const oh = (bmp as { height: number }).height;
  const SCALES = [1, 0.85, 0.72, 0.6, 0.5, 0.4, 0.32, 0.24, 0.18, 0.12];
  const Q_MIN = 30;
  const Q_MAX = 92;

  const render = async (scale: number, q: number): Promise<Blob> => {
    const w = Math.max(1, Math.round(ow * scale));
    const h = Math.max(1, Math.round(oh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const cx = canvas.getContext('2d');
    if (!cx) throw new Error('Your browser blocked canvas access.');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.fillStyle = '#ffffff'; // JPEG has no alpha — flatten transparency to white
    cx.fillRect(0, 0, w, h);
    cx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
    let blob: Blob;
    try {
      blob = await encodeJpeg(cx.getImageData(0, 0, w, h), q);
    } catch {
      blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q / 100));
    }
    canvas.width = 0; canvas.height = 0;
    return blob;
  };

  try {
    let smallest: Blob | null = null;
    const name = `${baseName(file.name)}-compressed.jpg`;
    for (let i = 0; i < SCALES.length; i++) {
      ckAbort(signal);
      const scale = SCALES[i];
      onProgress?.(`Fitting the target… (${Math.round(scale * 100)}%)`);
      const low = await render(scale, Q_MIN);
      if (!smallest || low.size < smallest.size) smallest = low;
      if (low.size > targetBytes) continue; // still too big at this size — go smaller
      // Lowest quality fits at this scale → binary-search the highest quality that fits.
      let lo = Q_MIN + 1, hi = Q_MAX, fit = low, fitScaleUsed = scale;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const b = await render(scale, mid);
        if (b.size <= targetBytes) { fit = b; lo = mid + 1; } else hi = mid - 1;
      }
      void fitScaleUsed;
      return { blob: fit, name, before, after: fit.size, reached: true };
    }
    // Never fit, even at the smallest size — hand back the smallest we produced.
    return { blob: smallest!, name, before, after: smallest!.size, reached: false };
  } finally {
    (bmp as ImageBitmap).close?.();
  }
}

// ------------------------------------------------------------------ PDF -------
// 1) Try a lossless re-save (object streams) — keeps text selectable; often enough
//    for a PDF that's only slightly over. 2) If not, rasterise pages at a
//    descending DPI/quality ladder and binary-search the highest rung that fits.
const PDF_LADDER: { dpi: number; quality: number }[] = [
  { dpi: 200, quality: 82 },
  { dpi: 150, quality: 75 },
  { dpi: 120, quality: 66 },
  { dpi: 100, quality: 58 },
  { dpi: 84, quality: 50 },
  { dpi: 70, quality: 44 },
  { dpi: 58, quality: 38 },
  { dpi: 48, quality: 34 },
  { dpi: 40, quality: 30 },
];

export async function compressPdfToTarget(
  file: File,
  targetBytes: number,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<TargetResult> {
  const before = file.size;
  if (before <= targetBytes) {
    return { blob: file, name: file.name, before, after: before, reached: true, unchanged: true };
  }

  const name = `${baseName(file.name)}-compressed.pdf`;

  // 1) Lossless-ish: rewrite with object streams (preserves text). Cheap; try first.
  onProgress?.('Optimizing…');
  try {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
    const saved = await doc.save({ useObjectStreams: true });
    if (saved.byteLength <= targetBytes && saved.byteLength < before) {
      return { blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }), name, before, after: saved.byteLength, reached: true };
    }
  } catch { /* fall through to rasterise */ }

  // 2) Rasterise-seek: monotonic (higher rung = larger file), so binary-search the
  //    smallest index (= highest fidelity) whose output is still under the target.
  const cache = new Map<number, Uint8Array>();
  const sizeAt = async (i: number): Promise<Uint8Array> => {
    ckAbort(signal);
    if (!cache.has(i)) {
      const dpi = PDF_LADDER[i].dpi;
      cache.set(i, await rasterizePdf(file, PDF_LADDER[i], (done, total) => onProgress?.(`Compressing at ${dpi} DPI · page ${done}/${total}`), signal));
    }
    return cache.get(i)!;
  };

  // Fast-path the impossible case: if even the lowest rung (40 DPI) can't fit, the
  // target is out of reach — hand that back after ONE render instead of grinding
  // through the whole ladder. (e.g. a 27 MB multi-page scan asked for 200 KB.)
  const last = PDF_LADDER.length - 1;
  const smallest = await sizeAt(last);
  if (smallest.byteLength > targetBytes) {
    return { blob: new Blob([new Uint8Array(smallest)], { type: 'application/pdf' }), name, before, after: smallest.byteLength, reached: false };
  }
  // Reachable — binary-search the highest-fidelity rung that still fits under it.
  let lo = 0, hi = last, ans = last;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const out = await sizeAt(mid);
    if (out.byteLength <= targetBytes) { ans = mid; hi = mid - 1; } else lo = mid + 1;
  }
  const out = await sizeAt(ans);
  return { blob: new Blob([new Uint8Array(out)], { type: 'application/pdf' }), name, before, after: out.byteLength, reached: true };
}

// ---------------------------------------------------------------- SHARED ------
export function isPdfFile(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}
export function isImageFile(f: File): boolean {
  return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);
}
