#!/usr/bin/env node
// Tool canary — the "auto-detect + auto-protect" half of the self-healing plan
// (see the self-healing design note). Runs on a cron; exercises DiemDesk's
// SERVER tools end-to-end over HTTP with tiny fixtures and records health.
//
// Safe by design:
//   • auto-PROTECT only: on THRESHOLD consecutive failures it flips the tool's
//     flag to `disabled` (the existing kill-switch) so users see "temporarily
//     unavailable" instead of a broken tool — a reversible flag flip, never a
//     code change. It auto-re-enables a tool ONLY if the canary itself disabled
//     it (tracked by auto_disabled), so a manual kill is never overridden.
//   • it sends x-canary so it can still test a disabled tool and detect recovery.
//   • heartbeat row (__heartbeat__) lets the dashboard spot a dead monitor.
//   • it NEVER patches code or deploys — drafting/fixing stays human-approved.
require('dotenv').config();
const db = require('../src/db');

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;
const CANARY = process.env.CANARY_TOKEN || '';
const THRESHOLD = 2; // consecutive failures before auto-disable (avoid flapping)

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

async function record(slug, ok, detail) {
  const { rows } = await db.query('SELECT fail_streak, auto_disabled FROM tool_health WHERE slug = $1', [slug]);
  const cur = rows[0] || { fail_streak: 0, auto_disabled: false };
  const failStreak = ok ? 0 : cur.fail_streak + 1;
  let autoDisabled = cur.auto_disabled;

  if (!ok && failStreak >= THRESHOLD && !autoDisabled) {
    await setFlag(slug, 'disabled');
    autoDisabled = true;
    console.log(`[canary] AUTO-DISABLED ${slug} after ${failStreak} failures — ${detail}`);
  } else if (ok && autoDisabled) {
    await setFlag(slug, 'enabled'); // recover ONLY what we disabled
    autoDisabled = false;
    console.log(`[canary] AUTO-RE-ENABLED ${slug} (recovered)`);
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

(async () => {
  await ensureTable();

  // 1. Office->PDF (LibreOffice). RTF maps to the /word-to-pdf tool.
  let pdf = null;
  try {
    const { status, buf } = await convert('/api/convert/office-to-pdf', Buffer.from('{\\rtf1\\ansi DiemDesk canary check.\\par}'), 'canary.rtf', 'application/rtf');
    const ok = status === 200 && buf.slice(0, 5).toString() === '%PDF-';
    await record('/word-to-pdf', ok, ok ? `pdf ${buf.length}B` : `HTTP ${status}`);
    if (ok) pdf = buf;
  } catch (e) { await record('/word-to-pdf', false, e.message); }

  // 2. PDF->Word (LibreOffice import). Reuse the PDF the first step produced.
  try {
    if (!pdf) throw new Error('no canary pdf from step 1');
    const { status, buf } = await convert('/api/convert/pdf-to-word', pdf, 'canary.pdf', 'application/pdf');
    const ok = status === 200 && buf.length > 500 && buf.slice(0, 2).toString() === 'PK'; // docx = zip
    await record('/pdf-to-word', ok, ok ? `docx ${buf.length}B` : `HTTP ${status}`);
  } catch (e) { await record('/pdf-to-word', false, e.message); }

  // Heartbeat — a fresh timestamp proves the monitor itself is alive.
  await record('__heartbeat__', true, 'monitor ran');
  process.exit(0);
})().catch((e) => { console.error('[canary] fatal', e); process.exit(1); });
