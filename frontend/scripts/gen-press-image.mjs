// Dedicated 1200×628 press image for the EIN Presswire launch release. Same
// brand mark geometry as components/app/brand-mark.tsx. Run from frontend/:
// node scripts/gen-press-image.mjs
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const INDIGO = '#4F46E5';
const DARK = '#0f172a';
const GRAY = '#64748b';
const D_PATH = 'M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z';

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawMark(ctx, ox, oy, size) {
  const s = size / 48; ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
  rr(ctx, 0, 0, 48, 48, 13.5); ctx.fillStyle = INDIGO; ctx.fill();
  rr(ctx, 10, 10, 12, 12, 3.5); ctx.fillStyle = '#FBBF24'; ctx.fill();
  rr(ctx, 10, 26, 12, 12, 3.5); ctx.fillStyle = '#22C55E'; ctx.fill();
  rr(ctx, 26, 26, 12, 12, 3.5); ctx.fillStyle = '#F87171'; ctx.fill();
  ctx.save(); ctx.translate(32, 15); ctx.rotate((9 * Math.PI) / 180); ctx.translate(-32, -15);
  rr(ctx, 24, 7, 16, 16, 4.5); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = INDIGO; ctx.fill(new Path2D(D_PATH), 'evenodd'); ctx.restore(); ctx.restore();
}

const W = 1200, H = 628;
const c = createCanvas(W, H);
const ctx = c.getContext('2d');
const fam = GlobalFonts.families || [];
const font = fam.length ? fam[fam.length - 1].family : 'Arial';

ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
// faint indigo panel behind the big mark (right side)
ctx.fillStyle = '#EEF0FE'; ctx.fillRect(848, 0, W - 848, H);

// header: mark + wordmark
drawMark(ctx, 80, 70, 78);
ctx.fillStyle = DARK; ctx.font = `bold 44px ${font}`; ctx.fillText('DiemDesk', 178, 124);

// headline (two lines)
ctx.fillStyle = DARK; ctx.font = `bold 66px ${font}`;
ctx.fillText('Your files never', 80, 288);
ctx.fillText('leave your device.', 80, 366);

// subline
ctx.fillStyle = GRAY; ctx.font = `31px ${font}`;
ctx.fillText('40+ free PDF, image & everyday tools —', 80, 432);
ctx.fillText('private, right in your browser.', 80, 474);

// value chips
ctx.fillStyle = INDIGO; ctx.font = `bold 29px ${font}`;
ctx.fillText('No uploads   ·   No accounts   ·   No ads', 80, 540);

// url
ctx.fillStyle = DARK; ctx.font = `bold 34px ${font}`; ctx.fillText('diemdesk.com', 80, 592);

// big brand mark on the right panel
drawMark(ctx, 930, 194, 240);

// bottom accent bar
ctx.fillStyle = INDIGO; ctx.fillRect(0, H - 12, W, 12);

writeFileSync('C:/Mani Documents/MyBiz/DailyDesk/diemdesk-EIN-newswire/press-image.png', c.toBuffer('image/png'));
console.log('wrote diemdesk-EIN-newswire/press-image.png');
