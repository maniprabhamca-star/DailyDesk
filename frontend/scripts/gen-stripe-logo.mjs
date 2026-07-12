// On-LIGHT DiemDesk mark for colored backgrounds (e.g. Stripe's indigo checkout
// header, where the normal indigo-tile logo blends in). Same geometry as
// components/app/brand-mark.tsx, but the tile is WHITE so it reads as a crisp
// badge: white tile + amber/green/coral squares + indigo "D". Transparent
// corners. Run from frontend/: node scripts/gen-stripe-logo.mjs
import { createCanvas, Path2D } from '@napi-rs/canvas';
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

function drawLight(ctx, size) {
  const s = size / 48;
  ctx.save();
  ctx.scale(s, s);
  rr(ctx, 0, 0, 48, 48, 13.5); ctx.fillStyle = '#ffffff'; ctx.fill();     // WHITE tile (was indigo)
  rr(ctx, 10, 10, 12, 12, 3.5); ctx.fillStyle = '#FBBF24'; ctx.fill();
  rr(ctx, 10, 26, 12, 12, 3.5); ctx.fillStyle = '#22C55E'; ctx.fill();
  rr(ctx, 26, 26, 12, 12, 3.5); ctx.fillStyle = '#F87171'; ctx.fill();
  ctx.save();
  ctx.translate(32, 15); ctx.rotate((9 * Math.PI) / 180); ctx.translate(-32, -15);
  rr(ctx, 24, 7, 16, 16, 4.5); ctx.fillStyle = '#ffffff'; ctx.fill();     // sub-tile blends into white
  ctx.fillStyle = INDIGO; ctx.fill(new Path2D(D_PATH), 'evenodd');        // indigo "D" pops
  ctx.restore();
  ctx.restore();
}

const size = 512;
const c = createCanvas(size, size);
drawLight(c.getContext('2d'), size);
writeFileSync(join(PUB, 'logo-onlight.png'), c.toBuffer('image/png'));
console.log('Wrote public/logo-onlight.png');
