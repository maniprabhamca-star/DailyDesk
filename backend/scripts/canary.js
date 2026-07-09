#!/usr/bin/env node
// Tool canary — the "auto-detect + auto-protect + auto-draft" self-healing layer
// (see the self-healing design note). Runs on a cron.
//
//   • SERVER tools: probed end-to-end over HTTP; auto-DISABLE on THRESHOLD
//     consecutive failures via the tool_flags kill-switch (reversible); auto-
//     re-enable on recovery. x-canary lets it probe a disabled tool.
//   • CLIENT tools: the pure pdf-lib/rewrite/sanitize logic is run against a tiny
//     fixture via the frontend's own libs (sucrase). REPORT-ONLY for now (records
//     health + alerts, but does not auto-disable a heavily-used public tool on a
//     new logic canary).
//   • On a failure it emails the owner a diagnostic "fix brief" (what broke, the
//     likely source file, how to reproduce) — the auto-DRAFT step. It NEVER
//     patches code or deploys; writing/merging a fix stays human-approved.
//   • Heartbeat row proves the monitor ran; a separate heartbeat-watch cron
//     alerts if THIS monitor dies (it can't detect its own death).
require('dotenv').config();
const path = require('path');
const db = require('../src/db');
const { notifyOwner } = require('../src/utils/notify');
const { openIncidentIssue } = require('../src/utils/github');

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;
const CANARY = process.env.CANARY_TOKEN || '';
const THRESHOLD = 2;

// Where to look when a given tool breaks — goes in the diagnostic email.
const SOURCE = {
  '/word-to-pdf': 'backend/src/routes/convert.js (soffice --convert-to pdf) + LibreOffice on the VPS',
  '/pdf-to-word': 'backend/src/routes/convert.js (writer_pdf_import) + LibreOffice on the VPS',
  '/ocr-pdf': 'backend/src/routes/ocr.js (tesseract) + Tesseract + language packs on the VPS',
  '/rotate-pdf': 'frontend/lib/pdf-rewrite-core.ts (rotate) + pdf-rewrite.ts worker',
  '/delete-pages-from-pdf': 'frontend/lib/pdf-rewrite-core.ts (delete)',
  '/crop-pdf': 'frontend/lib/pdf-rewrite-core.ts (crop / setCropBox)',
  '/remove-pdf-metadata': 'frontend/lib/pdf-sanitize.ts (stripDocMetadata)',
  '/reorder-pdf': 'frontend/lib/pdf-rewrite-core.ts (reorder)',
  '/merge-pdf': 'frontend/lib/pdf-rewrite-core.ts (merge)',
  '/split-pdf': 'frontend/lib/pdf-rewrite-core.ts (split-each)',
  '/add-page-numbers-to-pdf': 'frontend/lib/pdf-rewrite-core.ts (page-numbers) + pdf-stamp.ts',
  '/watermark-pdf': 'frontend/lib/pdf-rewrite-core.ts (watermark) + pdf-stamp.ts',
};
function brief(slug, detail, disabled) {
  return [
    disabled ? `AUTO-DISABLED: ${slug}` : `FAILING (still enabled — report-only): ${slug}`,
    `Failure: ${detail}`,
    `Likely source: ${SOURCE[slug] || 'unknown'}`,
    `Reproduce:  cd /var/www/dailydesk/backend && node scripts/canary.js`,
    `Recent log: tail -n 40 /var/log/dd-canary.log`,
    disabled ? 'It will auto-re-enable when the canary sees it pass again.' : 'Not auto-disabled; investigate before it affects users.',
  ].join('\n');
}

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tool_health (
      slug          VARCHAR(100) PRIMARY KEY,
      ok            BOOLEAN,
      detail        TEXT,
      fail_streak   INT NOT NULL DEFAULT 0,
      auto_disabled BOOLEAN NOT NULL DEFAULT false,
      checked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function setFlag(slug, status) {
  await db.query(
    `INSERT INTO tool_flags (slug, status, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (slug) DO UPDATE SET status = $2, updated_at = now()`,
    [slug, status]
  );
}

// autoDisable=false → report-only (record + alert, but never flip the flag).
async function record(slug, ok, detail, autoDisable = true) {
  const { rows } = await db.query('SELECT fail_streak, auto_disabled FROM tool_health WHERE slug = $1', [slug]);
  const cur = rows[0] || { fail_streak: 0, auto_disabled: false };
  const failStreak = ok ? 0 : cur.fail_streak + 1;
  let autoDisabled = cur.auto_disabled;

  if (!ok && failStreak >= THRESHOLD && autoDisable && !autoDisabled) {
    await setFlag(slug, 'disabled');
    autoDisabled = true;
    console.log(`[canary] AUTO-DISABLED ${slug} — ${detail}`);
    const b = brief(slug, detail, true);
    await notifyOwner(`⚠️ Tool auto-disabled: ${slug}`, b);
    const gh = await openIncidentIssue(slug, `[canary] Tool auto-disabled: ${slug}`, b);
    if (gh === 'opened') console.log(`[canary] GitHub incident issue opened for ${slug}`);
  } else if (!ok && failStreak === THRESHOLD && !autoDisable) {
    console.log(`[canary] FAILING (report-only) ${slug} — ${detail}`);
    const b = brief(slug, detail, false);
    await notifyOwner(`⚠️ Tool failing: ${slug}`, b);
    const gh = await openIncidentIssue(slug, `[canary] Tool failing: ${slug}`, b);
    if (gh === 'opened') console.log(`[canary] GitHub incident issue opened for ${slug}`);
  } else if (ok && autoDisabled) {
    await setFlag(slug, 'enabled');
    autoDisabled = false;
    console.log(`[canary] AUTO-RE-ENABLED ${slug} (recovered)`);
    await notifyOwner(`✅ Tool recovered: ${slug}`, `${slug} passes its canary again and has been auto-re-enabled.`);
  }

  await db.query(
    `INSERT INTO tool_health (slug, ok, detail, fail_streak, auto_disabled, checked_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (slug) DO UPDATE SET ok = $2, detail = $3, fail_streak = $4, auto_disabled = $5, checked_at = now()`,
    [slug, ok, detail, failStreak, autoDisabled]
  );
  console.log(`[canary] ${ok ? 'OK  ' : 'FAIL'} ${slug} — ${detail}`);
}

async function convert(endpoint, fileBuf, filename, type) {
  const fd = new FormData();
  fd.append('file', new Blob([fileBuf], { type }), filename);
  const r = await fetch(`${BASE}${endpoint}`, { method: 'POST', body: fd, headers: CANARY ? { 'x-canary': CANARY } : {} });
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) };
}

