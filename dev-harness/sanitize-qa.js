// QA for the Remove-PDF-metadata tool: runs the REAL shipping lib
// (frontend/lib/pdf-sanitize.ts bundled to sanitize-lib.cjs) on a real file.
// Verifies: scan finds the known fields; after stripping, a re-scan of the
// OUTPUT finds nothing; the output renders pixel-identically (metadata is
// invisible by definition — any pixel diff means we broke something).
// Usage: node sanitize-qa.js [file.pdf]
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const { PDFDocument } = require('pdf-lib');
const { scanDocMetadata, stripDocMetadata } = require('./sanitize-lib.cjs');

(async () => {
  const FILE = process.argv[2] || 'jobber.pdf';
  const bytes = new Uint8Array(fs.readFileSync(FILE));
  let pass = true;

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const before = await scanDocMetadata(doc);
  console.log(`scan: ${before.fields.length} fields (${before.fields.map((f) => f.key).join(', ')}), xmp ${before.xmpBytes}B, thumbs ${before.thumbs}, pieceInfo ${before.pieceInfo}`);

  const removed = await stripDocMetadata(doc);
  const out = await doc.save({ useObjectStreams: true });
  console.log(`stripped ${removed} items: ${bytes.length} -> ${out.length} B`);

  // re-scan the OUTPUT — must be empty
  const doc2 = await PDFDocument.load(new Uint8Array(out), { ignoreEncryption: true, updateMetadata: false });
  const after = await scanDocMetadata(doc2);
  const clean = after.fields.length === 0 && after.xmpBytes === 0 && after.thumbs === 0 && !after.pieceInfo;
  console.log(`re-scan of output: fields ${after.fields.length}, xmp ${after.xmpBytes}, thumbs ${after.thumbs}, pieceInfo ${after.pieceInfo} -> ${clean ? 'CLEAN' : 'NOT CLEAN'}`);
  if (!clean) pass = false;
  if (out.length >= bytes.length) console.log('note: output not smaller (ok if input had no XMP)');

  // pixel-identical render check, every page
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const opts = (data) => ({ data, standardFontDataUrl: path.join(__dirname, 'node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/' });
  const ta = pdfjs.getDocument(opts(bytes.slice())); const da = await ta.promise;
  const tb = pdfjs.getDocument(opts(new Uint8Array(out))); const db = await tb.promise;
  for (let p = 1; p <= da.numPages; p++) {
    const render = async (d) => {
      const page = await d.getPage(p);
      const vp = page.getViewport({ scale: 1000 / page.getViewport({ scale: 1 }).width });
      const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    };
    const [ia, ib] = [await render(da), await render(db)];
    let diff = 0;
    for (let i = 0; i < Math.min(ia.length, ib.length); i += 4) if (ia[i] !== ib[i] || ia[i + 1] !== ib[i + 1] || ia[i + 2] !== ib[i + 2]) diff++;
    if (diff > 0) { pass = false; console.log(`page ${p}: ${diff} px differ — FAIL`); }
    else console.log(`page ${p}: pixel-identical`);
  }
  await ta.destroy(); await tb.destroy();
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
