#!/usr/bin/env node
// Playwright browser canary (self-healing V3) — the piece the Node canary can't do:
// it drives the WASM/canvas/pdf.js *browser-only* tools end-to-end in a real headless
// Chromium (upload a real file -> run the tool -> assert a real download), so a broken
// engine is caught before a user hits it.
//
// REPORT-ONLY: records each tool's result into tool_health (so it shows on /dashboard)
// and emails the owner on repeated failure — but never auto-disables a public tool.
// Analytics beacons from the canary's own page-opens are blocked so it doesn't pollute
// usage/error data. Runs on a cron (every 30 min).
//
// Setup on the VPS (one-time): cd backend && npm i playwright --no-save &&
//   npx playwright install --with-deps chromium
require('dotenv').config();
const fs = require('fs');
const { chromium } = require('playwright');
const db = require('../src/db');
const { notifyOwner } = require('../src/utils/notify');

const BASE = process.env.CANARY_BASE_URL || 'https://diemdesk.com';
const FE = '/var/www/dailydesk/frontend/node_modules';
const THRESHOLD = 2;

// ---- fixtures: a small real PDF + a real compressible JPG (generated once) ----
async function fixtures() {
  const dir = '/tmp/dd-bcanary';
  fs.mkdirSync(dir, { recursive: true });
  const pdf = `${dir}/fixture.pdf`, jpg = `${dir}/fixture.jpg`;
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
  return { pdf, jpg };
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

const ACTION_RE = /compress|convert|resize|extract|split|rotate|merge|make|create|process|apply|start|to pdf|to jpg/i;
const DOWNLOAD_RE = /download|save|\.zip|\.pdf|\.jpg|\.png/i;

async function driveUpload(page, t) {
  await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(t.fixture);
  await page.waitForTimeout(2500); // ingest + reveal controls

  const dlPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  for (let round = 0; round < 4; round++) {
    const acts = await page.locator('button:visible').filter({ hasText: ACTION_RE }).all();
    for (const b of acts) { if (await b.isEnabled().catch(() => false)) await b.click({ timeout: 4000 }).catch(() => {}); }
    await page.waitForTimeout(3000);
    const dls = await page.locator('button:visible, a:visible').filter({ hasText: DOWNLOAD_RE }).all();
    for (const b of dls) { if (await b.isEnabled().catch(() => false)) await b.click({ timeout: 4000 }).catch(() => {}); }
    await page.waitForTimeout(1500);
  }
  const dl = await dlPromise;
  if (!dl) return { ok: false, detail: 'no download produced' };
  const p = await dl.path();
  const size = p ? fs.statSync(p).size : 0;
  return { ok: size >= (t.minBytes || 100), detail: `downloaded ${size}B` };
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
    { slug: '/compress-pdf', url: `${BASE}/compress-pdf`, kind: 'upload', fixture: fx.pdf },
    { slug: '/pdf-to-jpg', url: `${BASE}/pdf-to-jpg`, kind: 'upload', fixture: fx.pdf },
    { slug: '/jpg-to-pdf', url: `${BASE}/jpg-to-pdf`, kind: 'upload', fixture: fx.jpg },
    { slug: '/compress-image', url: `${BASE}/compress-image`, kind: 'upload', fixture: fx.jpg },
    { slug: '/resize-image', url: `${BASE}/resize-image`, kind: 'upload', fixture: fx.jpg },
    { slug: '/convert-image', url: `${BASE}/convert-image`, kind: 'upload', fixture: fx.jpg },
    { slug: '/qr-code-generator', url: `${BASE}/qr-code-generator`, kind: 'text' },
  ];

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.route('**/api/events/**', (r) => r.abort()); // don't pollute usage/error analytics
  ctx.setDefaultTimeout(15000);

  for (const t of TOOLS) {
    const page = await ctx.newPage();
    try {
      const r = t.kind === 'text' ? await driveText(page, t) : await driveUpload(page, t);
      await record(t.slug, r.ok, r.detail);
    } catch (e) { await record(t.slug, false, String(e.message || e).slice(0, 140)); }
    await page.close().catch(() => {});
  }
  await browser.close().catch(() => {});
  await record('__browser_heartbeat__', true, 'browser canary ran');
  process.exit(0);
})().catch((e) => { console.error('[bcanary] fatal', e); process.exit(1); });
