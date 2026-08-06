'use client';

// Pull the pictures out of a PDF *in reading order, page by page* — which the
// existing extract-images engine deliberately doesn't do (it walks the file's
// object table, so it can't say which page an image belonged to). An e-book
// needs the position, not just the picture.
//
// pdf.js publishes decoded images on `page.objs` while it builds a page's
// operator list. We read the list, pick out the paint-image operators in the
// order they're drawn, and pull each object out before the page is cleaned up.

import type { PdfHandle } from './pdf-render';

export type PageImage = {
  page: number;      // 0-based
  order: number;     // draw order within the page
  data: Uint8Array;
  mime: string;
  ext: string;
  w: number;
  h: number;
  /** Sampled from the decoded PIXELS, never the encoded bytes. pdf.js hands the
   *  same picture back as an ImageBitmap on a page that has been rendered and as
   *  raw samples everywhere else; those two paths encode to different JPEGs, so
   *  a byte-level fingerprint would see one logo as six different pictures. */
  fp: string;
};

/** Below this on either side it's a rule, a bullet, a spacer or a logo fragment —
 *  carrying those across would bury the real pictures in junk. */
const MIN_DIM = 64;

type PdfjsImage = {
  width?: number; height?: number; kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: CanvasImageSource & { width: number; height: number; close?: () => void };
};

type ObjStore = { get: (id: string, cb: (v: unknown) => void) => void; has?: (id: string) => boolean };
type PdfjsPageObjs = { objs: ObjStore; commonObjs?: ObjStore };

/** Resolve a decoded image by id.
 *
 *  A picture used on more than one page is published ONCE — sometimes on the
 *  page that first drew it, sometimes on the document-wide `commonObjs` store —
 *  so both are tried. The callback form never rejects and never fires for an
 *  object that isn't coming, hence the timeout: without it one shared letterhead
 *  would hang the conversion. */
function getObj(page: PdfjsPageObjs, id: string, ms = 1200): Promise<PdfjsImage | null> {
  const stores = [page.objs, page.commonObjs].filter(Boolean) as ObjStore[];
  // A store that already has it answers synchronously — the common case.
  for (const store of stores) {
    try {
      if (store.has?.(id)) {
        let v: unknown = null;
        store.get(id, (x) => { v = x; });
        if (v) return Promise.resolve(v as PdfjsImage);
      }
    } catch { /* try the next store */ }
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: PdfjsImage | null) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), ms);
    for (const store of stores) {
      try {
        store.get(id, (v: unknown) => { clearTimeout(timer); finish((v as PdfjsImage) ?? null); });
      } catch { /* keep waiting on the other store */ }
    }
  });
}

/** pdf.js hands back either an ImageBitmap or raw samples in one of three
 *  layouts. Everything ends up as a white-backed JPEG: e-book pictures are
 *  photos and diagrams, and a JPEG keeps the book a sane size. */
async function toJpeg(img: PdfjsImage): Promise<{ data: Uint8Array; w: number; h: number; fp: string } | null> {
  const w = img.bitmap?.width ?? img.width ?? 0;
  const h = img.bitmap?.height ?? img.height ?? 0;
  if (w < MIN_DIM || h < MIN_DIM) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const src = img.data;
    const out = ctx.createImageData(w, h);
    const d = out.data;
    if (img.kind === 3 && src.length >= w * h * 4) {        // RGBA_32BPP
      d.set(src.subarray(0, w * h * 4));
    } else if (img.kind === 2 && src.length >= w * h * 3) {  // RGB_24BPP
      for (let p = 0, s = 0; p < d.length; p += 4, s += 3) {
        d[p] = src[s]; d[p + 1] = src[s + 1]; d[p + 2] = src[s + 2]; d[p + 3] = 255;
      }
    } else if (img.kind === 1) {                             // GRAYSCALE_1BPP (packed)
      const stride = (w + 7) >> 3;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const bit = (src[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
          const v = bit ? 255 : 0;
          const p = (y * w + x) * 4;
          d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
        }
      }
    } else {
      return null; // a layout we can't read faithfully — better nothing than garbage
    }
    // Composite over the white fill so any transparency lands on white, not black.
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d')!.putImageData(out, 0, 0);
    ctx.drawImage(tmp, 0, 0);
    tmp.width = 0; tmp.height = 0;
  } else {
    return null;
  }

  const fp = fingerprint(canvas);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) return null;
  return { data: new Uint8Array(await blob.arrayBuffer()), w, h, fp };
}