async function serverChecks() {
  let pdf = null;
  try {
    const { status, buf } = await convert('/api/convert/office-to-pdf', Buffer.from('{\\rtf1\\ansi DiemDesk canary check.\\par}'), 'canary.rtf', 'application/rtf');
    const ok = status === 200 && buf.slice(0, 5).toString() === '%PDF-';
    await record('/word-to-pdf', ok, ok ? `pdf ${buf.length}B` : `HTTP ${status}`);
    if (ok) pdf = buf;
  } catch (e) { await record('/word-to-pdf', false, e.message); }
  try {
    if (!pdf) throw new Error('no canary pdf from step 1');
    const { status, buf } = await convert('/api/convert/pdf-to-word', pdf, 'canary.pdf', 'application/pdf');
    const ok = status === 200 && buf.length > 500 && buf.slice(0, 2).toString() === 'PK';
    await record('/pdf-to-word', ok, ok ? `docx ${buf.length}B` : `HTTP ${status}`);
  } catch (e) { await record('/pdf-to-word', false, e.message); }
}

// Run the client tools' CORE logic (the same libs the browser runs) against a
// tiny fixture. Report-only (autoDisable=false). If the harness itself can't
// load, skip quietly — an infra glitch must not flag the tools as broken.
async function clientChecks() {
  let executeRewrite, stripDocMetadata, PDFDocument;
  try {
    const FE = path.resolve(__dirname, '../../frontend');
    require(`${FE}/node_modules/sucrase/register`);
    ({ executeRewrite } = require(`${FE}/lib/pdf-rewrite-core.ts`));
    ({ stripDocMetadata } = require(`${FE}/lib/pdf-sanitize.ts`));
    ({ PDFDocument } = require(`${FE}/node_modules/pdf-lib`));
  } catch (e) {
    console.error('[canary] client harness unavailable, skipping client checks:', e.message);
    return;
  }
  // Fixture: a 3-page PDF with metadata to strip.
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([200, 200]);
  doc.setTitle('canary'); doc.setAuthor('canary'); doc.setSubject('canary');
  const bytes = await doc.save();
  const freshAB = () => Uint8Array.from(bytes).buffer; // fresh copy — executeRewrite transfers it

  const run = async (slug, fn) => {
    try { await record(slug, !!(await fn()), 'logic ok', false); }
    catch (e) { await record(slug, false, e.message, false); }
  };
  await run('/rotate-pdf', async () => {
    const [out] = await executeRewrite([freshAB()], { type: 'rotate', deltas: [90, 0, 0] });
    return (await PDFDocument.load(out)).getPageCount() === 3;
  });
  await run('/delete-pages-from-pdf', async () => {
    const [out] = await executeRewrite([freshAB()], { type: 'delete', indices: [1] });
    return (await PDFDocument.load(out)).getPageCount() === 2;
  });
  await run('/crop-pdf', async () => {
    const [out] = await executeRewrite([freshAB()], { type: 'crop', opts: { xFrac: 0.1, yFrac: 0.1, wFrac: 0.8, hFrac: 0.8 } });
    const cb = (await PDFDocument.load(out)).getPage(0).getCropBox();
    return Math.abs(cb.width - 160) < 1;
  });
  await run('/remove-pdf-metadata', async () => {
    const d = await PDFDocument.load(freshAB());
    return (await stripDocMetadata(d)) >= 1;
  });
  await run('/reorder-pdf', async () => {
    const [out] = await executeRewrite([freshAB()], { type: 'reorder', order: [2, 1, 0] });
    return (await PDFDocument.load(out)).getPageCount() === 3;
  });
  await run('/merge-pdf', async () => {
    const [out] = await executeRewrite([freshAB(), freshAB()], { type: 'merge' });
    return (await PDFDocument.load(out)).getPageCount() === 6;
  });
  await run('/split-pdf', async () => {
    const outs = await executeRewrite([freshAB()], { type: 'split-each' });
    return outs.length === 3; // one PDF per page
  });
  await run('/add-page-numbers-to-pdf', async () => {
    const [out] = await executeRewrite([freshAB()], { type: 'page-numbers', opts: { pageNums: [1, 2, 3], start: 1, template: '{n}', fontSize: 10, margin: 20, colorRgb: [0, 0, 0], pos: 'bc' } });
    return (await PDFDocument.load(out)).getPageCount() === 3;
  });
  await run('/watermark-pdf', async () => {
    const [out] = await executeRewrite([freshAB()], { type: 'watermark', opts: { mode: 'text', text: 'DRAFT', colorRgb: [0.5, 0.5, 0.5], sizeFrac: 0.1, opacity: 0.3, position: 'mc', rotation: 45, imageScale: 0.3, layer: 'over', range: '', standardFont: 'Helvetica' } });
    return (await PDFDocument.load(out)).getPageCount() === 3;
  });
}

