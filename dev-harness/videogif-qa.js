// QA for the Video→GIF encoder path. The video DECODE (seek + canvas) needs a
// real browser and is covered by live e2e; here we exercise the exact gifenc
// usage from frontend/lib/video-to-gif.ts (per-frame quantize -> applyPalette ->
// writeFrame with delay, and the loop `repeat` set only on the first frame) and
// assert the output is a structurally valid GIF89a. Usage: node videogif-qa.js
const path = require('path');
const { GIFEncoder, quantize, applyPalette } = require(path.join(__dirname, '../frontend/node_modules/gifenc'));

let pass = true;
const ok = (c, label) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}`); if (!c) pass = false; };

// Build a synthetic RGBA frame: a moving colored square on a gradient.
function frame(w, h, i, n) {
  const d = new Uint8ClampedArray(w * h * 4);
  const sx = Math.floor((i / n) * (w - 8));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const inSquare = x >= sx && x < sx + 8 && y >= h / 2 - 4 && y < h / 2 + 4;
    d[o] = inSquare ? 255 : (x / w) * 255;
    d[o + 1] = inSquare ? 0 : (y / h) * 255;
    d[o + 2] = inSquare ? 0 : 128;
    d[o + 3] = 255;
  }
  return d;
}

function encode(w, h, n, loop) {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / 12);
  for (let i = 0; i < n; i++) {
    const data = frame(w, h, i, n);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, i === 0 ? { palette, delay, repeat: loop ? 0 : -1 } : { palette, delay });
  }
  gif.finish();
  return gif.bytes();
}

// Count GIF image descriptors (0x2C image-separator, one per frame).
function countFrames(bytes) {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x2c) c++;
  return c;
}
function hasNetscapeLoop(bytes) {
  const sig = 'NETSCAPE2.0';
  for (let i = 0; i < bytes.length - sig.length; i++) {
    let m = true;
    for (let j = 0; j < sig.length; j++) if (bytes[i + j] !== sig.charCodeAt(j)) { m = false; break; }
    if (m) return true;
  }
  return false;
}

(() => {
  const w = 64, h = 48, n = 6;
  const g = encode(w, h, n, true);
  const magic = String.fromCharCode(...g.slice(0, 6));
  ok(magic === 'GIF89a', `magic is GIF89a (${magic})`);
  const sw = g[6] | (g[7] << 8), sh = g[8] | (g[9] << 8);
  ok(sw === w && sh === h, `logical screen ${sw}x${sh} == ${w}x${h}`);
  ok(g[g.length - 1] === 0x3b, `ends with GIF trailer 0x3B`);
  const frames = countFrames(g);
  ok(frames >= n, `>= ${n} image descriptors present (${frames})`);
  ok(hasNetscapeLoop(g), `NETSCAPE loop extension present (loop=forever)`);
  ok(g.length > 200, `non-trivial output (${g.length} bytes)`);

  // loop=false must OMIT the netscape loop extension (play once).
  const g2 = encode(w, h, n, false);
  ok(!hasNetscapeLoop(g2), `loop=false omits NETSCAPE extension (plays once)`);
  ok(String.fromCharCode(...g2.slice(0, 6)) === 'GIF89a', `loop=false still valid GIF89a`);

  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
})();
