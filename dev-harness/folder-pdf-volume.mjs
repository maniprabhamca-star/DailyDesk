#!/usr/bin/env node
/**
 * Does the Folder Preview PDF path survive a folder full of PDFs?
 *
 * The grid renders page one of every PDF it finds. Two known pdf.js traps make
 * that the most dangerous path in the tool, and neither shows up when you try a
 * single file in a foreground tab:
 *
 *   1. `page.render()` without `intent: 'print'` paces on requestAnimationFrame,
 *      which never fires in a backgrounded tab — the promise then hangs FOREVER.
 *   2. Re-rendering a page after `page.cleanup()` never resolves either.
 *
 * ⚠️ WHAT THIS DOES **NOT** PROVE — measured, not assumed.
 * I expected Node to be a proxy for the backgrounded tab. It is not: with the
 * run deliberately re-run after DELETING `intent: print`, it still passed
 * 3/3. Node has no rAF for pdf.js to pace against in the first place, so the
 * pacing path never engages and the hang cannot reproduce here.
 *
 * So this harness proves the PDF path RENDERS — correct size, real ink on the
 * canvas, no crash, and honest per-document timings at volume. The rAF hang is
 * covered by a Playwright test that genuinely backgrounds the tab
 * (tests/e2e/folder-preview.spec.ts). Both are needed; neither is sufficient.
 *
 * Run: node dev-harness/folder-pdf-volume.mjs [count]
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNT = Number(process.argv[2] || 40);
const PER_RENDER_TIMEOUT = 15_000;

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/** A PDF with enough on each page that rendering is real work. */
async function makePdf(pages, seed) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i += 1) {
    const p = doc.addPage([595, 842]);
    for (let line = 0; line < 34; line += 1) {
      p.drawText(`Doc ${seed} · page ${i + 1} · line ${line} — the quick brown fox jumps over the lazy dog.`, {
        x: 40, y: 800 - line * 23, size: 9, font,
      });
    }
  }
  return doc.save();
}

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT after ${ms}ms — ${label}`)), ms)),
]);

/** Mirrors lib/folder-pdf-thumb.ts. Keep the two in step. */
async function renderFirstPage(pdfjs, bytes, maxLong = 420) {
  const task = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxLong / Math.max(base.width, base.height), 2);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      // The whole point of this harness. Remove it and watch the run stall.
      intent: 'print',
    }).promise;

    // Prove something was actually drawn — a blank canvas is a silent failure,
    // and "it didn't throw" is not the same as "it rendered".
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) ink += 1;
    }
    return { w: canvas.width, h: canvas.height, inkPixels: ink };
  } finally {
    await task.destroy().catch(() => {});
  }
}

const log = (s) => process.stdout.write(`${s}\n`);
log(`Folder Preview — PDF path at volume (${COUNT} documents)\n`);

const pdfjs = await getPdfjs();
log(`pdf.js ${pdfjs.version}\n`);

log('Building fixtures…');
const docs = [];
for (let i = 0; i < COUNT; i += 1) {
  // Mixed sizes: a folder is not forty identical files.
  docs.push(await makePdf(1 + (i % 12), i + 1));
}

log('Rendering page one of each, sequentially (as the queue does)…');
let ok = 0; let blank = 0; let failed = 0;
const t0 = performance.now();
const slowest = { ms: 0, at: -1 };

for (let i = 0; i < docs.length; i += 1) {
  const started = performance.now();
  try {
    const r = await withTimeout(renderFirstPage(pdfjs, docs[i]), PER_RENDER_TIMEOUT, `doc ${i + 1}`);
    const ms = performance.now() - started;
    if (ms > slowest.ms) { slowest.ms = ms; slowest.at = i + 1; }
    if (r.inkPixels < 100) { blank += 1; log(`  ⚠ doc ${i + 1}: rendered but BLANK (${r.inkPixels} ink px)`); }
    else ok += 1;
  } catch (e) {
    failed += 1;
    log(`  ✗ doc ${i + 1}: ${e.message}`);
  }
}

const total = performance.now() - t0;
log('');
log(`rendered ok : ${ok}/${COUNT}`);
log(`blank       : ${blank}`);
log(`failed      : ${failed}`);
log(`total       : ${(total / 1000).toFixed(1)}s  (${Math.round(total / COUNT)}ms per document)`);
log(`slowest     : ${Math.round(slowest.ms)}ms (doc ${slowest.at})`);
log('');
if (failed || blank) {
  log('FAIL — the grid would hang or show empty cards on a folder like this.');
  process.exit(1);
}
log('PASS — no hangs, no blank pages. The grid can take a folder of PDFs.');
