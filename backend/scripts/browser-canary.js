#!/usr/bin/env node
// Playwright browser canary (self-healing V3) — drives the WASM/canvas/pdf.js
// browser-only tools end-to-end in a real headless Chromium (upload a real file ->
// run the tool -> assert a real download or a rendered document), so a broken engine
// is caught before a user hits it.
//
// REPORT-ONLY: records each result into tool_health (shows on /dashboard) + emails
// the owner on repeated failure; never auto-disables a public tool. Blocks its own
// analytics beacons. Uses a persistent Chromium profile so big WASM/models (e.g. the
// 46MB background-remover model) cache across runs. Carries the `ddadmin` cookie so it
// can reach owner-only tools (e.g. redact). Runs on a 30-min cron.
//
// Setup on the VPS (one-time): cd backend && npm i playwright --no-save &&
//   npx playwright install --with-deps chromium ;  apt install -y libheif-examples
//   libheif-plugin-x265   (for the HEIC fixture encoder)
require('dotenv').config();
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const db = require('../src/db');
const { notifyOwner } = require('../src/utils/notify');

const BASE = process.env.CANARY_BASE_URL || 'https://diemdesk.com';
const FE = '/var/www/dailydesk/frontend/node_modules';
const PROFILE = '/tmp/dd-bcanary-profile';
const THRESHOLD = 2;

const ACTION_RE = /compress|convert|resize|split|rotate|merge|flatten|make|create|process|apply|start|to pdf|to jpg/i;
const DOWNLOAD_RE = /download|save|\.zip|\.pdf|\.jpg|\.png/i;

