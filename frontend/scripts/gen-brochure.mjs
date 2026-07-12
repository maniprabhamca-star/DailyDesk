// DiemDesk share graphics — one design, every common social format.
// Outputs into diemdesk-brochure/. Run from frontend/:  node scripts/gen-brochure.mjs
//   diemdesk-brochure.png            portrait 1080×1350 (4:5) — WhatsApp/IG feed
//   diemdesk-square-1080x1080.png    square 1:1 — WhatsApp/IG feed
//   diemdesk-story-1080x1920.png     9:16 — WhatsApp Status / Stories
//   diemdesk-landscape-1200x630.png  1.91:1 — link preview / FB / LinkedIn / X
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const INDIGO = '#4F46E5', INDIGO_D = '#4338CA', DARK = '#0f172a', GRAY = '#64748b', GREEN = '#22C55E';
const D_PATH = 'M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z';
const OUT = 'C:/Mani Documents/MyBiz/DailyDesk/diemdesk-brochure/';
// Register real, high-quality faces (Poppins regular + bold) so the type renders
// crisp and correctly weighted — NOT an arbitrary system fallback.
const FONTS = 'C:/Mani Documents/MyBiz/DailyDesk/frontend/public/fonts/';
GlobalFonts.registerFromPath(FONTS + 'poppins-regular.ttf', 'Poppins');
GlobalFonts.registerFromPath(FONTS + 'poppins-bold.ttf', 'Poppins');
const F = 'Poppins';