// OCR (server, Tesseract): render "CANARY" to a PNG and assert OCR reads it back.
async function ocrCheck() {
  let createCanvas, GlobalFonts, FE;
  try {
    FE = path.resolve(__dirname, '../../frontend');
    ({ createCanvas, GlobalFonts } = require(`${FE}/node_modules/@napi-rs/canvas`));
    try { GlobalFonts.registerFromPath(`${FE}/public/fonts/roboto-regular.ttf`, 'CanaryFont'); } catch { /* fall back to default */ }
  } catch (e) {
    console.error('[canary] napi-canvas unavailable, skipping OCR check:', e.message);
    return;
  }
  try {
    const c = createCanvas(640, 200);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 200);
    ctx.fillStyle = '#000000'; ctx.font = '64px CanaryFont';
    ctx.fillText('CANARY', 40, 130);
    const png = c.toBuffer('image/png');
    const fd = new FormData();
    fd.append('pages', new Blob([png], { type: 'image/png' }), 'canary.png');
    fd.append('lang', 'eng');
    const r = await fetch(`${BASE}/api/ocr`, { method: 'POST', body: fd, headers: CANARY ? { 'x-canary': CANARY } : {} });
    const j = r.ok ? await r.json() : null;
    const text = ((j && j.text) || '').toUpperCase().replace(/[^A-Z]/g, '');
    const ok = r.status === 200 && text.includes('CANARY');
    await record('/ocr-pdf', ok, ok ? 'recognised text' : `HTTP ${r.status} read "${((j && j.text) || '').slice(0, 20)}"`);
  } catch (e) { await record('/ocr-pdf', false, e.message); }
}

(async () => {
  await ensureTable();
  await serverChecks();
  await ocrCheck();
  await clientChecks();
  await record('__heartbeat__', true, 'monitor ran');
  process.exit(0);
})().catch((e) => { console.error('[canary] fatal', e); process.exit(1); });
