// Engine for /extract-images-from-pdf: walks a PDF's indirect objects with
// pdf-lib and pulls out every embedded raster image it can decode faithfully.
//  - DCTDecode (JPEG) streams ARE complete JPEG files — extracted byte-for-byte,
//    the exact original image at original quality, zero re-encoding.
//  - FlateDecode 8-bit RGB/Gray (incl. PNG predictors, incl. uncompressed raw)
//    — decoded to RGBA, with the image's SMask (soft transparency) composited
//    into the alpha channel, ready to save as a lossless PNG.
// Anything it can't decode faithfully (JPEG 2000, CCITT/JBIG2 fax scans,
// palette/CMYK colorspaces, filter chains) is reported in `unhandled` so the
// caller can recover those by decoding through pdf.js in the browser (see
// extract-images-tool.tsx). Streams referenced as another image's SMask/Mask
// are alpha data, not pictures, and are excluded from the output.
//
// Canvas-free on purpose: this module also runs headlessly in the Node QA
// harness (dev-harness/extract-qa.js) so extraction is provable without a
// browser. The inflate/predictor helpers mirror compress-tool's proven ones —
// kept separate so the battle-tested compress path stays untouched.

import type { PDFRawStream as RawStream, PDFContext, PDFRef as Ref } from 'pdf-lib';

export type RawImage =
  | { kind: 'jpeg'; bytes: Uint8Array; width: number; height: number }
  | { kind: 'rgba'; data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number; hasAlpha: boolean };

export type ExtractOutcome = {
  images: RawImage[];
  /** Dimensions of images we found but could not decode faithfully here. */
  unhandled: Array<{ width: number; height: number }>;
  pageCount: number;
};

// Below this (either side), an image is a spacer/bullet/border artifact —
// extracting it would bury the real pictures in junk.
const MIN_DIM = 24;

async function inflateDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null;
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

// Reverse PNG row predictors (DecodeParms /Predictor >= 10) so FlateDecode image
// samples become plain raster rows. Returns null on any inconsistency.
function pngUnfilter(data: Uint8Array, columns: number, rows: number, colors: number): Uint8Array | null {
  const stride = columns * colors;
  if (data.length < (stride + 1) * rows) return null;
  const out = new Uint8Array(stride * rows);
  let p = 0;
  for (let y = 0; y < rows; y++) {
    const ft = data[p++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const raw = data[p++];
      const a = x >= colors ? out[row + x - colors] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= colors && y > 0 ? out[prev + x - colors] : 0;
      let v: number;
      if (ft === 0) v = raw;
      else if (ft === 1) v = raw + a;
      else if (ft === 2) v = raw + b;
      else if (ft === 3) v = raw + ((a + b) >> 1);
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      out[row + x] = v & 255;
    }
  }
  return out;
}

