// WhatsApp-shareable portrait brochure (1080×1350, true 4:5 — displays without
// cropping in a WhatsApp image message). Same brand-mark geometry as
// components/app/brand-mark.tsx. Run from frontend/:  node scripts/gen-brochure.mjs
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const INDIGO = '#4F46E5';
const INDIGO_D = '#4338CA';
const DARK = '#0f172a';
const GRAY = '#64748b';
const GREEN = '#22C55E';
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
function check(ctx, cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = GREEN; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.42, cy + r * 0.02); ctx.lineTo(cx - r * 0.08, cy + r * 0.38); ctx.lineTo(cx + r * 0.46, cy - r * 0.34); ctx.stroke();
}

const W = 1080, H = 1350;
const c = createCanvas(W, H);
const ctx = c.getContext('2d');
const fam = GlobalFonts.families || [];
const F = fam.length ? fam[fam.length - 1].family : 'Arial';

// ground
ctx.fillStyle = '#EEF0FB'; ctx.fillRect(0, 0, W, H);

// ---- hero card ----
const hx = 40, hy = 40, hw = W - 80, hh = 500;
const grad = ctx.createLinearGradient(hx, hy, hx + hw, hy + hh);
grad.addColorStop(0, INDIGO); grad.addColorStop(1, INDIGO_D);
rr(ctx, hx, hy, hw, hh, 40); ctx.fillStyle = grad; ctx.fill();

rr(ctx, 96, 96, 104, 104, 26); ctx.fillStyle = '#fff'; ctx.fill();
drawMark(ctx, 110, 110, 76);
ctx.fillStyle = '#fff'; ctx.font = `bold 50px ${F}`; ctx.fillText('DiemDesk', 224, 168);

ctx.fillStyle = '#fff'; ctx.font = `bold 68px ${F}`;
ctx.fillText('40+ free tools', 96, 302);
ctx.fillText('for every document.', 96, 378);

ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `31px ${F}`;
ctx.fillText('PDF · images · e-sign · QR — right in your browser.', 96, 436);

ctx.font = `bold 28px ${F}`;
const pillTxt = 'Private by design — nothing is uploaded';
const pw = ctx.measureText(pillTxt).width + 54;
rr(ctx, 96, 472, pw, 54, 27); ctx.fillStyle = 'rgba(255,255,255,0.17)'; ctx.fill();
ctx.fillStyle = '#fff'; ctx.fillText(pillTxt, 123, 507);

// ---- body card ----
const bx = 40, by = 572, bw = W - 80, bh = 548;
rr(ctx, bx, by, bw, bh, 36); ctx.fillStyle = '#fff'; ctx.fill();
ctx.strokeStyle = '#E4E7F4'; ctx.lineWidth = 2; rr(ctx, bx, by, bw, bh, 36); ctx.stroke();

ctx.fillStyle = GRAY; ctx.font = `bold 23px ${F}`;
ctx.fillText('W H A T   Y O U   G E T', 84, by + 52);

const props = [
  '100% private — nothing is uploaded or stored',
  'No account, no ads, no watermarks',
  'Free & unlimited — even works offline',
  '56 tools across 9 categories',
];
let vy = by + 116;
ctx.font = `31px ${F}`;
for (const p of props) {
  check(ctx, 104, vy - 10, 20);
  ctx.fillStyle = DARK; ctx.fillText(p, 146, vy);
  vy += 60;
}

// divider
ctx.strokeStyle = '#EDEFF7'; ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(84, by + 372); ctx.lineTo(bx + bw - 44, by + 372); ctx.stroke();

// chips
ctx.fillStyle = GRAY; ctx.font = `bold 23px ${F}`;
ctx.fillText('W H A T ’ S   I N S I D E', 84, by + 420);
const chips = [
  ['Organize PDF', '#dc2626'], ['Convert', '#0284c7'], ['Edit & sign', '#d97706'],
  ['Images & media', '#ea580c'], ['Generators', '#4f46e5'], ['AI & scan', '#db2777'],
  ['Utilities', '#0d9488'], ['Workspace', '#16a34a'],
];
ctx.font = `bold 26px ${F}`;
let cx = 84, cyy = by + 448; const maxX = bx + bw - 44, chH = 50, gap = 14;
for (const [label, col] of chips) {
  const cw = ctx.measureText(label).width + 44;
  if (cx + cw > maxX) { cx = 84; cyy += chH + gap; }
  rr(ctx, cx, cyy, cw, chH, 25); ctx.fillStyle = col + '1f'; ctx.fill();
  ctx.fillStyle = col; ctx.fillText(label, cx + 22, cyy + 33);
  cx += cw + gap;
}

// ---- CTA band ----
const cby = 1152;
const cg = ctx.createLinearGradient(0, cby, W, H);
cg.addColorStop(0, INDIGO); cg.addColorStop(1, INDIGO_D);
ctx.fillStyle = cg; ctx.fillRect(0, cby, W, H - cby);
ctx.textAlign = 'center';
ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `28px ${F}`;
ctx.fillText('Free  ·  private  ·  no signup', W / 2, cby + 58);
ctx.fillStyle = '#fff'; ctx.font = `bold 58px ${F}`;
ctx.fillText('diemdesk.com', W / 2, cby + 122);
ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `26px ${F}`;
ctx.fillText('See the full toolkit  →  diemdesk.com/overview', W / 2, cby + 170);
ctx.textAlign = 'left';

writeFileSync('C:/Mani Documents/MyBiz/DailyDesk/diemdesk-brochure/diemdesk-brochure.png', c.toBuffer('image/png'));
console.log('wrote diemdesk-brochure/diemdesk-brochure.png');
