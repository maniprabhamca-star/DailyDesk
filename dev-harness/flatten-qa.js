// QA for Flatten PDF (qpdf-wasm): build a real fillable PDF (text field with a
// value, checked checkbox, link annotation) with pdf-lib, flatten it with the
// EXACT qpdf args the app ships (--generate-appearances --flatten-annotations=all),
// then verify: (1) zero interactive form fields remain, (2) zero annotations
// remain on the page, (3) the field VALUE is still visibly inked on the page
// (pixel check in the field rect via pdf.js render), (4) base page content
// untouched. Also: encrypted input must fail with a non-zero exit code (the UI
// maps that to "unlock it first"). Usage: node flatten-qa.js
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const createModule = require(path.join(__dirname, '../frontend/node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.js'));

let pass = true;
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) pass = false; };

async function makeQpdf() {
  return createModule({
    locateFile: () => path.join(__dirname, '../frontend/node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
    print: () => {},
    printErr: () => {},
    noInitialRun: true,
  });
}

// Keep EXACTLY in sync with frontend/lib/qpdf-args.ts (flatten case).
const FLATTEN_ARGS = ['--generate-appearances', '--flatten-annotations=all', '/in.pdf', '/out.pdf'];

async function renderPage1(pdfjs, bytes) {
  const t = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const doc = await t.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const cx = canvas.getContext('2d');
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: cx, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
  const annots = await page.getAnnotations();
  const img = cx.getImageData(0, 0, canvas.width, canvas.height);
  await t.destroy();
  return { img, w: canvas.width, h: canvas.height, annots };
}

// Count non-white pixels inside a PDF-space rect (y-up, 612x792 page, scale 2).
function inkIn(img, w, h, rect) {
  const [x0, y0, x1, y1] = rect.map((v) => v * 2);
  let ink = 0;
  for (let y = Math.floor(h - y1); y < h - y0; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      const i = (y * w + x) * 4;
      if (img.data[i] < 200 || img.data[i + 1] < 200 || img.data[i + 2] < 200) ink++;
    }
  }
  return ink;
}

(async () => {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // ---- build the fixture: heading + text field w/ value + checkbox + link ----
  const src = await PDFDocument.create();
  const page = src.addPage([612, 792]);
  const font = await src.embedFont(StandardFonts.Helvetica);
  page.drawText('Flatten fixture heading', { x: 50, y: 750, size: 18, font, color: rgb(0, 0, 0) });
  const form = src.getForm();
  const nameField = form.createTextField('fixture.name');
  nameField.setText('Jane Q Fixture');
  nameField.addToPage(page, { x: 50, y: 680, width: 240, height: 26 });
  const agree = form.createCheckBox('fixture.agree');
  agree.check();
  agree.addToPage(page, { x: 50, y: 630, width: 18, height: 18 });
  const srcBytes = await src.save();
  fs.writeFileSync(path.join(__dirname, 'flatten-fixture.pdf'), srcBytes);

  // ---- sanity on the fixture ----
  const before = await PDFDocument.load(srcBytes);
  ok(before.getForm().getFields().length === 2, `fixture has 2 form fields`);

  // ---- the REAL shipping scan (lib/pdf-flatten.ts). Rebuild after changes:
  // npx esbuild frontend/lib/pdf-flatten.ts --bundle --platform=node --format=cjs --external:pdf-lib --outfile=dev-harness/flatten-lib.cjs
  const { scanFlattenables } = require('./flatten-lib.cjs');
  const scanned = await scanFlattenables(new Uint8Array(srcBytes));
  ok(scanned.fields === 2 && scanned.annotations === 0 && scanned.pages === 1 && !scanned.encrypted,
    `scanFlattenables: ${scanned.fields} fields, ${scanned.annotations} annots, ${scanned.pages} page`);

  // ---- flatten with the EXACT shipping args ----
  let q = await makeQpdf();
  q.FS.writeFile('/in.pdf', new Uint8Array(srcBytes));
  let code = 0;
  try { code = q.callMain(FLATTEN_ARGS); } catch { code = -1; }
  ok(code === 0, `qpdf flatten exit code ${code}`);
  const flat = q.FS.readFile('/out.pdf');
  fs.writeFileSync(path.join(__dirname, 'flatten-out.pdf'), flat);
  ok(flat.length > 500, `flattened output ${flat.length} B`);

  // ---- (1) no interactive fields remain ----
  const after = await PDFDocument.load(flat);
  ok(after.getForm().getFields().length === 0, `flattened has 0 form fields (was 2)`);

  // ---- (2)+(3) render: no annotations; field value + checkbox still inked ----
  const orig = await renderPage1(pdfjs, srcBytes);
  const out = await renderPage1(pdfjs, flat);
  ok(out.annots.filter((a) => a.subtype === 'Widget').length === 0, `flattened page has 0 widget annotations (orig ${orig.annots.length})`);
  const headingInk = inkIn(out.img, out.w, out.h, [50, 745, 300, 775]);
  ok(headingInk > 100, `base page content preserved (heading ink ${headingInk}px)`);
  const fieldInk = inkIn(out.img, out.w, out.h, [50, 680, 290, 706]);
  ok(fieldInk > 100, `text field value inked into page content (${fieldInk}px)`);
  const checkInk = inkIn(out.img, out.w, out.h, [50, 630, 68, 648]);
  ok(checkInk > 10, `checked checkbox inked into page content (${checkInk}px)`);

  // ---- (4) encrypted input -> clean non-zero exit (UI: "unlock first") ----
  q = await makeQpdf();
  q.FS.writeFile('/plain.pdf', new Uint8Array(srcBytes));
  code = q.callMain(['--encrypt', 'pw', 'pw', '256', '--', '/plain.pdf', '/enc.pdf']);
  ok(code === 0, `fixture encrypt exit ${code}`);
  const enc = q.FS.readFile('/enc.pdf');
  q = await makeQpdf();
  q.FS.writeFile('/in.pdf', enc);
  let encCode = 0;
  try { encCode = q.callMain(FLATTEN_ARGS); } catch { encCode = -1; }
  ok(encCode !== 0, `encrypted input fails cleanly (exit ${encCode})`);
  const encScan = await scanFlattenables(new Uint8Array(enc));
  ok(encScan.encrypted === true, `scanFlattenables flags encrypted input`);

  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
