// WhatsApp-shareable portrait brochure (1080×1350) for DiemDesk.
// Same brand-mark geometry as components/app/brand-mark.tsx.
// Run from frontend/:  node scripts/gen-brochure.mjs
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
ctx.fillStyle = '#F7F8FE'; ctx.fillRect(0, 0, W, H);

// ---- hero card ----
const hx = 48, hy = 48, hw = W - 96, hh = 486;
const grad = ctx.createLinearGradient(hx, hy, hx, hy + hh);
grad.addColorStop(0, INDIGO); grad.addColorStop(1, INDIGO_D);
rr(ctx, hx, hy, hw, hh, 40); ctx.fillStyle = grad; ctx.fill();

// white badge + mark + wordmark
rr(ctx, 104, 104, 104, 104, 26); ctx.fillStyle = '#fff'; ctx.fill();
drawMark(ctx, 118, 118, 76);
ctx.fillStyle = '#fff'; ctx.font = `bold 50px ${F}`; ctx.fillText('DiemDesk', 232, 176);

// headline
ctx.fillStyle = '#fff'; ctx.font = `bold 66px ${F}`;
ctx.fillText('40+ free tools', 104, 306);
ctx.fillText('for every document.', 104, 378);

// subline
ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.font = `30px ${F}`;
ctx.fillText('PDF · images · e-sign · QR — right in your browser.', 104, 434);

// privacy pill
ctx.font = `bold 27px ${F}`;
const pillTxt = 'Private by design — nothing is uploaded';
const pw = ctx.measureText(pillTxt).width + 52;
rr(ctx, 104, 462, pw, 52, 26); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
ctx.fillStyle = '#fff'; ctx.fillText(pillTxt, 130, 496);

// ---- value props ----
const props = [
  '100% private — nothing is uploaded or stored',
  'No account, no ads, no watermarks',
  'Free & unlimited — even works offline',
  '56 tools across 9 categories',
];
let vy = 606;
ctx.font = `31px ${F}`;
for (const p of props) {
  check(ctx, 92, vy - 10, 20);
  ctx.fillStyle = DARK; ctx.fillText(p, 132, vy);
  vy += 62;
}

// ---- category chips ----
ctx.fillStyle = GRAY; ctx.font = `bold 24px ${F}`;
ctx.fillText('W H A T ’ S   I N S I D E', 72, 884);
const chips = [
  ['Organize PDF', '#dc2626'], ['Convert', '#0284c7'], ['Edit & sign', '#d97706'],
  ['Images & media', '#ea580c'], ['Generators', '#4f46e5'], ['AI & scan', '#db2777'],
  ['Utilities', '#0d9488'], ['Workspace', '#16a34a'],
];
ctx.font = `bold 27px ${F}`;
let cx = 60, cyy = 916; const maxX = W - 60, chH = 52, gap = 16;
for (const [label, col] of chips) {
  const cw = ctx.measureText(label).width + 48;
  if (cx + cw > maxX) { cx = 60; cyy += chH + gap; }
  rr(ctx, cx, cyy, cw, chH, 26); ctx.fillStyle = col + '1f'; ctx.fill();
  ctx.fillStyle = col; ctx.fillText(label, cx + 24, cyy + 35);
  cx += cw + gap;
}

// ---- CTA band ----
const by = 1150;
const cg = ctx.createLinearGradient(0, by, W, H);
cg.addColorStop(0, INDIGO); cg.addColorStop(1, INDIGO_D);
ctx.fillStyle = cg; ctx.fillRect(0, by, W, H - by);
ctx.textAlign = 'center';
ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `28px ${F}`;
ctx.fillText('Free  ·  private  ·  no signup', W / 2, by + 60);
ctx.fillStyle = '#fff'; ctx.font = `bold 58px ${F}`;
ctx.fillText('diemdesk.com', W / 2, by + 124);
ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `27px ${F}`;
ctx.fillText('See the full toolkit  →  diemdesk.com/overview', W / 2, by + 172);
ctx.textAlign = 'left';

writeFileSync('C:/Mani Documents/MyBiz/DailyDesk/diemdesk-brochure/diemdesk-brochure.png', c.toBuffer('image/png'));
console.log('wrote diemdesk-brochure/diemdesk-brochure.png');