/** Content fingerprint: the picture squashed to a 12×12 thumbnail with each
 *  channel quantised to 4 bits.
 *
 *  It has to be tolerant, not exact. pdf.js returns the SAME picture as an
 *  ImageBitmap on a page that has already been rendered (the cover) and as raw
 *  samples everywhere else, and those two paths differ by a shade here and
 *  there — enough that any exact hash sees one letterhead as two different
 *  pictures and leaves one of them in the book. */
function fingerprint(source: HTMLCanvasElement): string {
  const N = 12;
  try {
    const small = document.createElement('canvas');
    small.width = N;
    small.height = N;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    if (!sctx) return 'unreadable';
    sctx.drawImage(source, 0, 0, N, N);
    const d = sctx.getImageData(0, 0, N, N).data;
    let out = '';
    for (let i = 0; i < d.length; i += 4) {
      out += ((d[i] >> 4).toString(16) + (d[i + 1] >> 4).toString(16) + (d[i + 2] >> 4).toString(16));
    }
    small.width = 0;
    small.height = 0;
    return out;
  } catch {
    return 'unreadable';
  }
}

export type PageImagesOptions = {
  maxImages?: number;
  maxBytes?: number;
  signal?: AbortSignal;
};

/** Images drawn on ONE page, in draw order. Call it before the page is cleaned
 *  up — pdf.js drops the decoded objects at that point. */
export type ImageCache = Map<string, { data: Uint8Array; w: number; h: number; fp: string } | null>;

export async function imagesOnPage(
  page: unknown,
  pageIndex: number,
  OPS: Record<string, number>,
  /** Shared across the whole document. pdf.js gives a re-used picture the SAME
   *  object id on every page, but only publishes it on `objs` of the page that
   *  first drew it — so without this a letterhead resolves once, stalls on every
   *  later page waiting for an object that will never arrive, and then looks
   *  like a one-off picture instead of the page furniture it is. */
  cache: ImageCache = new Map(),
): Promise<PageImage[]> {
  const p = page as PdfjsPageObjs & {
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  };
  let list: { fnArray: number[]; argsArray: unknown[][] };
  try {
    list = await p.getOperatorList();
  } catch {
    return []; // a page we can't decode shouldn't sink the book
  }
  const paint = new Set([OPS.paintImageXObject, OPS.paintJpegXObject, OPS.paintImageXObjectRepeat].filter((n) => typeof n === 'number'));
  const names: string[] = [];
  for (let i = 0; i < list.fnArray.length; i++) {
    if (!paint.has(list.fnArray[i])) continue;
    const id = list.argsArray[i]?.[0];
    if (typeof id === 'string' && !names.includes(id)) names.push(id);
  }

  const out: PageImage[] = [];
  for (let n = 0; n < names.length; n++) {
    const id = names[n];
    let jpeg = cache.get(id);
    if (jpeg === undefined) {
      const obj = await getObj(p, id);
      jpeg = obj ? await toJpeg(obj) : null;
      obj?.bitmap?.close?.();
      cache.set(id, jpeg);
    }
    if (!jpeg) continue;
    out.push({ page: pageIndex, order: n, data: jpeg.data, mime: 'image/jpeg', ext: 'jpg', w: jpeg.w, h: jpeg.h, fp: jpeg.fp });
  }
  return out;
}

/** Drop the pictures that are page furniture, not content: the same image
 *  repeating across half the pages is a letterhead or a logo. */
export function dropRepeatedImages(images: PageImage[], pageCount: number): PageImage[] {
  if (pageCount < 4) return images;
  const seen = new Map<string, Set<number>>();
  images.forEach((im) => {
    const pages = seen.get(im.fp) ?? new Set<number>();
    pages.add(im.page);
    seen.set(im.fp, pages);
  });
  return images.filter((im) => (seen.get(im.fp)?.size ?? 0) < pageCount / 2);
}

/** Keep a book from becoming a 300MB download on a phone. */
export function capImages(images: PageImage[], opts: PageImagesOptions = {}): { kept: PageImage[]; dropped: number } {
  const maxImages = opts.maxImages ?? 300;
  const maxBytes = opts.maxBytes ?? 60 * 1024 * 1024;
  const kept: PageImage[] = [];
  let bytes = 0;
  for (const im of images) {
    if (kept.length >= maxImages || bytes + im.data.length > maxBytes) break;
    kept.push(im);
    bytes += im.data.length;
  }
  return { kept, dropped: images.length - kept.length };
}

export type { PdfHandle };
