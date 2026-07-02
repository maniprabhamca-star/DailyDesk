// Generate DailyDesk brand assets (option A "lifted tile") — icons + OG image.
// Draws the exact BrandMark geometry with canvas primitives.
const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');

const PRIMARY = '#6d5ef6';
const OUT = 'C:/Mani Documents/MyBiz/DailyDesk/frontend/public';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draw the mark into a size×size canvas. fullBleed = square background without
// rounded corners (Apple touch icons get rounded by iOS itself).
function drawMark(size, { fullBleed = false } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  const s = size / 48;
  g.fillStyle = PRIMARY;
  if (fullBleed) g.fillRect(0, 0, size, size);
  else { rr(g, 0, 0, size, size, 13.5 * s); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [x, y] of [[10, 10], [10, 26], [26, 26]]) { rr(g, x * s, y * s, 12 * s, 12 * s, 3.5 * s); g.fill(); }
  g.save();
  g.translate(32 * s, 15 * s);
  g.rotate((9 * Math.PI) / 180);
  g.translate(-32 * s, -15 * s);
  g.fillStyle = '#ffffff';
  rr(g, 25 * s, 8 * s, 14 * s, 14 * s, 4 * s);
  g.fill();
  g.restore();
  return c;
}

// Icons
fs.writeFileSync(`${OUT}/icon-192.png`, drawMark(192).toBuffer('image/png'));
fs.writeFileSync(`${OUT}/icon-512.png`, drawMark(512).toBuffer('image/png'));
fs.writeFileSync(`${OUT}/apple-touch-icon.png`, drawMark(180, { fullBleed: true }).toBuffer('image/png'));

// favicon.ico — single 32px PNG wrapped in an ICO container (valid modern ICO).
const png32 = drawMark(32).toBuffer('image/png');
const ico = Buffer.alloc(6 + 16 + png32.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); // ICO, 1 image
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); // 32x32
ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); // planes, bpp
ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18); // size, offset
png32.copy(ico, 22);
fs.writeFileSync(`${OUT}/favicon.ico`, ico);

// OG share image 1200×630 — dark slate, mark + wordmark + tagline + privacy pill.
const og = createCanvas(1200, 630);
const g = og.getContext('2d');
g.fillStyle = '#0f172a';
g.fillRect(0, 0, 1200, 630);
// faint grid flourish
g.fillStyle = 'rgba(255,255,255,0.03)';
for (const [x, y, w] of [[940, -60, 320], [1020, 380, 280], [-80, 420, 260]]) { rr(g, x, y, w, w, w * 0.28); g.fill(); }
// mark
const mark = drawMark(120);
g.drawImage(mark, 90, 130);
// wordmark
g.fillStyle = '#ffffff';
g.font = 'bold 92px "Segoe UI", Arial, sans-serif';
g.fillText('DailyDesk', 236, 224);
// tagline
g.font = 'bold 44px "Segoe UI", Arial, sans-serif';
g.fillStyle = '#e2e8f0';
g.fillText('Every daily tool. Your files stay yours.', 92, 340);
// subline
g.font = '30px "Segoe UI", Arial, sans-serif';
g.fillStyle = '#94a3b8';
g.fillText('PDF, image, QR & password tools — free, no signup,', 92, 402);
g.fillText('and nothing ever uploaded.', 92, 444);
// privacy pill
g.fillStyle = 'rgba(16,185,129,0.15)';
rr(g, 92, 496, 330, 56, 28); g.fill();
g.strokeStyle = 'rgba(16,185,129,0.4)'; g.lineWidth = 2;
rr(g, 92, 496, 330, 56, 28); g.stroke();
g.fillStyle = '#34d399';
g.font = 'bold 26px "Segoe UI", Arial, sans-serif';
g.fillText('Private by design', 152, 533);
g.beginPath(); g.arc(128, 524, 8, 0, Math.PI * 2); g.fill();
fs.writeFileSync(`${OUT}/og.png`, og.toBuffer('image/png'));

console.log('WROTE icon-192, icon-512, apple-touch-icon, favicon.ico, og.png');
