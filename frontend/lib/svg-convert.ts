'use client';

// SVG → PNG / JPG / PDF, on-device.
//
// The browser can already draw an SVG, so we don't ship a renderer. Two things
// have to be handled first, and both are why naive versions produce a blank
// image:
//   1. An SVG with only a viewBox and no width/height renders at zero size in
//      several browsers when loaded through <img>. We read the viewBox and put
//      explicit dimensions on before drawing.
//   2. An <img> refuses to load an SVG that carries external references, and
//      scripts inside it never run in that context — but we also strip scripts
//      and event handlers before the file goes anywhere near a preview.

export type SvgFormat = 'png' | 'jpg' | 'pdf';

export type SvgSize = { width: number; height: number; fromViewBox: boolean };

const NUM = '[-+]?[0-9]*\\.?[0-9]+';

/** Strip anything executable. The output is only ever rasterised, but an SVG is
 *  XML that a browser will happily treat as a document, so this is cheap
 *  insurance against a hostile file. */
export function sanitizeSvg(source: string): string {
  return source
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*script[^>]*\/\s*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '');
}

/** The SVG's own size, from width/height if it has them, else the viewBox. */
export function readSvgSize(source: string): SvgSize | null {
  const tag = source.match(/<svg[^>]*>/i)?.[0];
  if (!tag) return null;
  const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
  const px = (v?: string) => {
    if (!v) return 0;
    const m = v.match(new RegExp(`^(${NUM})\\s*(px)?$`));
    return m ? Number(m[1]) : 0;
  };
  const w = px(attr('width'));
  const h = px(attr('height'));
  if (w > 0 && h > 0) return { width: w, height: h, fromViewBox: false };

  const vb = attr('viewBox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3], fromViewBox: true };
    }
  }
  return null;
}

/** Force explicit pixel dimensions onto the root <svg> so every browser draws
 *  it at the size we asked for. */
export function withExplicitSize(source: string, width: number, height: number): string {
  const tag = source.match(/<svg[^>]*>/i)?.[0];
  if (!tag) return source;
  const cleaned = tag
    .replace(/\swidth\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\sheight\s*=\s*["'][^"']*["']/gi, '');
  const withSize = cleaned.replace(/^<svg/i, `<svg width="${width}" height="${height}"`);
  return source.replace(tag, withSize);
}

async function drawToCanvas(source: string, width: number, height: number, background: string | null): Promise<HTMLCanvasElement> {
  const svg = withExplicitSize(sanitizeSvg(source), width, height);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('That SVG could not be drawn. If it links to an external image or font, inline those first.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context.');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type SvgOptions = {
  format: SvgFormat;
  width: number;        // output pixels (height follows the aspect ratio)
  quality: number;      // JPG only, 0–1
  transparent: boolean; // PNG only; JPG and PDF always get a white ground
};

export type SvgResult = { blob: Blob; name: string; width: number; height: number };

const stem = (n: string) => n.replace(/\.svg$/i, '') || 'image';

export async function convertSvg(file: File, source: string, opts: SvgOptions): Promise<SvgResult> {
  const size = readSvgSize(source);
  if (!size) throw new Error('That file doesn’t look like an SVG — no <svg> tag with a size or viewBox in it.');

  const ratio = size.height / size.width;
  const width = Math.max(1, Math.min(8000, Math.round(opts.width)));
  const height = Math.max(1, Math.round(width * ratio));
  const wantsAlpha = opts.format === 'png' && opts.transparent;
  const canvas = await drawToCanvas(source, width, height, wantsAlpha ? null : '#ffffff');

  if (opts.format === 'pdf') {
    const { PDFDocument } = await import('pdf-lib');
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!png) throw new Error('Could not encode the image.');
    const doc = await PDFDocument.create();
    doc.setTitle(stem(file.name));
    doc.setProducer('DiemDesk — generated on your device');
    const img = await doc.embedPng(await png.arrayBuffer());
    // The page takes the SVG's own dimensions as points, so a 400×300 drawing
    // becomes a 400×300pt page rather than being stretched onto A4.
    const page = doc.addPage([size.width, size.height]);
    page.drawImage(img, { x: 0, y: 0, width: size.width, height: size.height });
    const bytes = await doc.save();
    return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), name: `${stem(file.name)}.pdf`, width, height };
  }

  const type = opts.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, opts.format === 'jpg' ? opts.quality : undefined));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('Could not encode the image.');
  return { blob, name: `${stem(file.name)}.${opts.format === 'png' ? 'png' : 'jpg'}`, width, height };
}
