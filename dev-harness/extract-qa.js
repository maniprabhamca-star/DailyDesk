// QA for the Extract Images tool — runs the REAL shipping engine
// (frontend/lib/pdf-extract-images.ts, bundled to extract-engine.cjs via
//   npx -y esbuild frontend/lib/pdf-extract-images.ts --bundle --platform=node --format=cjs --external:pdf-lib --outfile=dev-harness/extract-engine.cjs
// from the repo root) on a real PDF, then simulates the component's pdf.js
// recovery pass for whatever the engine reported as unhandled (JPX/CCITT/etc).
// Validates every output: JPEGs must start FFD8 + decode via @napi-rs/canvas at
// the declared dimensions; RGBA images must be non-uniform and PNG-encodable.
// Outputs land in extract-out/<file>/ for eyeballing.
//
// Usage: node extract-qa.js [pdf-path]   (default: gut-ftp1.pdf)
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('@napi-rs/canvas');
const { extractEmbeddedImages } = require('./extract-engine.cjs');

const FILE = process.argv[2] || path.join(__dirname, 'gut-ftp1.pdf');

(async () => {
  const t0 = Date.now();
  const bytes = new Uint8Array(fs.readFileSync(FILE));
  const outDir = path.join(__dirname, 'extract-out', path.basename(FILE).replace(/\.pdf$/i, ''));
  fs.mkdirSync(outDir, { recursive: true });

  const outcome = await extractEmbeddedImages(bytes);
  console.log(`engine: ${outcome.images.length} images, ${outcome.unhandled.length} unhandled, ${outcome.pageCount} pages, ${Date.now() - t0}ms`);

  let pass = true;
  let n = 0;
  for (const im of outcome.images) {
    n++;
    if (im.kind === 'jpeg') {
      const ok = im.bytes[0] === 0xff && im.bytes[1] === 0xd8;
      let decoded = null;
      try { decoded = await loadImage(Buffer.from(im.bytes)); } catch {}
      const dimsOk = decoded && decoded.width === im.width && decoded.height === im.height;
      if (!ok || !decoded || !dimsOk) { pass = false; console.log(`  FAIL jpeg #${n}: magic=${ok} decoded=${!!decoded} dims=${decoded ? `${decoded.width}x${decoded.height}` : '-'} vs ${im.width}x${im.height}`); }
      else console.log(`  ok jpeg #${n}: ${im.width}x${im.height}, ${(im.bytes.length / 1024).toFixed(1)}KB (original bytes)`);
      fs.writeFileSync(path.join(outDir, `image-${n}.jpg`), Buffer.from(im.bytes));
    } else {
      const px = im.data;
      const lenOk = px.length === im.width * im.height * 4;
      let min = 255, max = 0, aMin = 255, aMax = 0;
      for (let i = 0; i < px.length; i += 4) {
        const v = px[i]; if (v < min) min = v; if (v > max) max = v;
        const a = px[i + 3]; if (a < aMin) aMin = a; if (a > aMax) aMax = a;
      }
      // Uniform RGB is fine when the detail lives in the alpha channel
      // (solid-colour shapes defined by their SMask — e.g. watermark overlays).
      const uniform = min === max && aMin === aMax;
      const canvas = createCanvas(im.width, im.height);
      const cx = canvas.getContext('2d');
      cx.putImageData(new ImageData(px, im.width, im.height), 0, 0);
      const png = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(outDir, `image-${n}.png`), png);
      if (!lenOk || uniform) { pass = false; console.log(`  FAIL rgba #${n}: len=${lenOk} uniform=${uniform}`); }
      else console.log(`  ok rgba #${n}: ${im.width}x${im.height}, alpha=${im.hasAlpha} (a ${aMin}-${aMax}), val ${min}-${max}, png ${(png.length / 1024).toFixed(1)}KB`);
    }
  }

  // --- pdf.js recovery simulation (mirrors extract-images-tool's fallback) ---
  if (outcome.unhandled.length > 0) {
    const t1 = Date.now();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({
      data: bytes.slice(),
      wasmUrl: path.join(__dirname, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/',
      iccUrl: path.join(__dirname, 'node_modules/pdfjs-dist/iccs').replace(/\\/g, '/') + '/',
    });
    const doc = await task.promise;
    // Mirror of the component's logic: skip dims we already extracted (no
    // dupes), take everything else up to the unhandled budget. JPX streams can
    // report different dims than the PDF dict, so direct matching would miss.
    const handledDims = new Set(outcome.images.map((im) => `${im.width}x${im.height}`));
    const budget = outcome.unhandled.length;
    const seen = new Set();
    let recovered = 0;
    for (let p = 1; p <= doc.numPages && recovered < budget; p++) {
      let page, ops;
      try { page = await doc.getPage(p); ops = await page.getOperatorList(); } catch (e) { console.log(`  page ${p} oplist failed: ${e.message}`); continue; }
      for (let i = 0; i < ops.fnArray.length && recovered < budget; i++) {
        const fn = ops.fnArray[i];
        if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat) continue;
        const objId = ops.argsArray[i][0];
        if (seen.has(objId)) continue;
        seen.add(objId);
        // Callback form — image data arrives async, after the oplist resolves.
        const img = await new Promise((resolve) => {
          const store = objId.startsWith('g_') ? page.commonObjs : page.objs;
          let settled = false;
          const t = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 15000);
          try { store.get(objId, (v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } }); }
          catch { clearTimeout(t); if (!settled) { settled = true; resolve(null); } }
        });
        if (!img || !img.width || !img.height) continue;
        if (img.width < 24 || img.height < 24) continue;
        const key = `${img.width}x${img.height}`;
        if (handledDims.has(key)) continue;
        // Node has no ImageBitmap path — expect .data + kind (1/2/3)
        let px = null;
        if (img.data) {
          px = new Uint8ClampedArray(img.width * img.height * 4);
          if (img.kind === 3) px.set(img.data);
          else if (img.kind === 2) { for (let q = 0, s = 0; q < px.length; q += 4) { px[q] = img.data[s++]; px[q + 1] = img.data[s++]; px[q + 2] = img.data[s++]; px[q + 3] = 255; } }
          else if (img.kind === 1) {
            const stride = Math.ceil(img.width / 8);
            for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
              const bit = (img.data[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1, v = bit ? 255 : 0, q = (y * img.width + x) * 4;
              px[q] = v; px[q + 1] = v; px[q + 2] = v; px[q + 3] = 255;
            }
          } else { console.log(`  recover: unknown kind ${img.kind} for ${key}`); continue; }
        } else if (img.bitmap) { console.log(`  recover: got ImageBitmap for ${key} (browser path — ok, skipping in Node)`); recovered++; continue; }
        else continue;
        let min = 255, max = 0, hasAlpha = false;
        for (let q = 0; q < px.length; q += 4) { const v = px[q]; if (v < min) min = v; if (v > max) max = v; if (px[q + 3] < 255) hasAlpha = true; }
        const canvas = createCanvas(img.width, img.height);
        const cx = canvas.getContext('2d');
        cx.putImageData(new ImageData(px, img.width, img.height), 0, 0);
        n++; recovered++;
        // Component behaviour: bilevel/transparent -> PNG, photos -> JPG q90.
        const asPng = img.kind === 1 || hasAlpha;
        const buf = asPng ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', 90);
        fs.writeFileSync(path.join(outDir, `image-${n}-recovered.${asPng ? 'png' : 'jpg'}`), buf);
        if (min === max) { pass = false; console.log(`  FAIL recovered #${n}: uniform pixels (${key})`); }
        else if (n <= 8 || n % 25 === 0) console.log(`  ok recovered #${n}: ${key}, val ${min}-${max}, ${asPng ? 'png' : 'jpg'} ${(buf.length / 1024).toFixed(0)}KB`);
      }
      if (page) page.cleanup();
    }
    await task.destroy();
    console.log(`recovery: ${recovered}/${outcome.unhandled.length} recovered in ${Date.now() - t1}ms`);
    if (recovered === 0 && outcome.unhandled.length > 0) pass = false;
  }

  console.log(`\nTOTAL: ${n} images extracted -> ${outDir}`);
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})();
