// Generates a branded 1200×630 Open Graph card for EVERY live tool, so sharing a
// tool link shows that tool's own card instead of the generic one.
//
// Catalog-driven: it parses components/app/catalog.tsx (the single source of truth),
// so a new tool automatically gets an image — nothing to hand-maintain. Cards are
// drawn with canvas primitives in the same brand language as gen-brand-assets.mjs.
//
// Run from frontend/:  node scripts/gen-og-images.mjs   → writes public/og/<slug>.png
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og');
const INDIGO = '#4F46E5';
const D_PATH = 'M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z';

// ---- read the catalog (single source of truth) -----------------------------
function readCatalog() {
  const src = readFileSync(join(ROOT, 'components', 'app', 'catalog.tsx'), 'utf8');
  const groups = [];
  const groupRe = /label:\s*'([^']+)',\s*color:\s*'([^']+)',\s*tools:\s*\[([\s\S]*?)\n\s*\],/g;
  let g;
  while ((g = groupRe.exec(src))) {
    const [, label, color, body] = g;
    const tools = [];
    for (const line of body.split('\n')) {
      const m = line.match(/\{\s*name:\s*'([^']+)'/);
      if (!m) continue;
      const href = (line.match(/href:\s*'([^']+)'/) || [])[1];
      const soon = /soon:\s*true/.test(line);
      const badge = (line.match(/badge:\s*'([^']+)'/) || [])[1] || 'device';
      if (href && !soon) tools.push({ name: m[1], href, badge });
    }
    groups.push({ label, color, tools });
  }
  return groups;
}

// ---- drawing ---------------------------------------------------------------
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

const FAM = (() => {
  const fam = GlobalFonts.families || [];
  return fam.length ? fam[fam.length - 1].family : 'Arial';
})();

// Wrap a headline to fit the card width, shrinking the size for long tool names.
function fitLines(ctx, text, maxWidth, startPx) {
  for (let px = startPx; px >= 44; px -= 6) {
    ctx.font = `bold ${px}px ${FAM}`;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);
    if (lines.length <= 2) return { lines, px };
  }
  return { lines: [text], px: 44 };
}

function card({ name, color, group, badge }) {
  const W = 1200, H = 630;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  // ground + the tool's own category colour as the accent
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 14, H);          // left rail
  ctx.fillStyle = color; ctx.globalAlpha = 0.06; ctx.fillRect(14, 0, W - 14, H); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.fillRect(0, H - 10, W, 10);     // bottom bar

  // brand lockup
  drawMark(ctx, 74, 60, 64);
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 34px ${FAM}`;
  ctx.fillText('DiemDesk', 152, 105);

  // category eyebrow
  ctx.fillStyle = color;
  ctx.font = `bold 24px ${FAM}`;
  ctx.fillText(group.toUpperCase(), 74, 210);

  // tool name (the hero)
  const { lines, px } = fitLines(ctx, name, W - 160, 92);
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${px}px ${FAM}`;
  lines.forEach((l, i) => ctx.fillText(l, 74, 300 + i * (px + 10)));

  // honest runtime promise — matches the badge in the catalog
  const promise = badge === 'device'
    ? 'Runs in your browser — your file never leaves your device'
    : badge === 'ai' ? 'AI-powered · only the snippets needed are sent'
    : badge === 'encrypted' ? 'End-to-end encrypted — only you hold the key'
    : 'Processed on our servers, then deleted immediately';
  ctx.fillStyle = '#475569';
  ctx.font = `32px ${FAM}`;
  ctx.fillText(promise, 74, H - 120);

  // free chip — width measured from the text so it can never overflow the pill
  if (badge === 'device') {
    const label = 'FREE · NO SIGNUP';
    const padX = 22;
    ctx.font = `bold 24px ${FAM}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = '#16a34a';
    rr(ctx, 74, H - 92, tw + padX * 2, 46, 23); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 74 + padX, H - 61);
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 28px ${FAM}`;
  ctx.fillText('diemdesk.com', W - 250, H - 60);

  return c.toBuffer('image/png');
}

// ---- run -------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const groups = readCatalog();
let n = 0;
for (const g of groups) {
  for (const t of g.tools) {
    const slug = t.href.replace(/^\//, '');
    if (!slug) continue;
    writeFileSync(join(OUT, `${slug}.png`), card({ name: t.name, color: g.color, group: g.label, badge: t.badge }));
    n++;
  }
}
console.log(`Generated ${n} per-tool OG cards → public/og/  (font: ${FAM})`);
console.log(groups.map((g) => `  ${g.label}: ${g.tools.length}`).join('\n'));
