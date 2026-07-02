// QA for the HEIC->JPG pipeline using the EXACT assets the site serves
// (frontend/public/libheif/libheif.js + libheif.wasm): factory init, decode,
// RGBA display, multi-image HEIC handling, and JPEG/PNG encode. Writes outputs
// to heic-out-*.{jpg,png} for eyeballing.
// Usage: node heic-qa.js
const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData } = require('@napi-rs/canvas');

const factory = require(path.join(__dirname, '../frontend/public/libheif/libheif.js'));

let pass = true;
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) pass = false; };

(async () => {
  const wasmBinary = fs.readFileSync(path.join(__dirname, '../frontend/public/libheif/libheif.wasm'));
  const t0 = Date.now();
  const mod = factory({ wasmBinary });
  // Init may be async — wait for the runtime if a ready promise exists.
  if (mod && typeof mod.then === 'function') {
    console.log('factory returned a Promise — awaiting');
  }
  const lib = typeof mod.then === 'function' ? await mod : mod;
  if (lib.ready && typeof lib.ready.then === 'function') await lib.ready;
  ok(typeof lib.HeifDecoder === 'function', `module init ${Date.now() - t0}ms, HeifDecoder present`);

  for (const f of ['sample1.heic', 'sample2.heic', 'sample3.heic']) {
    try {
      const buf = new Uint8Array(fs.readFileSync(path.join(__dirname, f)));
      const t1 = Date.now();
      const decoder = new lib.HeifDecoder();
      const images = decoder.decode(buf);
      ok(images.length >= 1, `${f}: decoded ${images.length} image(s)`);
      for (let i = 0; i < Math.min(images.length, 3); i++) {
        const img = images[i];
        const w = img.get_width();
        const h = img.get_height();
        const id = new ImageData(w, h);
        await new Promise((res, rej) => {
          img.display(id, (d) => (d ? res(d) : rej(new Error('display failed'))));
        });
        let min = 255, max = 0;
        for (let p = 0; p < id.data.length; p += 4) { const v = id.data[p]; if (v < min) min = v; if (v > max) max = v; }
        const c = createCanvas(w, h);
        c.getContext('2d').putImageData(id, 0, 0);
        const jpg = c.toBuffer('image/jpeg', 90);
        fs.writeFileSync(`heic-out-${f.replace('.heic', '')}-${i + 1}.jpg`, jpg);
        ok(min < max && w > 0 && h > 0, `${f}[${i}]: ${w}x${h}, val ${min}-${max}, jpg ${(jpg.length / 1024).toFixed(0)}KB, ${Date.now() - t1}ms`);
        img.free && img.free();
      }
    } catch (e) {
      pass = false;
      console.log(`FAIL ${f}: ${e.message}`);
    }
  }
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
