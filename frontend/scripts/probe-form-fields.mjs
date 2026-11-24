// Stamp every text field of a form with its own short id, render the
// page to a PNG, and look at it. This is how the packet field maps get authored:
// by SEEING which box a given field name is, not by inferring it from a label
// heuristic that flips whenever a header sits above a box instead of beside it.
//
//   node scripts/probe-form-fields.mjs <short> <url> <page>   (PROBE_OUT=dir to choose where)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');
const qpdfFactory = require('../public/qpdf/qpdf.js');

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; DiemDesk form-field check)' };
console.warn = () => {};

const [short, url, pageArg] = process.argv.slice(2);
const wantPage = Number(pageArg || 1);

async function decrypt(bytes) {
  const mod = await qpdfFactory({ noInitialRun: true, print: () => {}, printErr: () => {} });
  mod.FS.writeFile('/in.pdf', bytes);
  try { mod.callMain(['--password=', '--decrypt', '/in.pdf', '/out.pdf']); }
  catch (e) { if (typeof e?.status !== 'number') throw e; }
  return mod.FS.readFile('/out.pdf');
}

const res = await fetch(url, { headers: UA });
let bytes = new Uint8Array(await res.arrayBuffer());
let doc;
try { doc = await PDFDocument.load(bytes); }
catch { bytes = await decrypt(bytes); doc = await PDFDocument.load(bytes); }

const form = doc.getForm();
const fields = form.getFields();
const legend = [];
let n = 0;
for (const f of fields) {
  if (f.constructor.name !== 'PDFTextField') continue;
  n += 1;
  const tag = `#${n}`;
  legend.push(`${tag}\t${f.getName()}`);
  try {
    f.setText(tag);
    f.setFontSize(7);
  } catch { /* some fields refuse; they still appear in the legend */ }
}
form.updateFieldAppearances();
const out = await doc.save();

const pdf = await pdfjs.getDocument({ data: new Uint8Array(out), useSystemFonts: false }).promise;
const page = await pdf.getPage(wantPage);
const viewport = page.getViewport({ scale: 2.2 });
const canvas = createCanvas(viewport.width, viewport.height);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, viewport.width, viewport.height);
await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
const png = canvas.toBuffer('image/png');
const outDir = process.env.PROBE_OUT || tmpdir();
const path = join(outDir, `probe-${short}-p${wantPage}.png`);
writeFileSync(path, png);
console.log(legend.join('\n'));
console.log(`\nPNG: ${path}`);