const PROPS = [
  '100% private — nothing is uploaded or stored',
  'No account, no ads, no watermarks',
  'Free & unlimited — even works offline',
  '56 tools across 9 categories',
];
const CHIPS = [
  ['Organize PDF', '#dc2626'], ['Convert', '#0284c7'], ['Edit & sign', '#d97706'],
  ['Images & media', '#ea580c'], ['Generators', '#4f46e5'], ['AI & scan', '#db2777'],
  ['Utilities', '#0d9488'], ['Workspace', '#16a34a'],
];

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
function badge(ctx, x, y, s) { rr(ctx, x, y, s, s, s * 0.25); ctx.fillStyle = '#fff'; ctx.fill(); drawMark(ctx, x + s * 0.135, y + s * 0.135, s * 0.73); }
function check(ctx, cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = GREEN; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.42, cy + r * 0.02); ctx.lineTo(cx - r * 0.08, cy + r * 0.38); ctx.lineTo(cx + r * 0.46, cy - r * 0.34); ctx.stroke();
}
function heroFill(ctx, x, y, w, h, r) { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, INDIGO); g.addColorStop(1, INDIGO_D); rr(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill(); }
function pill(ctx, x, y, text, size) {
  ctx.font = `bold ${size}px ${F}`; const w = ctx.measureText(text).width + size * 1.9;
  rr(ctx, x, y, w, size * 1.95, size * 0.98); ctx.fillStyle = 'rgba(255,255,255,0.17)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, x + size * 0.95, y + size * 1.28);
}
function propsList(ctx, x, y, gap, font, r, items) {
  ctx.font = `${font}px ${F}`;
  for (const p of items) { check(ctx, x + r, y - font * 0.32, r); ctx.fillStyle = DARK; ctx.fillText(p, x + r * 2 + 18, y); y += gap; }
}
function chipRows(ctx, x, y, maxX, h, gap, font, items) {
  ctx.font = `bold ${font}px ${F}`; let cx = x, cy = y;
  for (const [label, col] of items) {
    const cw = ctx.measureText(label).width + font * 1.7;
    if (cx + cw > maxX) { cx = x; cy += h + gap; }
    rr(ctx, cx, cy, cw, h, h / 2); ctx.fillStyle = col + '1f'; ctx.fill();
    ctx.fillStyle = col; ctx.fillText(label, cx + font * 0.85, cy + h * 0.68); cx += cw + gap;
  }
}
function label(ctx, x, y, text, size) { ctx.fillStyle = GRAY; ctx.font = `bold ${size}px ${F}`; ctx.fillText(text, x, y); }
function ctaBand(ctx, y, W, H, big) {
  const g = ctx.createLinearGradient(0, y, W, H); g.addColorStop(0, INDIGO); g.addColorStop(1, INDIGO_D);
  ctx.fillStyle = g; ctx.fillRect(0, y, W, H - y); const m = H - y; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `${Math.round(big * 0.46)}px ${F}`; ctx.fillText('Free  ·  private  ·  no signup', W / 2, y + m * 0.34);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${big}px ${F}`; ctx.fillText('diemdesk.com', W / 2, y + m * 0.63);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `${Math.round(big * 0.44)}px ${F}`; ctx.fillText('See the full toolkit at diemdesk.com/overview', W / 2, y + m * 0.86);
  ctx.textAlign = 'left';
}
function bodyCard(ctx, x, y, w, h) { rr(ctx, x, y, w, h, 36); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#E4E7F4'; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 36); ctx.stroke(); }
// xWord = wordmark start (right of the badge); xBody = headline/subline start
// (flush under the badge's left edge, so long lines don't run off the card).
function heroText(ctx, xWord, xBody, wordBase, wordSize, h1s, h1y1, h1y2, subY, subSize) {
  ctx.fillStyle = '#fff'; ctx.font = `bold ${wordSize}px ${F}`; ctx.fillText('DiemDesk', xWord, wordBase);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${h1s}px ${F}`; ctx.fillText('40+ free tools', xBody, h1y1); ctx.fillText('for every document.', xBody, h1y2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `${subSize}px ${F}`; ctx.fillText('PDF · images · e-sign · QR — right in your browser.', xBody, subY);
}

// ---------- tall layouts ----------
function renderPortrait() {
  const W = 1080, H = 1350, c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#EEF0FB'; ctx.fillRect(0, 0, W, H);
  heroFill(ctx, 40, 40, 1000, 500, 40); badge(ctx, 96, 96, 104);
  heroText(ctx, 224, 96, 168, 50, 68, 302, 378, 436, 31);
  pill(ctx, 96, 472, 'Private by design — nothing is uploaded', 28);
  bodyCard(ctx, 40, 572, 1000, 548);
  label(ctx, 84, 624, 'W H A T   Y O U   G E T', 23);
  propsList(ctx, 84, 688, 60, 31, 20, PROPS);
  ctx.strokeStyle = '#EDEFF7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(84, 944); ctx.lineTo(996, 944); ctx.stroke();
  label(ctx, 84, 992, 'W H A T ’ S   I N S I D E', 23);
  chipRows(ctx, 84, 1016, 996, 50, 14, 26, CHIPS);
  ctaBand(ctx, 1152, W, H, 58);
  return c;
}
function renderSquare() {
  const W = 1080, H = 1080, c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#EEF0FB'; ctx.fillRect(0, 0, W, H);
  heroFill(ctx, 40, 36, 1000, 392, 38); badge(ctx, 88, 80, 92);
  heroText(ctx, 200, 88, 138, 44, 56, 228, 288, 332, 27);
  pill(ctx, 88, 360, 'Private — nothing is uploaded', 24);
  bodyCard(ctx, 40, 448, 1000, 468);
  label(ctx, 84, 494, 'W H A T   Y O U   G E T', 22);
  propsList(ctx, 84, 544, 54, 30, 19, PROPS);
  ctx.strokeStyle = '#EDEFF7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(84, 744); ctx.lineTo(996, 744); ctx.stroke();
  label(ctx, 84, 784, 'W H A T ’ S   I N S I D E', 22);
  chipRows(ctx, 84, 804, 996, 46, 12, 25, CHIPS);
  ctaBand(ctx, 916, W, H, 48);
  return c;
}
function renderStory() {
  const W = 1080, H = 1920, c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#EEF0FB'; ctx.fillRect(0, 0, W, H);
  heroFill(ctx, 48, 80, 984, 620, 46); badge(ctx, 112, 132, 120);
  heroText(ctx, 264, 112, 210, 58, 72, 360, 452, 524, 36);
  pill(ctx, 112, 566, 'Private by design — nothing is uploaded', 31);
  bodyCard(ctx, 48, 760, 984, 760);
  label(ctx, 96, 828, 'W H A T   Y O U   G E T', 28);
  propsList(ctx, 96, 916, 78, 36, 24, PROPS);
  ctx.strokeStyle = '#EDEFF7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, 1234); ctx.lineTo(984, 1234); ctx.stroke();
  label(ctx, 96, 1290, 'W H A T ’ S   I N S I D E', 28);
  chipRows(ctx, 96, 1324, 984, 60, 16, 30, CHIPS);
  ctaBand(ctx, 1560, W, H, 68);
  return c;
}
// ---------- wide layout ----------
function renderLandscape() {
  const W = 1200, H = 630, c = createCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, INDIGO); g.addColorStop(1, INDIGO_D);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // left
  badge(ctx, 72, 66, 96);
  ctx.fillStyle = '#fff'; ctx.font = `bold 46px ${F}`; ctx.fillText('DiemDesk', 192, 132);
  ctx.fillStyle = '#fff'; ctx.font = `bold 52px ${F}`; ctx.fillText('40+ free tools for', 72, 254); ctx.fillText('every document.', 72, 316);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `27px ${F}`; ctx.fillText('PDF · images · e-sign · QR — in your browser.', 72, 372);
  pill(ctx, 72, 402, 'Private — nothing is uploaded', 24);
  ctx.fillStyle = '#fff'; ctx.font = `bold 40px ${F}`; ctx.fillText('diemdesk.com', 72, 526);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `24px ${F}`; ctx.fillText('Full toolkit at diemdesk.com/overview', 72, 566);
  // right card (airy 4 props — shortened to fit the narrower column)
  const SHORT = ['100% private — no uploads', 'No account, no ads', 'Free & unlimited', '56 tools · 9 categories'];
  bodyCard(ctx, 690, 64, 456, 502);
  label(ctx, 730, 128, 'W H A T   Y O U   G E T', 22);
  propsList(ctx, 730, 214, 88, 27, 19, SHORT);
  return c;
}

const jobs = [
  ['diemdesk-brochure.png', renderPortrait],
  ['diemdesk-square-1080x1080.png', renderSquare],
  ['diemdesk-story-1080x1920.png', renderStory],
  ['diemdesk-landscape-1200x630.png', renderLandscape],
];
for (const [name, fn] of jobs) { writeFileSync(OUT + name, fn().toBuffer('image/png')); console.log('wrote', name); }
