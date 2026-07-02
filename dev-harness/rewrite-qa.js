// QA for the pdf-rewrite core (the exact code the worker + inline fallback
// run): merge, extract, split-each, split-chunks, page-numbers (template/
// margin/color) and watermark (over AND under layers, standard + custom font).
// Verifies outputs open in pdf.js, page counts are right, stamped text is
// really there (text extraction), and — for the 'under' layer — that the
// original text still renders ON TOP (ink present where the page text is).
// Rebuild the bundle after core changes:
//   npx -y esbuild frontend/lib/pdf-rewrite-core.ts --bundle --platform=node --format=cjs --external:pdf-lib --outfile=dev-harness/rewrite-core.cjs
// Usage: node rewrite-qa.js
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const { executeRewrite } = require('./rewrite-core.cjs');

const A = new Uint8Array(fs.readFileSync('jobber.pdf')).buffer; // 5 pages
const B = new Uint8Array(fs.readFileSync('gut-ftp1.pdf')).buffer; // 2 pages

let pass = true;
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) pass = false; };

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const open = async (bytes) => {
    const t = pdfjs.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: path.join(__dirname, 'node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/' });
    return { doc: await t.promise, destroy: () => t.destroy() };
  };
  const pageText = async (doc, n) => {
    const p = await doc.getPage(n);
    const tc = await p.getTextContent();
    return tc.items.map((i) => i.str).join(' ');
  };

  // ---- merge ----
  {
    const [out] = await executeRewrite([A.slice(0), B.slice(0)], { type: 'merge' });
    const { doc, destroy } = await open(out);
    ok(doc.numPages === 7, `merge: 5+2 pages -> ${doc.numPages}`);
    await destroy();
  }

  // ---- extract ----
  {
    const [out] = await executeRewrite([A.slice(0)], { type: 'extract', indices: [0, 2, 4] });
    const { doc, destroy } = await open(out);
    ok(doc.numPages === 3, `extract [1,3,5]: -> ${doc.numPages} pages`);
    await destroy();
  }

  // ---- split-each / split-chunks ----
  {
    const outs = await executeRewrite([A.slice(0)], { type: 'split-each' });
    ok(outs.length === 5, `split-each: -> ${outs.length} files`);
    const { doc, destroy } = await open(outs[4]);
    ok(doc.numPages === 1, 'split-each: last file has 1 page');
    await destroy();
    const chunks = await executeRewrite([A.slice(0)], { type: 'split-chunks', every: 2 });
    ok(chunks.length === 3, `split-chunks every 2: -> ${chunks.length} files (2+2+1)`);
    const last = await open(chunks[2]);
    ok(last.doc.numPages === 1, 'split-chunks: last chunk has 1 page');
    await last.destroy();
  }

  // ---- page numbers (custom template, wide margin, red) ----
  {
    const [out] = await executeRewrite([A.slice(0)], {
      type: 'page-numbers',
      opts: { pageNums: [1, 2, 3, 4, 5], start: 1, template: 'Sheet {n} of {p}', fontSize: 11, margin: 44, colorRgb: [0.86, 0.15, 0.15], pos: 'bc' },
    });
    const { doc, destroy } = await open(out);
    const t1 = await pageText(doc, 1);
    const t5 = await pageText(doc, 5);
    ok(t1.includes('Sheet 1 of 5'), `page-numbers p1 label: ${t1.slice(-40).trim()}`);
    ok(t5.includes('Sheet 5 of 5'), `page-numbers p5 label: ${t5.slice(-40).trim()}`);
    await destroy();
  }

  // ---- watermark: over + under, standard font ----
  for (const layer of ['over', 'under']) {
    const [out] = await executeRewrite([A.slice(0)], {
      type: 'watermark',
      opts: {
        mode: 'text', text: 'CONFIDENTIAL', colorRgb: [0.86, 0.15, 0.15], sizeFrac: 0.13, opacity: 1,
        position: 'mc', rotation: 45, imageScale: 0.35, layer, range: '', standardFont: 'Helvetica-Bold',
      },
    });
    const { doc, destroy } = await open(out);
    const t1 = await pageText(doc, 1);
    ok(t1.includes('CONFIDENTIAL'), `watermark(${layer}): stamp text present in page text`);
    // render p1 and check the ORIGINAL heading is still inked (under-layer must
    // not cover it; over-layer at opacity 1 through the middle may touch it,
    // so only assert for 'under').
    const p = await doc.getPage(1);
    const vp = p.getViewport({ scale: 1000 / p.getViewport({ scale: 1 }).width });
    const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await p.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
    fs.writeFileSync(`rewrite-wm-${layer}.png`, c.toBuffer('image/png'));
    if (layer === 'under') {
      // heading band (top ~15% — jobber p1 is landscape, heading sits ~9-12%):
      // dark original text pixels must still exist (i.e. content is ON TOP)
      const img = g.getImageData(0, 0, c.width, Math.round(c.height * 0.15)).data;
      let dark = 0;
      for (let i = 0; i < img.length; i += 4) if (img[i] < 90 && img[i + 1] < 90 && img[i + 2] < 90) dark++;
      ok(dark > 200, `watermark(under): original heading still inked on top (${dark} dark px)`);
      // and the red stamp must be visible somewhere mid-page
      const mid = g.getImageData(0, Math.round(c.height * 0.3), c.width, Math.round(c.height * 0.3)).data;
      let red = 0;
      for (let i = 0; i < mid.length; i += 4) if (mid[i] > 150 && mid[i + 1] < 110 && mid[i + 2] < 110) red++;
      ok(red > 500, `watermark(under): stamp visible in the gaps (${red} red px)`);
    }
    await destroy();
  }

  // ---- watermark: custom font bytes (Oswald) via fontkit ----
  {
    const fontBytes = new Uint8Array(fs.readFileSync(path.join(__dirname, '../frontend/public/fonts/oswald-bold.ttf'))).buffer;
    const [out] = await executeRewrite([B.slice(0)], {
      type: 'watermark',
      opts: {
        mode: 'text', text: 'DRAFT 123', colorRgb: [0.15, 0.39, 0.92], sizeFrac: 0.12, opacity: 0.5,
        position: 'tiled', rotation: 30, imageScale: 0.35, layer: 'over', range: '1', fontBytes,
      },
    });
    const { doc, destroy } = await open(out);
    const t1 = await pageText(doc, 1);
    ok(/D\s*R\s*A\s*F\s*T/.test(t1) || t1.includes('DRAFT'), 'watermark(custom font): stamped with embedded Oswald');
    ok(out.length < fs.readFileSync('gut-ftp1.pdf').length + 30000, `watermark(custom font): subset stays small (+${((out.length - fs.readFileSync('gut-ftp1.pdf').length) / 1024).toFixed(1)}KB)`);
    await destroy();
  }

  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
