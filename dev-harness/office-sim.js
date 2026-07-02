// Simulate the NEW office-PDF surgical pass (FlateDecode screenshots → JPEG)
// on the user's real file. Mirrors compress-tool.tsx logic (maxDim fallback path).
const fs = require('fs');
const zlib = require('zlib');
const { createCanvas, ImageData } = require('@napi-rs/canvas');
const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray } = require('pdf-lib');

const FILE = 'C:/Users/Test/Downloads/FTP Access Dropship (2).pdf';
const LEVEL = { dpi: 150, maxDim: 1800, quality: 74 }; // recommended

function pngUnfilter(data, columns, rows, colors) {
  const stride = columns * colors;
  if (data.length < (stride + 1) * rows) return null;
  const out = new Uint8Array(stride * rows);
  let p = 0;
  for (let y = 0; y < rows; y++) {
    const ft = data[p++];
    const row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const raw = data[p++];
      const a = x >= colors ? out[row + x - colors] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= colors && y > 0 ? out[prev + x - colors] : 0;
      let v;
      if (ft === 0) v = raw; else if (ft === 1) v = raw + a; else if (ft === 2) v = raw + b;
      else if (ft === 3) v = raw + ((a + b) >> 1);
      else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      else return null;
      out[row + x] = v & 255;
    }
  }
  return out;
}

(async () => {
  const original = fs.readFileSync(FILE);
  const doc = await PDFDocument.load(new Uint8Array(original), { ignoreEncryption: true });
  const ctx = doc.context;
  let recompressed = 0, savedBytes = 0;

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (String(d.get(PDFName.of('Subtype'))) !== '/Image') continue;
    if (d.get(PDFName.of('ImageMask')) || d.get(PDFName.of('SMask')) || d.get(PDFName.of('Mask'))) continue;
    const filter = String(d.get(PDFName.of('Filter')));
    const w = Number(d.get(PDFName.of('Width'))), h = Number(d.get(PDFName.of('Height')));
    const raw = obj.contents;
    if (!w || !h || raw.length < 1024) continue;

    let imageData = null;
    if (filter === '/FlateDecode') {
      if (Number(d.get(PDFName.of('BitsPerComponent'))) !== 8) continue;
      if (w * h < 100 * 100 || raw.length < 2048) continue;
      const cs = ctx.lookup(d.get(PDFName.of('ColorSpace')));
      let channels = null;
      const s = String(cs);
      if (s === '/DeviceRGB') channels = 3; else if (s === '/DeviceGray') channels = 1;
      else if (cs instanceof PDFArray && String(cs.get(0)) === '/ICCBased') {
        const icc = ctx.lookup(cs.get(1));
        const n = icc instanceof PDFRawStream ? Number(icc.dict.get(PDFName.of('N'))) : NaN;
        channels = n === 3 ? 3 : n === 1 ? 1 : null;
      }
      if (!channels) { console.log('skip cs', s); continue; }
      let samples = zlib.inflateSync(Buffer.from(raw));
      const parms = ctx.lookup(d.get(PDFName.of('DecodeParms')));
      if (parms && parms.get) {
        const pred = Number(parms.get(PDFName.of('Predictor')) || 1);
        if (pred >= 10) samples = pngUnfilter(new Uint8Array(samples), Number(parms.get(PDFName.of('Columns')) || w), h, Number(parms.get(PDFName.of('Colors')) || channels));
        else if (pred !== 1) continue;
      }
      if (!samples || samples.length < w * h * channels) { console.log('short samples'); continue; }
      imageData = new ImageData(w, h);
      for (let i = 0, sp = 0; i < w * h; i++) {
        if (channels === 3) { imageData.data[i * 4] = samples[sp++]; imageData.data[i * 4 + 1] = samples[sp++]; imageData.data[i * 4 + 2] = samples[sp++]; }
        else { const g = samples[sp++]; imageData.data[i * 4] = g; imageData.data[i * 4 + 1] = g; imageData.data[i * 4 + 2] = g; }
        imageData.data[i * 4 + 3] = 255;
      }
    } else continue; // DCT path unchanged — skipping here (below target anyway)

    const canvas = createCanvas(w, h);
    const cx2 = canvas.getContext('2d');
    cx2.fillStyle = '#fff'; cx2.fillRect(0, 0, w, h);
    cx2.putImageData(imageData, 0, 0);
    const jpg = canvas.toBuffer('image/jpeg', 80);
    if (jpg.length < raw.length) {
      const ns = PDFRawStream.of(d, new Uint8Array(jpg));
      ns.dict.set(PDFName.of('Width'), PDFNumber.of(w));
      ns.dict.set(PDFName.of('Height'), PDFNumber.of(h));
      ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      ns.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      ns.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      ns.dict.delete(PDFName.of('DecodeParms'));
      ns.dict.delete(PDFName.of('Decode'));
      ctx.assign(ref, ns);
      recompressed++;
      savedBytes += raw.length - jpg.length;
      console.log(`recompressed ${w}x${h}: ${(raw.length / 1024).toFixed(0)}KB -> ${(jpg.length / 1024).toFixed(0)}KB`);
    }
  }

  const out = await doc.save({ useObjectStreams: true });
  fs.writeFileSync('office-compressed.pdf', out);
  console.log(`\n${recompressed} images recompressed, image savings ${(savedBytes / 1024).toFixed(0)}KB`);
  console.log(`RESULT: ${(original.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB (${Math.round(100 * (1 - out.length / original.length))}% saved)`);
  console.log('(Smallpdf on this file: 170KB -> 82KB, 52% — the rest of the gap = font subsetting, next milestone)');

  // validity + visual check
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const t = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('office-compressed.pdf')) });
  const d2 = await t.promise;
  const page = await d2.getPage(1);
  const vp = page.getViewport({ scale: 1000 / page.getViewport({ scale: 1 }).width });
  const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvas: c, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
  fs.writeFileSync('office-check.jpg', c.toBuffer('image/jpeg', 85));
  console.log(`output opens: ${d2.numPages} pages; wrote office-check.jpg`);
  await t.destroy();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
