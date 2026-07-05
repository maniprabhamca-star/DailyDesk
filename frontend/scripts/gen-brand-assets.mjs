// Regenerates DiemDesk's favicon + app icons + OG image from the "lifted D" brand
// mark, drawn with canvas primitives so it matches components/app/brand-mark.tsx
// exactly. Run from frontend/: node scripts/gen-brand-assets.mjs (writes to public/).
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const INDIGO = '#4F46E5';
const D_PATH = 'M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMark(ctx, ox, oy, size) {
  const s = size / 48;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  rr(ctx, 0, 0, 48, 48, 13.5); ctx.fillStyle = INDIGO; ctx.fill();
  rr(ctx, 10, 10, 12, 12, 3.5); ctx.fillStyle = '#FBBF24'; ctx.fill();
  rr(ctx, 10, 26, 12, 12, 3.5); ctx.fillStyle = '#22C55E'; ctx.fill();
  rr(ctx, 26, 26, 12, 12, 3.5); ctx.fillStyle = '#F87171'; ctx.fill();
  ctx.save();
  ctx.translate(32, 15); ctx.rotate((9 * Math.PI) / 180); ctx.translate(-32, -15);
  rr(ctx, 24, 7, 16, 16, 4.5); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = INDIGO;
  ctx.fill(new Path2D(D_PATH), 'evenodd');
  ctx.restore();
  ctx.restore();
}

function iconPng(size) {
  const c = createCanvas(size, size);
  drawMark(c.getContext('2d'), 0, 0, size);
  return c.toBuffer('image/png');
}

function ico(entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  const blobs = [];
  entries.forEach((e, i) => {
    const b = 6 + i * 16;
    head.writeUInt8(e.size >= 256 ? 0 : e.size, b);
    head.writeUInt8(e.size >= 256 ? 0 : e.size, b + 1);
    head.writeUInt8(0, b + 2); head.writeUInt8(0, b + 3);
    head.writeUInt16LE(1, b + 4); head.writeUInt16LE(32, b + 6);
    head.writeUInt32LE(e.buf.length, b + 8);
    head.writeUInt32LE(offset, b + 12);
    offset += e.buf.length;
    blobs.push(e.buf);
  });
  return Buffer.concat([head, ...blobs]);
}

function ogPng() {
  const W = 1200, H = 630;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4F46E5'; ctx.fillRect(0, H - 12, W, 12);
  drawMark(ctx, 110, 205, 220);
  const fam = GlobalFonts.families || [];
  const font = fam.length ? fam[fam.length - 1].family : 'Arial';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 80px ${font}`;
  ctx.fillText('DiemDesk', 380, 300);
  ctx.fillStyle = '#4F46E5';
  ctx.font = `bold 40px ${font}`;
  ctx.fillText('Every daily tool. Your files stay yours.', 380, 365);
  ctx.fillStyle = '#64748b';
  ctx.font = `34px ${font}`;
  ctx.fillText('Private, in-browser PDF & everyday tools.', 380, 420);
  return c.toBuffer('image/png');
}

writeFileSync(join(PUB, 'icon-192.png'), iconPng(192));
writeFileSync(join(PUB, 'icon-512.png'), iconPng(512));
writeFileSync(join(PUB, 'apple-touch-icon.png'), iconPng(180));
writeFileSync(join(PUB, 'favicon.ico'), ico([{ size: 32, buf: iconPng(32) }, { size: 16, buf: iconPng(16) }]));
writeFileSync(join(PUB, 'og.png'), ogPng());
console.log('Brand assets regenerated: icon-192, icon-512, apple-touch-icon, favicon.ico, og.png');
console.log('Fonts available:', (GlobalFonts.families || []).length);
