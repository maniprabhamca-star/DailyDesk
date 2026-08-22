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

export function isHeic(f: File): boolean {
  return /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

export function looksLikeImage(f: File): boolean {
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

async function decodeHeic(file: File): Promise<Decoded> {
  const lib = await getLibheif();
  const images = new lib.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
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

async function decodeStandard(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return {
        w: bmp.width, h: bmp.height,
        draw: (ctx, dw, dh) => { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, dw, dh); },
        release: () => bmp.close(),
      };
    } catch { /* fall through — some browsers refuse animated or exotic files here */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const el = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This browser cannot open that image format.'));
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
export async function rasterize(file: File, opts: { maxPixels?: number; quality?: number } = {}): Promise<PdfImageBytes> {
  const dec = isHeic(file) ? await decodeHeic(file) : await decodeStandard(file);
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
  file: File,
  embed: { jpg: (b: ArrayBuffer) => Promise<T>; png: (b: ArrayBuffer) => Promise<T> },
  quality: ImageQuality = 'original',
): Promise<T> {
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  const isJpg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  // pdf-lib parses before it registers anything, so a refusal leaves no
  // half-written object behind and it is safe to fall through.
  const embedOriginal = !isHeic(file) && (isPng || isJpg)
    ? async (bytes: ArrayBuffer) => (isPng ? embed.png(bytes) : embed.jpg(bytes))
    : null;

  let original: ArrayBuffer | null = null;
  if (embedOriginal) { try { original = await file.arrayBuffer(); } catch { /* unreadable */ } }

  if (quality === 'original' && embedOriginal && original) {
    try { return await embedOriginal(original); } catch { /* pdf-lib refused it — rasterize */ }
  }

  try {
    const { bytes, kind } = await rasterize(file, quality === 'original' ? {} : QUALITY[quality]);
    // Asking for a smaller file must never hand back a bigger one. Re-encoding
    // an already-small JPEG usually grows it, so keep whichever is smaller.
    if (quality !== 'original' && embedOriginal && original && bytes.byteLength >= original.byteLength) {
      try { return await embedOriginal(original); } catch { /* fall back to the re-encode */ }
    }
    return kind === 'png' ? embed.png(bytes) : embed.jpg(bytes);
  } catch (err) {
    // Rasterizing failed; the original may still be embeddable.
    if (embedOriginal && original) {
      try { return await embedOriginal(original); } catch { /* genuinely unusable */ }
    }
    throw err;
  }
}

// A short, honest sentence for the person who picked the file.
export function describeImageFailure(file: File, err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg && !/^(decode|encode|no-canvas|no-images)$/.test(msg)) return `${file.name} — ${msg}`;
  if (isHeic(file)) return `${file.name} — the HEIC decoder could not read it.`;
  return `${file.name} — this browser could not open it.`;
}
