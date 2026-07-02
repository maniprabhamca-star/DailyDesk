// QA for the watermark custom fonts: embed each bundled TTF with
// @pdf-lib/fontkit (subset:true, same as watermark-tool), stamp text, render
// with pdf.js and verify ink was drawn + measure the embedded-font overhead.
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const { PDFDocument, rgb, degrees } = require(path.join(__dirname, '../frontend/node_modules/pdf-lib'));
const fkMod = require(path.join(__dirname, '../frontend/node_modules/@pdf-lib/fontkit'));
const fontkit = fkMod.default || fkMod;

const FONTS_DIR = path.join(__dirname, '../frontend/public/fonts');
const FILES = fs.readdirSync(FONTS_DIR).filter((f) => f.endsWith('.ttf'));

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let pass = true;
  for (const f of FILES) {
    try {
      const doc = await PDFDocument.create();
      doc.registerFontkit(fontkit);
      const bytes = new Uint8Array(fs.readFileSync(path.join(FONTS_DIR, f)));
      const font = await doc.embedFont(bytes, { subset: true });
      const page = doc.addPage([612, 792]);
      const text = 'CONFIDENTIAL 123';
      const w = font.widthOfTextAtSize(text, 48);
      page.drawText(text, { x: 50, y: 400, size: 48, font, color: rgb(0.8, 0.1, 0.1), opacity: 0.5, rotate: degrees(15) });
      const out = await doc.save();
      // render + ink check
      const task = pdfjs.getDocument({ data: new Uint8Array(out) });
      const d2 = await task.promise;
      const p1 = await d2.getPage(1);
      const vp = p1.getViewport({ scale: 1 });
      const c = createCanvas(612, 792);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 612, 792);
      await p1.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
      const px = g.getImageData(0, 300, 612, 300).data;
      let ink = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 240 || px[i + 1] < 240 || px[i + 2] < 240) ink++;
      await task.destroy();
      const ok = ink > 500 && w > 100 && out.length < 60000;
      if (!ok) pass = false;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}: width=${w.toFixed(0)} ink=${ink}px pdf=${(out.length / 1024).toFixed(1)}KB (subset)`);
      if (f === FILES[0]) fs.writeFileSync('wmfont-sample.png', c.toBuffer('image/png'));
    } catch (e) {
      pass = false;
      console.log(`FAIL ${f}: ${e.message}`);
    }
  }
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})();
