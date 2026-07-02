// Visual QA for the jobber compression levers: render each page of A vs B at
// the same size, write side-by-side JPGs, report mean pixel delta per page.
// Usage: node jobber-diff.js original.pdf compressed.pdf
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const opts = (f) => ({
    data: new Uint8Array(fs.readFileSync(f)),
    wasmUrl: path.join(__dirname, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/',
    standardFontDataUrl: path.join(__dirname, 'node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/',
  });
  const [A, B] = [process.argv[2] || 'jobber.pdf', process.argv[3] || 'jobber-out-A+B+C.pdf'];
  const ta = pdfjs.getDocument(opts(A)); const da = await ta.promise;
  const tb = pdfjs.getDocument(opts(B)); const db = await tb.promise;
  const W = 1400;
  for (let p = 1; p <= Math.min(da.numPages, db.numPages); p++) {
    const render = async (doc) => {
      const page = await doc.getPage(p);
      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: W / vp1.width });
      const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
      return c;
    };
    const ca = await render(da), cb = await render(db);
    const ia = ca.getContext('2d').getImageData(0, 0, ca.width, ca.height).data;
    const ib = cb.getContext('2d').getImageData(0, 0, Math.min(ca.width, cb.width), Math.min(ca.height, cb.height)).data;
    let sum = 0, worst = 0, n = Math.min(ia.length, ib.length);
    for (let i = 0; i < n; i += 4) {
      const d = Math.abs(ia[i] - ib[i]) + Math.abs(ia[i + 1] - ib[i + 1]) + Math.abs(ia[i + 2] - ib[i + 2]);
      sum += d; if (d > worst) worst = d;
    }
    const side = createCanvas(ca.width * 2 + 8, ca.height);
    const sg = side.getContext('2d');
    sg.fillStyle = '#f00'; sg.fillRect(0, 0, side.width, side.height);
    sg.drawImage(ca, 0, 0); sg.drawImage(cb, ca.width + 8, 0);
    fs.writeFileSync(`jobber-diff-p${p}.jpg`, side.toBuffer('image/jpeg', 88));
    console.log(`page ${p}: mean delta ${(sum / (n / 4) / 3).toFixed(2)}/255, worst ${worst / 3 | 0}`);
  }
  await ta.destroy(); await tb.destroy();
})();
