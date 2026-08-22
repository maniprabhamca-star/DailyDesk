'use client';

// Turn any image the user hands us into bytes pdf-lib can embed.
//
// pdf-lib itself only understands JPEG and PNG. Everything else — iPhone HEIC,
// Samsung "high efficiency" HEIF, WebP, AVIF, BMP, GIF, and JPEGs with encodings
// pdf-lib's parser rejects — has to be decoded and re-encoded first.
//
// Two rules shape this file:
//   1. A JPEG or PNG that pdf-lib accepts is embedded byte-for-byte. No canvas,
//      no re-compression, no quality loss. That is what /jpg-to-pdf promises.
//   2. Nothing fails silently. Every path either returns bytes or throws with a
//      sentence we can show the person who picked the file.

export type PdfImageBytes = { bytes: ArrayBuffer; kind: 'jpg' | 'png' };

// Everything here works on bytes already in memory, never on a File handle.
// A File picked on Android is backed by a content:// URI that the system can
// revoke once the <input> is cleared — read it later and you get a failure that
// looks exactly like an unreadable image. So callers read once, at pick time,
// and pass the bytes around afterwards.
export type SourceImage = { name: string; type: string; bytes: ArrayBuffer };

export function toSource(file: File, bytes: ArrayBuffer): SourceImage {
  return { name: file.name, type: file.type, bytes };
}

// What the bytes ACTUALLY are. Filenames and MIME types lie: Android's
// "high efficiency" camera mode and several share-sheets hand over HEIF data
// under a .jpg name with type image/jpeg. Trusting that label sent the file to
// pdf-lib's JPEG parser, which refused it, and then to an <img> tag, which
// cannot decode HEIF on Chrome — producing "this browser could not open it"
// for a photo that was perfectly convertible.
export type Sniffed = 'jpeg' | 'png' | 'heic' | 'avif' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'unknown';

export function sniffFormat(bytes: ArrayBuffer): Sniffed {
  const b = new Uint8Array(bytes, 0, Math.min(32, bytes.byteLength));
  const ascii = (from: number, to: number) => {
    let s = '';
    for (let i = from; i < to && i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)) return 'tiff';
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (/^(heic|heix|hevc|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand)) return 'heic';
    if (/^(avif|avis)$/.test(brand)) return 'avif';
  }
  return 'unknown';
}

// Kept for the name/type-only callers; prefer sniffing when bytes are to hand.
export function isHeic(f: { name: string; type: string; bytes?: ArrayBuffer }): boolean {
  if (f.bytes && f.bytes.byteLength >= 12) return sniffFormat(f.bytes) === 'heic';
  return /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

// Read a picked file immediately. Throws a sentence worth showing if the handle
// is already dead — which is the moment to say so, not ten seconds later.
export async function readPickedFile(file: File): Promise<ArrayBuffer> {
  try {
    const bytes = await file.arrayBuffer();
    if (!bytes.byteLength) throw new Error('empty');
    return bytes;
  } catch {
    throw new Error('the file could not be read — if it is in cloud storage, download it to the device first, then pick it again');
  }
}

export function looksLikeImage(f: { name: string; type: string }): boolean {
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|bmp|gif|heic|heif|tiff?)$/i.test(f.name);
}

// ---- libheif ----------------------------------------------------------------
// The same open-source libheif build /heic-to-jpg uses (LGPL-3.0, served as
// separate swappable files under /public/libheif/ with LICENSE.txt alongside).
// Loaded lazily via a script tag — the emscripten glue is UMD and fights
// bundlers — and only when a HEIC actually turns up, so the ~1MB wasm costs
// nothing for the people who never pick one.
type HeifImage = {
  get_width(): number;
  get_height(): number;
  display(target: ImageData, cb: (result: ImageData | null) => void): void;
  free?: () => void;
};
type LibheifModule = { HeifDecoder: new () => { decode(b: Uint8Array): HeifImage[] } };
type LibheifFactory = (opts: { wasmBinary: ArrayBuffer }) => LibheifModule & { ready?: Promise<unknown> };

