// Lightweight, self-contained PDF compressor for the HOME hero's live demo.
// It's a genuine on-device compression — a subset of the real Compress tool's
// "surgical" pass (re-encode oversized embedded JPEGs at a modest quality +
// strip document metadata) — kept deliberately small so it can be lazy-loaded
// on first drop without weighing down the homepage. Everything runs in the
// browser; the file is never uploaded. Not a replacement for /compress-pdf
// (no scan-page rasterisation / levels); it exists to prove the point live.
import type { PDFRawStream as RawStreamT } from 'pdf-lib';
import { encodeJpeg } from './mozjpeg';
import { stripDocMetadata } from './pdf-sanitize';

export type HeroCompressResult = { blob: Blob; before: number; after: number; savedPct: number; images: number };

const CAP = 1600; // long-edge cap for re-encoded images (px)
const QUALITY = 68; // mozjpeg quality 0-100

/** Re-encode embedded JPEGs + strip metadata, fully client-side. Guarantees the
 * result is never larger than the input (falls back to the original bytes). */
export async function heroCompress(file: File): Promise<HeroCompressResult> {
  const before = file.size;
  const original = new Uint8Array(await file.arrayBuffer());
  const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = await import('pdf-lib');
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const ctx = doc.context;

  const isJpegImage = (obj: unknown): boolean => {
    if (!(obj instanceof PDFRawStream)) return false;
    const d = obj.dict;
    if (String(d.get(PDFName.of('Subtype'))) !== '/Image') return false;
    if (d.get(PDFName.of('ImageMask'))) return false;
    return String(d.get(PDFName.of('Filter'))) === '/DCTDecode';
  };

  let images = 0;
  for (const [ref, rawObj] of ctx.enumerateIndirectObjects()) {
    if (!isJpegImage(rawObj)) continue;
    try {
      const obj = rawObj as RawStreamT;
      const d = obj.dict;
      const w = Number(d.get(PDFName.of('Width')));
      const h = Number(d.get(PDFName.of('Height')));
      const raw = obj.contents as Uint8Array;
      if (!w || !h || raw.length < 3000) continue; // tiny image — skip
      if (typeof createImageBitmap !== 'function') break; // needs bitmap decode

      const bmp = await createImageBitmap(new Blob([new Uint8Array(raw)], { type: 'image/jpeg' }));
      const scale = Math.min(1, CAP / Math.max(w, h));
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      const cx = canvas.getContext('2d');
      if (!cx) { bmp.close?.(); continue; }
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, nw, nh);
      cx.drawImage(bmp, 0, 0, nw, nh);
      bmp.close?.();
      const imageData = cx.getImageData(0, 0, nw, nh);
      const outBytes = new Uint8Array(await (await encodeJpeg(imageData, QUALITY)).arrayBuffer());
      canvas.width = 0; canvas.height = 0;

      if (outBytes.length < raw.length * 0.92) {
        const ns = PDFRawStream.of(d, outBytes);
        ns.dict.set(PDFName.of('Width'), PDFNumber.of(nw));
        ns.dict.set(PDFName.of('Height'), PDFNumber.of(nh));
        ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        ns.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
        ns.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        ns.dict.delete(PDFName.of('DecodeParms'));
        ns.dict.delete(PDFName.of('Decode'));
        ctx.assign(ref, ns);
        images++;
      }
    } catch { /* leave this image untouched on any error */ }
  }

  try { await stripDocMetadata(doc); } catch { /* best-effort */ }
  const saved = await doc.save({ useObjectStreams: true });

  // Never hand back something bigger than the original.
  const smaller = saved.length < before;
  const after = smaller ? saved.length : before;
  const blob = new Blob([new Uint8Array(smaller ? saved : original)], { type: 'application/pdf' });
  const savedPct = before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
  return { blob, before, after, savedPct, images };
}
