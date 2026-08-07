'use client';

// A favicon set from one picture: the PNG sizes browsers and phones ask for,
// a real multi-size .ico for the old requests that still hit /favicon.ico, a
// web manifest, and the HTML to paste. All made on-device.

import { decodeImage, resample } from './image-convert';

export type FaviconOptions = {
  background: string | null; // null = keep transparency (PNG only)
  padding: number;           // 0–0.3 of the canvas, breathing room for a tight logo
  rounded: boolean;          // mask to a squircle-ish circle, for avatar-style marks
  appName: string;
  themeColor: string;
};

export const DEFAULT_FAVICON_OPTIONS: FaviconOptions = {
  background: null,
  padding: 0,
  rounded: false,
  appName: 'My site',
  themeColor: '#111111',
};

/** What actually gets requested in 2026 — not the twenty-file sets of a decade
 *  ago. Each one has a real consumer, named so nobody wonders what it's for. */
export const FAVICON_SIZES: { size: number; file: string; why: string }[] = [
  { size: 16, file: 'favicon-16x16.png', why: 'browser tab' },
  { size: 32, file: 'favicon-32x32.png', why: 'tab on a high-density screen' },
  { size: 48, file: 'favicon-48x48.png', why: 'Windows taskbar and shortcuts' },
  { size: 180, file: 'apple-touch-icon.png', why: 'iPhone and iPad home screen' },
  { size: 192, file: 'android-chrome-192x192.png', why: 'Android home screen' },
  { size: 512, file: 'android-chrome-512x512.png', why: 'Android splash screen' },
];

const ICO_SIZES = [16, 32, 48];

function square(src: CanvasImageSource & { width: number; height: number }, size: number, opts: FaviconOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  if (opts.background) {
    ctx.fillStyle = opts.background;
    if (opts.rounded) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, size, size);
    }
  }
  if (opts.rounded) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  // Contain, never crop: a logo that gets its edges cut off is worse than one
  // with a little space around it.
  const pad = Math.round(size * Math.min(0.3, Math.max(0, opts.padding)));
  const box = size - pad * 2;
  const scale = Math.min(box / src.width, box / src.height);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const stepped = resample(src, w, h); // high-quality downscale, not a raw drawImage
  ctx.drawImage(stepped, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
  if (opts.rounded) ctx.restore();
  return canvas;
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))) : reject(new Error('Could not encode the icon.'))), 'image/png'),
  );

/** An .ico is a small header plus whole image files. PNG-in-ICO has been
 *  supported since Vista, so we embed the PNGs we already made rather than
 *  writing BMP data. */
export function buildIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const count = images.length;
  const header = 6;
  const dirSize = 16 * count;
  const total = header + dirSize + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true);      // reserved
  view.setUint16(2, 1, true);      // type: icon
  view.setUint16(4, count, true);

  let offset = header + dirSize;
  images.forEach((img, i) => {
    const at = header + i * 16;
    out[at] = img.size >= 256 ? 0 : img.size;      // 0 means 256
    out[at + 1] = img.size >= 256 ? 0 : img.size;
    out[at + 2] = 0;                                // palette
    out[at + 3] = 0;                                // reserved
    view.setUint16(at + 4, 1, true);                // colour planes
    view.setUint16(at + 6, 32, true);               // bits per pixel
    view.setUint32(at + 8, img.png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

export function manifestJson(opts: FaviconOptions): string {
  return JSON.stringify({
    name: opts.appName,
    short_name: opts.appName.slice(0, 12),
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    theme_color: opts.themeColor,
    background_color: '#ffffff',
    display: 'standalone',
  }, null, 2);
}

export const HTML_SNIPPET = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

export type FaviconPack = {
  zip: Blob;
  previews: { size: number; file: string; why: string; url: string }[];
  count: number;
};

export async function buildFaviconPack(file: File, opts: FaviconOptions): Promise<FaviconPack> {
  const bitmap = await decodeImage(file);
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const previews: FaviconPack['previews'] = [];
  const icoParts: { size: number; png: Uint8Array }[] = [];

  for (const { size, file: name, why } of FAVICON_SIZES) {
    const canvas = square(bitmap, size, opts);
    const png = await toPng(canvas);
    zip.file(name, png);
    previews.push({ size, file: name, why, url: URL.createObjectURL(new Blob([png.slice()], { type: 'image/png' })) });
    if (ICO_SIZES.includes(size)) icoParts.push({ size, png });
    canvas.width = 0;
    canvas.height = 0;
  }

  zip.file('favicon.ico', buildIco(icoParts));
  zip.file('site.webmanifest', manifestJson(opts));
  zip.file('README.txt', `Drop these files in the ROOT of your site, then paste this into <head>:\n\n${HTML_SNIPPET}\n\nMade with DiemDesk — entirely in your browser. Nothing was uploaded.\n`);

  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  return { zip: await zip.generateAsync({ type: 'blob' }), previews, count: FAVICON_SIZES.length + 2 };
}
