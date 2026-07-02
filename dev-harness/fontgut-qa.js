// Corruption QA: render EVERY page of original vs font-gutted PDF at identical
// settings and pixel-diff. Any missing/blank glyph shows up as a diff.
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const A = process.argv[2] || 'C:/Users/Test/Downloads/FTP Access Dropship (2).pdf';
const B = process.argv[3] || 'fontgut-out.pdf';

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const opts = (f) => ({
    data: new Uint8Array(fs.readFileSync(f)),
    wasmUrl: path.join(__dirname, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/',
    iccUrl: path.join(__dirname, 'node_modules/pdfjs-dist/iccs').replace(/\\/g, '/') + '/',
    standardFontDataUrl: path.join(__dirname, 'node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/',
  });
  const ta = pdfjs.getDocument(opts(A)); const da = await ta.promise;
  const tb = pdfjs.getDocument(opts(B)); const db = await tb.promise;
  if (da.numPages !== db.numPages) { console.log('PAGE COUNT MISMATCH'); process.exit(1); }

  const render = async (doc, n) => {
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1200 / Math.max(p.getViewport({ scale: 1 }).width, p.getViewport({ scale: 1 }).height) });
    const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await p.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
    p.cleanup();
    return c;
  };

  let worst = 0, worstPage = 0;
  for (let n = 1; n <= da.numPages; n++) {
    const ca = await render(da, n), cb = await render(db, n);
    const ia = ca.getContext('2d').getImageData(0, 0, ca.width, ca.height).data;
    const ib = cb.getContext('2d').getImageData(0, 0, cb.width, cb.height).data;
    let diff = 0;
    for (let i = 0; i < ia.length; i += 4) {
      if (Math.abs(ia[i] - ib[i]) > 8 || Math.abs(ia[i + 1] - ib[i + 1]) > 8 || Math.abs(ia[i + 2] - ib[i + 2]) > 8) diff++;
    }
    const pct = (100 * diff) / (ia.length / 4);
    console.log(`page ${n}: ${diff} differing px (${pct.toFixed(3)}%)`);
    if (pct > worst) { worst = pct; worstPage = n; }
    if (n === worstPage && diff > 0) {
      fs.writeFileSync(`qa-p${n}-a.png`, ca.toBuffer('image/png'));
      fs.writeFileSync(`qa-p${n}-b.png`, cb.toBuffer('image/png'));
    }
  }
  console.log(worst === 0 ? '\nPIXEL-IDENTICAL — no corruption.' : `\nworst page ${worstPage}: ${worst.toFixed(3)}% differing (inspect qa-p${worstPage}-a/b.png)`);
  await ta.destroy(); await tb.destroy();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