let libheifPromise: Promise<LibheifModule> | null = null;
function getLibheif(): Promise<LibheifModule> {
  if (!libheifPromise) {
    libheifPromise = (async () => {
      await new Promise<void>((res, rej) => {
        if ((window as unknown as { libheif?: LibheifFactory }).libheif) return res();
        const s = document.createElement('script');
        s.src = '/libheif/libheif.js';
        s.onload = () => res();
        s.onerror = () => rej(new Error('Could not load the HEIC decoder.'));
        document.head.appendChild(s);
      });
      const wasmRes = await fetch('/libheif/libheif.wasm');
      if (!wasmRes.ok) throw new Error('Could not load the HEIC decoder.');
      const factory = (window as unknown as { libheif: LibheifFactory }).libheif;
      const mod = factory({ wasmBinary: await wasmRes.arrayBuffer() });
      if (mod.ready && typeof mod.ready.then === 'function') await mod.ready;
      if (typeof mod.HeifDecoder !== 'function') throw new Error('Could not start the HEIC decoder.');
      return mod;
    })();
    libheifPromise.catch(() => { libheifPromise = null; }); // don't cache a failure
  }
  return libheifPromise;
}

// ---- canvas limits ----------------------------------------------------------
// Mobile browsers cap canvas area far below desktop: iOS Safari refuses beyond
// ~16.7M pixels, and Chrome on a mid-range Android returns null from toBlob()
// long before that once the PNG encode buffer is counted. A 12MP phone photo
// re-encoded to PNG is ~36MB of pixel data — which is exactly how a perfectly
// good photo ended up reported as "could not be converted" on a phone.
// Nothing in a PDF page needs more than this.
const MAX_CANVAS_PIXELS = 12e6;