// ---- fixtures: a small real PDF + a compressible JPG + a real HEIC (once) ----
async function fixtures() {
  const dir = '/tmp/dd-bcanary';
  fs.mkdirSync(dir, { recursive: true });
  const pdf = `${dir}/fixture.pdf`, jpg = `${dir}/fixture.jpg`, heic = `${dir}/fixture.heic`;
  if (!fs.existsSync(pdf)) {
    const { PDFDocument, rgb, StandardFonts } = require(`${FE}/pdf-lib`);
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 520]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({ x: 40, y: 320, width: 320, height: 140, color: rgb(0.31, 0.27, 0.9) });
    page.drawText('DiemDesk browser-canary fixture', { x: 44, y: 260, size: 13, font });
    page.drawText('The quick brown fox jumps over the lazy dog.', { x: 44, y: 236, size: 11, font });
    fs.writeFileSync(pdf, await doc.save());
  }
  if (!fs.existsSync(jpg)) {
    const { createCanvas } = require(`${FE}/@napi-rs/canvas`);
    const c = createCanvas(800, 600);
    const g = c.getContext('2d');
    g.fillStyle = '#4f46e5'; g.fillRect(0, 0, 800, 600);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},0.6)`; g.fillRect(Math.random() * 800, Math.random() * 600, 3, 3); }
    g.fillStyle = '#fff'; g.font = 'bold 48px sans-serif'; g.fillText('canary', 300, 320);
    fs.writeFileSync(jpg, c.toBuffer('image/jpeg'));
  }
  if (!fs.existsSync(heic)) {
    try { execFileSync('heif-enc', [jpg, '-o', heic], { stdio: 'ignore' }); } catch { /* no HEIC encoder → skip heic-to-jpg */ }
  }
  return { pdf, jpg, heic: fs.existsSync(heic) ? heic : null };
}

async function record(slug, ok, detail) {
  const { rows } = await db.query('SELECT fail_streak FROM tool_health WHERE slug = $1', [slug]).catch(() => ({ rows: [] }));
  const failStreak = ok ? 0 : ((rows[0] && rows[0].fail_streak) || 0) + 1;
  await db.query(
    `INSERT INTO tool_health (slug, ok, detail, fail_streak, auto_disabled, checked_at)
     VALUES ($1,$2,$3,$4,false,now())
     ON CONFLICT (slug) DO UPDATE SET ok=$2, detail=$3, fail_streak=$4, checked_at=now()`,
    [slug, ok, detail, failStreak]
  ).catch((e) => console.error('[bcanary] record failed:', e.message));
  if (!ok && failStreak === THRESHOLD) {
    await notifyOwner(`⚠️ Browser canary failing: ${slug}`,
      `${slug} failed the Playwright end-to-end drive ${failStreak}× in a row.\nDetail: ${detail}\n` +
      `Reproduce: cd /var/www/dailydesk/backend && node scripts/browser-canary.js\nLog: tail -n 60 /var/log/dd-browser-canary.log`);
  }
  console.log(`[bcanary] ${ok ? 'OK  ' : 'FAIL'} ${slug} — ${detail}`);
}

async function clickAll(page, nameRe, roles) {
  for (const role of roles) {
    const loc = page.getByRole(role, { name: nameRe });
    const n = await loc.count();
    for (let i = 0; i < n; i++) { const b = loc.nth(i); if (await b.isEnabled().catch(() => false)) await b.click({ timeout: 4000 }).catch(() => {}); }
  }
}

// Upload a fixture, run the tool, assert a real download. Disabled action buttons
// (e.g. while a slow model runs) are skipped, so re-clicking never restarts work.
async function driveUpload(page, t) {
  await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(t.fixture);
  await page.waitForTimeout(2500);
  const actionRe = t.action || ACTION_RE;
  const dlPromise = page.waitForEvent('download', { timeout: t.dlTimeout || 60000 }).catch(() => null);
  for (let round = 0; round < (t.rounds || 4); round++) {
    await clickAll(page, actionRe, ['button']);
    await page.waitForTimeout(3000);
    await clickAll(page, DOWNLOAD_RE, ['button', 'link']);
    for (const a of await page.locator('a[download]:visible').all()) await a.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const dl = await dlPromise;
  if (!dl) return { ok: false, detail: 'no download produced' };
  const p = await dl.path();
  const size = p ? fs.statSync(p).size : 0;
  return { ok: size >= (t.minBytes || 100), detail: `downloaded ${size}B` };
}

// Interactive editors (sign, redact) need a human to draw/place — so we assert the
// engine loaded + RENDERED the document (a pdf.js canvas / page image appears). That
// catches the common failure (won't open/render) without scripting a draw.
async function driveRender(page, t) {
  await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(t.fixture);
  // "rendered" = the editor loaded the doc: any VISIBLE pdf canvas / page image, OR
  // an editor action button appears (sign / redact / apply / download / page N).
  const pageEl = page.locator('canvas:visible, img[src^="blob:"]:visible');
  const btn = page.getByRole('button', { name: /sign|redact|apply|download|page \d/i });
  const ok = await Promise.race([
    pageEl.first().waitFor({ state: 'visible', timeout: 40000 }).then(() => true).catch(() => false),
    btn.first().waitFor({ state: 'visible', timeout: 40000 }).then(() => true).catch(() => false),
  ]);
  return { ok, detail: ok ? 'document rendered' : 'no rendered page' };
}

async function driveText(page, t) {
  await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const input = page.locator('input[type="text"], input:not([type]), textarea').first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill('https://diemdesk.com');
  await page.waitForTimeout(2000);
  const ok = await page.locator('canvas, svg, img[src^="data:"]').first().isVisible({ timeout: 8000 }).catch(() => false);
  return { ok, detail: ok ? 'rendered output' : 'no rendered output' };
}

(async () => {
  const fx = await fixtures();
  const TOOLS = [
    { slug: '/compress-pdf', kind: 'upload', fixture: fx.pdf },
    { slug: '/pdf-to-jpg', kind: 'upload', fixture: fx.pdf },
    { slug: '/jpg-to-pdf', kind: 'upload', fixture: fx.jpg },
    { slug: '/compress-image', kind: 'upload', fixture: fx.jpg },
    { slug: '/resize-image', kind: 'upload', fixture: fx.jpg },
    { slug: '/convert-image', kind: 'upload', fixture: fx.jpg },
    { slug: '/flatten-pdf', kind: 'upload', fixture: fx.pdf },
    { slug: '/remove-background', kind: 'upload', fixture: fx.jpg, action: /remove.{0,4}background/i, rounds: 30, dlTimeout: 120000 },
    { slug: '/sign-pdf', kind: 'render', fixture: fx.pdf },
    // NOTE: /redact-pdf is coming-soon (owner-only) and its gated dropzone doesn't
    // ingest via file-input injection — no error, just not drivable yet. RE-ADD as a
    // 'render' probe when it launches (and verify the drop/input wiring then).
    { slug: '/qr-code-generator', kind: 'text' },
  ];
  if (fx.heic) TOOLS.push({ slug: '/heic-to-jpg', kind: 'upload', fixture: fx.heic });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    acceptDownloads: true,
  });
  await ctx.route('**/api/events/**', (r) => r.abort()); // keep analytics clean
  await ctx.addCookies([{ name: 'ddadmin', value: '1', url: BASE }]); // reach owner-only tools
  ctx.setDefaultTimeout(15000);

  for (const t of TOOLS) {
    t.url = `${BASE}${t.slug}`;
    const page = await ctx.newPage();
    try {
      const r = t.kind === 'text' ? await driveText(page, t) : t.kind === 'render' ? await driveRender(page, t) : await driveUpload(page, t);
      await record(t.slug, r.ok, r.detail);
    } catch (e) { await record(t.slug, false, String(e.message || e).slice(0, 140)); }
    await page.close().catch(() => {});
  }
  await ctx.close().catch(() => {});
  await record('__browser_heartbeat__', true, 'browser canary ran');
  process.exit(0);
})().catch((e) => { console.error('[bcanary] fatal', e); process.exit(1); });
