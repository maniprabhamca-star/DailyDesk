#!/usr/bin/env node
/**
 * Module-level performance, stress and load bench.
 *
 * The E2E suite proves the tools work; it says nothing about where they stop
 * working. That question — how big a file, how many at once, how long before a
 * person gives up — only gets answered by running the real engines against real
 * documents and writing the numbers down. Page-load metrics don't answer it,
 * because the expensive part happens after the page has loaded.
 *
 * Three things, deliberately separated:
 *
 *   PERF   one operation, growing input, measured. Answers "how long".
 *   LOAD   many operations at once. Answers "does concurrency degrade it".
 *   STRESS escalate until it breaks, and record WHERE. A ceiling you have
 *          measured is a feature; a ceiling you discover in production is an
 *          outage.
 *
 * Output is JSON for the owner dashboard. Run: node scripts/qa-bench.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '../packages/sdk/node_modules/pdf-lib/cjs/index.js';
import {
  merge, extractPages, deletePages, rotate, removeMetadata, splitEvery, info,
} from '../packages/sdk/dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, "frontend", "lib", "qa-bench.generated.json");

const mb = (n) => Math.round((n / 1024 / 1024) * 100) / 100;
const ms = (n) => Math.round(n * 10) / 10;

/** A document with real page content, so we're not benching an empty file. */
async function makePdf(pages, { text = true } = {}) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) {
    const p = doc.addPage([595, 842]);
    if (text) {
      // Enough drawing to give the parser actual work per page.
      for (let line = 0; line < 30; line += 1) {
        p.drawText(`Page ${i + 1} line ${line} — the quick brown fox jumps over the lazy dog.`, {
          x: 40, y: 800 - line * 25, size: 9,
        });
      }
    }
  }
  return doc.save();
}

async function timed(fn) {
  const before = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const result = await fn();
  const elapsed = performance.now() - t0;
  const after = process.memoryUsage().heapUsed;
  return { elapsed, heapDeltaMb: mb(Math.max(0, after - before)), result };
}

/**
 * Median of several runs after a warm-up.
 *
 * The first version of this reported a 500-page document parsing faster than a
 * 200-page one, which is not a fact about the code — it is JIT warm-up and GC
 * landing in the middle of a single sample. A benchmark that produces obviously
 * impossible numbers teaches people to ignore the benchmark, so: one throwaway
 * pass to warm the code paths, then the median of three, which is far more
 * resistant to a stray GC pause than a mean.
 */
async function measure(fn, runs = 3) {
  await fn(); // warm-up, discarded
  const samples = [];
  let heapDeltaMb = 0;
  for (let i = 0; i < runs; i += 1) {
    const r = await timed(fn);
    samples.push(r.elapsed);
    heapDeltaMb = Math.max(heapDeltaMb, r.heapDeltaMb);
  }
  samples.sort((a, b) => a - b);
  return { elapsed: samples[Math.floor(samples.length / 2)], heapDeltaMb, spreadMs: ms(samples[samples.length - 1] - samples[0]) };
}

/* --------------------------------------------------------------- PERF */

async function perf(log) {
  const rows = [];
  for (const pages of [10, 50, 200, 500]) {
    const bytes = await makePdf(pages);
    const size = bytes.byteLength;

    const ops = {
      info: () => info(bytes),
      'extract half': () => extractPages(bytes, `1-${Math.max(1, Math.floor(pages / 2))}`),
      'delete first page': () => deletePages(bytes, '1'),
      'rotate all': () => rotate(bytes, { degrees: 90 }),
      'strip metadata': () => removeMetadata(bytes),
      'split every 10': () => splitEvery(bytes, 10),
    };

    for (const [op, fn] of Object.entries(ops)) {
      const { elapsed, heapDeltaMb, spreadMs } = await measure(fn);
      rows.push({ op, pages, inputMb: mb(size), ms: ms(elapsed), heapDeltaMb, spreadMs });
      log(`  PERF ${op.padEnd(18)} ${String(pages).padStart(4)}p ${String(mb(size)).padStart(6)}MB → ${ms(elapsed)}ms`);
    }
  }
  return rows;
}

/* --------------------------------------------------------------- LOAD */

async function load(log) {
  const rows = [];
  const bytes = await makePdf(50);
  // One at a time first, so "concurrent" has something to be measured against.
  const { elapsed: baseline } = await measure(() => rotate(bytes, { degrees: 90 }));

  for (const concurrency of [1, 4, 8, 16, 32]) {
    const { elapsed } = await timed(() =>
      Promise.all(Array.from({ length: concurrency }, () => rotate(bytes, { degrees: 90 }))));
    const perOp = elapsed / concurrency;
    rows.push({
      concurrency,
      totalMs: ms(elapsed),
      perOpMs: ms(perOp),
      // >1 means each operation got slower as the pile grew. Node is single
      // threaded here, so some degradation is expected and honest; a cliff is
      // the thing worth catching.
      degradation: Math.round((perOp / baseline) * 100) / 100,
    });
    log(`  LOAD ${String(concurrency).padStart(3)} concurrent → ${ms(elapsed)}ms total, ${ms(perOp)}ms each (×${Math.round((perOp / baseline) * 100) / 100} vs alone)`);
  }
  return { baselineMs: ms(baseline), rows };
}

/* ------------------------------------------------------------- STRESS */

async function stress(log) {
  const rows = [];
  // Escalate until something gives. Each step is recorded whether it passes or
  // fails, because the last passing row IS the documented ceiling.
  for (const pages of [1000, 2500, 5000]) {
    let row;
    try {
      const bytes = await makePdf(pages);
      const { elapsed, heapDeltaMb } = await timed(() => extractPages(bytes, 'all'));
      row = { scenario: `${pages}-page document`, pages, inputMb: mb(bytes.byteLength), ms: ms(elapsed), heapDeltaMb, outcome: 'ok' };
      log(`  STRESS ${String(pages).padStart(5)}p → ${ms(elapsed)}ms (${mb(bytes.byteLength)}MB)`);
    } catch (e) {
      row = { scenario: `${pages}-page document`, pages, outcome: 'failed', error: e instanceof Error ? e.message : String(e) };
      log(`  STRESS ${String(pages).padStart(5)}p → FAILED: ${row.error}`);
    }
    rows.push(row);
    if (row.outcome === 'failed') break;
  }

  // Many files into one — the merge path is where a bundle assembly dies.
  for (const count of [50, 200]) {
    try {
      const parts = await Promise.all(Array.from({ length: count }, () => makePdf(5)));
      const { elapsed } = await timed(() => merge(parts));
      rows.push({ scenario: `merge ${count} files × 5 pages`, files: count, ms: ms(elapsed), outcome: 'ok' });
      log(`  STRESS merge ${count} files → ${ms(elapsed)}ms`);
    } catch (e) {
      rows.push({ scenario: `merge ${count} files × 5 pages`, files: count, outcome: 'failed', error: e instanceof Error ? e.message : String(e) });
      log(`  STRESS merge ${count} files → FAILED`);
      break;
    }
  }
  return rows;
}

/* ---------------------------------------------------------------- run */

const log = (s) => process.stdout.write(`${s}\n`);
log('Module bench — real engines, real documents\n');

log('PERF — one operation, growing input');
const perfRows = await perf(log);
log('\nLOAD — many at once');
const loadResult = await load(log);
log('\nSTRESS — escalate until it breaks');
const stressRows = await stress(log);

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  perf: perfRows,
  load: loadResult,
  stress: stressRows,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));
log(`\nWrote ${OUT}`);