export async function extractEmbeddedImages(
  bytes: Uint8Array,
  onStep?: () => void | Promise<void>,
): Promise<ExtractOutcome> {
  const { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFRef } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const ctx: PDFContext = doc.context;
  const all = ctx.enumerateIndirectObjects();

  const name = (s: string) => PDFName.of(s);
  const isImageStream = (obj: unknown): obj is RawStream =>
    obj instanceof PDFRawStream && String(obj.dict.get(name('Subtype'))) === '/Image';

  // Pass 1: collect the tags of streams used as SMask/Mask of other images.
  const maskTags = new Set<string>();
  for (const [, obj] of all) {
    if (!isImageStream(obj)) continue;
    for (const key of ['SMask', 'Mask'] as const) {
      const v = obj.dict.get(name(key));
      if (v instanceof PDFRef) maskTags.add(v.tag);
    }
  }

  // Only the colorspaces we can convert faithfully (3 = RGB, 1 = Gray);
  // anything exotic (Indexed/CMYK/Separation) goes to the pdf.js fallback.
  const channelsOf = (d: RawStream['dict']): 3 | 1 | null => {
    try {
      const cs = ctx.lookup(d.get(name('ColorSpace')));
      const s = String(cs);
      if (s === '/DeviceRGB') return 3;
      if (s === '/DeviceGray') return 1;
      if (cs instanceof PDFArray && String(cs.get(0)) === '/ICCBased') {
        const icc = ctx.lookup(cs.get(1));
        const n = icc instanceof PDFRawStream ? Number(icc.dict.get(name('N'))) : NaN;
        if (n === 3) return 3;
        if (n === 1) return 1;
      }
    } catch { /* fall through */ }
    return null;
  };

  // Decode a Flate (or unfiltered) image stream to plain raster samples.
  const decodeSamples = async (s: RawStream): Promise<{ samples: Uint8Array; w: number; h: number; channels: 3 | 1 } | null> => {
    const d = s.dict;
    if (Number(d.get(name('BitsPerComponent'))) !== 8) return null;
    if (d.get(name('Decode'))) return null; // custom decode arrays — punt
    const w = Number(d.get(name('Width'))) || 0;
    const h = Number(d.get(name('Height'))) || 0;
    const channels = channelsOf(d);
    if (!w || !h || !channels) return null;
    const filterObj = d.get(name('Filter'));
    const filter = filterObj ? String(filterObj) : '';
    let samples: Uint8Array | null;
    if (filter === '/FlateDecode') samples = await inflateDeflate(s.contents as Uint8Array);
    else if (filter === '') samples = s.contents as Uint8Array; // raw, uncompressed
    else return null;
    if (!samples) return null;
    const parms = ctx.lookup(d.get(name('DecodeParms')));
    if (parms) {
      const get = (k: string) => Number((parms as RawStream['dict']).get?.(name(k)) ?? NaN);
      const predictor = get('Predictor');
      if (Number.isNaN(predictor) || predictor === 1) { /* no prediction */ }
      else if (predictor >= 10) samples = pngUnfilter(samples, get('Columns') || w, h, get('Colors') || channels);
      else return null; // TIFF predictor — rare, punt
    }
    if (!samples || samples.length < w * h * channels) return null;
    return { samples, w, h, channels };
  };

  // Decode an image's SMask into an alpha map resampled (nearest-neighbour) to
  // the image's own dimensions. Null → treat as fully opaque.
  const alphaFor = async (d: RawStream['dict'], w: number, h: number): Promise<Uint8Array | null> => {
    const ref = d.get(name('SMask'));
    if (!ref) return null;
    const s = ctx.lookup(ref);
    if (!(s instanceof PDFRawStream)) return null;
    const dec = await decodeSamples(s);
    if (!dec || dec.channels !== 1) return null;
    const a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = Math.min(dec.h - 1, ((y * dec.h) / h) | 0);
      for (let x = 0; x < w; x++) {
        const sx = Math.min(dec.w - 1, ((x * dec.w) / w) | 0);
        a[y * w + x] = dec.samples[sy * dec.w + sx];
      }
    }
    return a;
  };

  const images: RawImage[] = [];
  const unhandled: Array<{ width: number; height: number }> = [];

  for (const [ref, obj] of all) {
    if (!isImageStream(obj)) continue;
    const d = obj.dict;
    if (d.get(name('ImageMask'))) continue; // stencil masks aren't pictures
    if (maskTags.has((ref as Ref).tag)) continue;
    const w = Number(d.get(name('Width'))) || 0;
    const h = Number(d.get(name('Height'))) || 0;
    if (w < MIN_DIM || h < MIN_DIM) continue;
    const filterObj = d.get(name('Filter'));
    const filter = filterObj ? String(filterObj) : '';
    try {
      if (filter === '/DCTDecode') {
        // The stream bytes ARE a complete JPEG file — the original image.
        images.push({ kind: 'jpeg', bytes: new Uint8Array(obj.contents as Uint8Array), width: w, height: h });
      } else {
        const dec = await decodeSamples(obj);
        if (dec) {
          const alpha = await alphaFor(d, w, h);
          const px = new Uint8ClampedArray(w * h * 4);
          let solid = true; // solid-colour patches (uniform RGB + alpha) aren't pictures — skip
          for (let i = 0, s = 0; i < w * h; i++) {
            if (dec.channels === 3) { px[i * 4] = dec.samples[s++]; px[i * 4 + 1] = dec.samples[s++]; px[i * 4 + 2] = dec.samples[s++]; }
            else { const g = dec.samples[s++]; px[i * 4] = g; px[i * 4 + 1] = g; px[i * 4 + 2] = g; }
            px[i * 4 + 3] = alpha ? alpha[i] : 255;
            if (solid && i > 0 && (px[i * 4] !== px[0] || px[i * 4 + 1] !== px[1] || px[i * 4 + 2] !== px[2] || px[i * 4 + 3] !== px[3])) solid = false;
          }
          if (!solid) images.push({ kind: 'rgba', data: px, width: w, height: h, hasAlpha: !!alpha });
        } else {
          unhandled.push({ width: w, height: h });
        }
      }
    } catch {
      unhandled.push({ width: w, height: h });
    }
    await onStep?.();
  }

  return { images, unhandled, pageCount: doc.getPageCount() };
}