function fitWithin(w: number, h: number, maxPixels: number): [number, number] {
  const scale = Math.sqrt(maxPixels / (w * h));
  if (scale >= 1) return [w, h];
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

// ---- decode -----------------------------------------------------------------
type Decoded = { draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number; release: () => void };

async function decodeHeic(src: SourceImage): Promise<Decoded> {
  const lib = await getLibheif();
  const images = new lib.HeifDecoder().decode(new Uint8Array(src.bytes));
  if (!images.length) throw new Error('That HEIC file has no image in it.');
  const img = images[0]; // first image only — a PDF page is one picture
  const w = img.get_width();
  const h = img.get_height();
  if (!w || !h) { img.free?.(); throw new Error('That HEIC file reports no size.'); }
  const id = new ImageData(w, h);
  await new Promise<void>((res, rej) => img.display(id, (d) => (d ? res() : rej(new Error('Could not decode that HEIC photo.')))));
  img.free?.();
  return {
    w, h,
    // putImageData ignores transforms, so scaling needs a second canvas hop.
    draw: (ctx, dw, dh) => {
      if (dw === w && dh === h) { ctx.putImageData(id, 0, 0); return; }
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d');
      if (!tctx) throw new Error('This browser ran out of room to decode that photo.');
      tctx.putImageData(id, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tmp, 0, 0, dw, dh);
      tmp.width = tmp.height = 0;
    },
    release: () => {},
  };
}

async function decodeStandard(src: SourceImage): Promise<Decoded> {
  // Label the blob with what the bytes really are, not what the picker claimed.
  const sniffed = sniffFormat(src.bytes);
  const file = new Blob([src.bytes], {
    type: sniffed === 'unknown' ? (src.type || 'application/octet-stream') : `image/${sniffed}`,
  });
  let why = '';
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return {
        w: bmp.width, h: bmp.height,
        draw: (ctx, dw, dh) => { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, dw, dh); },
        release: () => bmp.close(),
      };
    } catch (e) {
      // Keep the reason. "Could not open it" is not a bug report.
      why = e instanceof Error ? e.name : '';
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const el = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(
        `this browser cannot decode ${sniffed === 'unknown' ? 'that file' : sniffed.toUpperCase()}` +
        `${why ? ` (${why})` : ''}${sniffed === 'unknown' ? ` — the first bytes do not match any image format we recognise` : ''}`,
      ));
      i.src = url;
    });
    const w = el.naturalWidth || el.width;
    const h = el.naturalHeight || el.height;
    if (!w || !h) throw new Error('That image reports no size.');
    return {
      w, h,
      draw: (ctx, dw, dh) => { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(el, 0, 0, dw, dh); },
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

// Decode, downscale if the canvas would be unreasonable, re-encode as JPEG.
// JPEG rather than PNG on purpose: a photo re-encoded to PNG is many times
// larger and is the encode most likely to fail outright on a phone.
export async function rasterize(src: SourceImage, opts: { maxPixels?: number; quality?: number } = {}): Promise<PdfImageBytes> {
  const dec = isHeic(src) ? await decodeHeic(src) : await decodeStandard(src);
  try {
    const [w, h] = fitWithin(dec.w, dec.h, opts.maxPixels ?? MAX_CANVAS_PIXELS);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser ran out of room to open that image.');
    // A JPEG has no transparency; flatten onto white so PNGs with alpha don't
    // come out with black boxes where they should be clear.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    dec.draw(ctx, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', opts.quality ?? 0.92));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('This browser ran out of memory re-encoding that image.');
    return { bytes: await blob.arrayBuffer(), kind: 'jpg' };
  } finally {
    dec.release();
  }
}

// ---- the entry point --------------------------------------------------------
// `embed` is pdf-lib's embedJpg/embedPng pair, and it is called EXACTLY ONCE.
// An earlier version "probed" with embedJpg and then embedded again on success,
// which quietly wrote every picture into the PDF twice and doubled the file.
export type ImageQuality = 'original' | 'balanced' | 'small';

// maxPixels caps resolution; quality is the JPEG setting. 'original' never
// re-encodes a JPEG/PNG pdf-lib already accepts.
const QUALITY: Record<Exclude<ImageQuality, 'original'>, { maxPixels: number; quality: number }> = {
  balanced: { maxPixels: 4.0e6, quality: 0.82 }, // ~2400x1700 — sharp text, small file
  small: { maxPixels: 1.6e6, quality: 0.7 },     // ~1500x1050 — email-friendly
};

export async function embedImageInPdf<T>(
  src: SourceImage,
  embed: { jpg: (b: ArrayBuffer) => Promise<T>; png: (b: ArrayBuffer) => Promise<T> },
  quality: ImageQuality = 'original',
): Promise<T> {
  const original = src.bytes;
  // Decide from the bytes, never the filename.
  const fmt = sniffFormat(original);
  const isPng = fmt === 'png';
  const isJpg = fmt === 'jpeg';
  // pdf-lib parses before it registers anything, so a refusal leaves no
  // half-written object behind and it is safe to fall through.
  const embedOriginal = isPng || isJpg
    ? async (bytes: ArrayBuffer) => (isPng ? embed.png(bytes) : embed.jpg(bytes))
    : null;

  if (quality === 'original' && embedOriginal) {
    try { return await embedOriginal(original); } catch { /* pdf-lib refused it — rasterize */ }
  }

  try {
    const { bytes, kind } = await rasterize(src, quality === 'original' ? {} : QUALITY[quality]);
    // Asking for a smaller file must never hand back a bigger one. Re-encoding
    // an already-small JPEG usually grows it, so keep whichever is smaller.
    if (quality !== 'original' && embedOriginal && bytes.byteLength >= original.byteLength) {
      try { return await embedOriginal(original); } catch { /* fall back to the re-encode */ }
    }
    return kind === 'png' ? embed.png(bytes) : embed.jpg(bytes);
  } catch (err) {
    // Rasterizing failed; the original may still be embeddable.
    if (embedOriginal) {
      try { return await embedOriginal(original); } catch { /* genuinely unusable */ }
    }
    throw err;
  }
}

// A short, honest sentence for the person who picked the file.
export function describeImageFailure(file: { name: string; type: string }, err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg && !/^(decode|encode|no-canvas|no-images|empty)$/.test(msg)) return `${file.name} — ${msg}`;
  if (isHeic(file)) return `${file.name} — the HEIC decoder could not read it.`;
  return `${file.name} — this browser could not open it.`;
}
