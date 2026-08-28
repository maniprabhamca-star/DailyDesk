/**
 * The sweeper deletes things. The only assertion that really matters is the
 * negative one: it must never touch a directory a live request is still using.
 *
 * Run: node dev-harness/temp-sweeper-check.mjs   (from the repo root)
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';

const require = createRequire(import.meta.url);
const { sweepOnce, MIN_AGE_MS } = require('../backend/src/utils/tempSweeper.js');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

const tmp = os.tmpdir();
const made = [];
const old = Date.now() / 1000 - (MIN_AGE_MS / 1000) - 600; // comfortably past the cutoff

function mkDir(name, aged) {
  const p = path.join(tmp, name);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'payload.bin'), 'x');
  if (aged) fs.utimesSync(p, old, old);
  made.push(p);
  return p;
}
function mkFile(name, aged) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, 'x');
  if (aged) fs.utimesSync(p, old, old);
  made.push(p);
  return p;
}

// Stale leftovers from a crash — every prefix the app creates.
const staleDirs = ['dd-ocr-zzztest1', 'dd-rcpt-zzztest1', 'ddout-zzztest1', 'ddlo-zzztest1'].map((n) => mkDir(n, true));
const staleFile = mkFile('ddconv-zzztest1.pdf', true);

// A job that is running RIGHT NOW.
const liveDir = mkDir('dd-ocr-zzzlive', false);
const liveFile = mkFile('ddconv-zzzlive.pdf', false);

// Somebody else's temp data. Never ours to delete.
const foreignDir = mkDir('systemd-private-zzztest', true);
const foreignFile = mkFile('unrelated-zzztest.tmp', true);

const removed = sweepOnce();

check('removes stale directories from every prefix', staleDirs.every((p) => !fs.existsSync(p)),
  staleDirs.filter((p) => fs.existsSync(p)).join(', ') || 'all gone');
check('removes a stale multer upload file', !fs.existsSync(staleFile));
check('reports how many it removed', removed >= 5, String(removed));

check('LEAVES a directory an in-flight job is using', fs.existsSync(liveDir));
check('LEAVES an in-flight upload file', fs.existsSync(liveFile));

check('does not touch another program’s temp directory', fs.existsSync(foreignDir));
check('does not touch an unrelated temp file', fs.existsSync(foreignFile));

// Running twice must be harmless — both cluster instances sweep.
const second = sweepOnce();
check('a second sweep finds nothing and does not throw', second === 0, String(second));
check('the live job survived the second sweep too', fs.existsSync(liveDir) && fs.existsSync(liveFile));

for (const p of made) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ } }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
