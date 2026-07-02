// Faithful end-to-end simulation of the app's NEW compress pipeline on the real
// 27MB JPX file: content-stream scan analysis -> per-page raster targets (never
// upscale) -> pdf.js v6 WASM render -> JPEG encode -> pdf-lib rebuild.
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const { PDFDocument, PDFName, PDFRawStream, PDFArray } = require('pdf-lib');

const FILE = 'C:/Users/Test/Downloads/Step6-TalentGum.pdf';
const LEVEL = { rasterDpi: Number(process.argv[2] || 100), rasterQ: Number(process.argv[3] || 52), rasterFrac: Number(process.argv[4] || 0.5) };
const MAX_RASTER = 4000, RASTER_FLOOR_PX = 1100;

const NAME_START = /[A-Za-z'"*]/, NUM_START = /[-+.\d]/, NUM_CHAR = /[-+.\dEe]/, OP_CHAR = /[A-Za-z\d'"*]/, NAME_STOP = /[\s/<>[\]()%]/;
function concatMatrix(ctm, m) {
  const [A, B, C, D, E, F] = m, [a, b, c, d, e, f] = ctm;
  return [A * a + B * c, A * b + B * d, C * a + D * c, C * b + D * d, E * a + F * c + e, E * b + F * d + f];
}
function scanContent(content, nameToTag, sizes) {
  let i = 0; const n = content.length; let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; let ops = []; let lastName = null;
  let maxArea = 0;
  while (i < n) {
    const ch = content[i];
    if (ch === '%') { while (i < n && content[i] !== '\n' && content[i] !== '\r') i++; continue; }
    if (ch === '(') { let dp = 1; i++; while (i < n && dp > 0) { if (content.charCodeAt(i) === 92) { i += 2; continue; } if (content[i] === '(') dp++; else if (content[i] === ')') dp--; i++; } ops = []; continue; }
    if (ch === '<' && content[i + 1] === '<') { i += 2; while (i < n && !(content[i] === '>' && content[i + 1] === '>')) i++; i += 2; ops = []; continue; }
    if (ch === '<') { i++; while (i < n && content[i] !== '>') i++; i++; continue; }
    if (ch === '/') { let j = i + 1; while (j < n && !NAME_STOP.test(content[j])) j++; lastName = content.slice(i, j); i = j; continue; }
    if (NUM_START.test(ch)) { let j = i; while (j < n && NUM_CHAR.test(content[j])) j++; ops.push(parseFloat(content.slice(i, j))); i = j; continue; }
    if (NAME_START.test(ch)) {
      let j = i; while (j < n && OP_CHAR.test(content[j])) j++; const op = content.slice(i, j); i = j;
      if (op === 'q') stack.push(ctm.slice());
      else if (op === 'Q') ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (op === 'cm' && ops.length >= 6) ctm = concatMatrix(ctm, ops.slice(-6));
      else if (op === 'Do' && lastName) { const tag = nameToTag.get(lastName); if (tag) { const sx = Math.hypot(ctm[0], ctm[1]), sy = Math.hypot(ctm[2], ctm[3]); const disp = Math.max(sx, sy); if (disp > (sizes.get(tag) || 0)) sizes.set(tag, disp); const area = sx * sy; if (area > maxArea) maxArea = area; } }
      else if (op === 'BI') { const ei = content.indexOf('EI', i); i = ei < 0 ? n : ei + 2; }
      ops = []; continue;
    }
    i++;
  }
  return maxArea;
}
async function inflateDeflate(bytes) {
  try {
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

(async () => {
  const t0 = Date.now();
  const original = new Uint8Array(fs.readFileSync(FILE));
  const doc = await PDFDocument.load(original.slice(), { ignoreEncryption: true });
  const ctx = doc.context;
  const { rasterDpi, rasterQ, rasterFrac } = LEVEL;

  // --- analysis pass (mirrors the app) ---
  const displaySizes = new Map();
  const scanPages = new Set();
  const rasterTargetPx = new Map();
  const dec = new TextDecoder('latin1');
  const pages = doc.getPages();
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const res = page.node.Resources();
    const xobjs = res ? res.lookup(PDFName.of('XObject')) : undefined;
    if (!xobjs || typeof xobjs.keys !== 'function') continue;
    const nameToTag = new Map();
    let maxStoredPx = 0;
    for (const k of xobjs.keys()) {
      const r = xobjs.get(k);
      const tag = r && r.tag;
      if (!tag) continue;
      nameToTag.set(String(k), tag);
      try {
        const o = ctx.lookup(r);
        if (o instanceof PDFRawStream) {
          const px = Math.max(Number(o.dict.get(PDFName.of('Width'))) || 0, Number(o.dict.get(PDFName.of('Height'))) || 0);
          if (px > maxStoredPx) maxStoredPx = px;
        }
      } catch { }
    }
    if (nameToTag.size === 0) continue;
    const contents = page.node.Contents();
    const streams = [];
    if (contents instanceof PDFArray) for (const r of contents.asArray()) streams.push(ctx.lookup(r));
    else if (contents) streams.push(contents);
    let text = '';
    for (const s of streams) {
      if (!(s instanceof PDFRawStream)) continue;
      if (s.dict.get(PDFName.of('DecodeParms'))) { text = ''; break; }
      const f = s.dict.get(PDFName.of('Filter'));
      const fs2 = f ? String(f) : '';
      let b = s.contents;
      if (fs2 === '/FlateDecode') b = await inflateDeflate(b);
      else if (fs2) b = null;
      if (b) text += dec.decode(b);
    }
    if (text) {
      const maxArea = scanContent(text, nameToTag, displaySizes);
      const { width, height } = page.getSize();
      const pageLongPt = Math.max(width, height);
      const dpiTargetPx = (rasterDpi / 72) * pageLongPt;
      const fracCapPx = maxStoredPx > 0 ? Math.min(maxStoredPx, Math.max(rasterFrac * maxStoredPx, RASTER_FLOOR_PX)) : Infinity;
      const targetPx = Math.min(dpiTargetPx, fracCapPx);
      const worthIt = maxStoredPx > 0 && targetPx <= maxStoredPx * 0.87;
      if (width > 0 && height > 0 && maxArea >= 0.7 * width * height && worthIt) {
        scanPages.add(pi);
        rasterTargetPx.set(pi, targetPx);
      }
    }
  }
  console.log(`analysis: ${Date.now() - t0}ms, scan pages flagged: ${scanPages.size}/${pages.length}`);
  const targets = [...rasterTargetPx.values()];
  if (targets.length) console.log(`raster targets: min ${Math.min(...targets).toFixed(0)}px, max ${Math.max(...targets).toFixed(0)}px`);

  // --- raster pass (pdf.js v6 WASM) ---
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: original.slice(),
    wasmUrl: path.join(__dirname, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/',
    iccUrl: path.join(__dirname, 'node_modules/pdfjs-dist/iccs').replace(/\\/g, '/') + '/',
  });
  const jsDoc = await task.promise;
  const outDoc = await PDFDocument.create();
  let rasterized = 0, copied = 0;
  for (let i = 0; i < pages.length; i++) {
    let placed = false;
    if (scanPages.has(i)) {
      try {
        const jp = await jsDoc.getPage(i + 1);
        const vp1 = jp.getViewport({ scale: 1 });
        const pageLongPt = Math.max(vp1.width, vp1.height);
        const targetPx = Math.min(MAX_RASTER, rasterTargetPx.get(i) ?? (rasterDpi / 72) * pageLongPt);
        const s = targetPx / pageLongPt;
        const vp = jp.getViewport({ scale: s });
        const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
        const cx = canvas.getContext('2d');
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
        await jp.render({ canvas, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
        const jpg = canvas.toBuffer('image/jpeg', rasterQ);
        const img = await outDoc.embedJpg(jpg);
        const p = outDoc.addPage([vp1.width, vp1.height]);
        p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
        rasterized++; placed = true;
        jp.cleanup();
      } catch (e) { console.log(`page ${i + 1} raster failed: ${e.message}`); }
    }
    if (!placed) { const [cp] = await outDoc.copyPages(doc, [i]); outDoc.addPage(cp); copied++; }
  }
  const outBytes = await outDoc.save({ useObjectStreams: true });
  await task.destroy();

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`rasterized ${rasterized}, copied ${copied}, total ${secs}s`);
  console.log(`RESULT: ${(original.length / 1048576).toFixed(2)} MB -> ${(outBytes.length / 1048576).toFixed(2)} MB (${Math.round(100 * (1 - outBytes.length / original.length))}% saved)`);
  fs.writeFileSync('compressed-out.pdf', outBytes);

  // validity check: reopen + render page 20 of the OUTPUT
  const t2 = pdfjs.getDocument({ data: new Uint8Array(outBytes) });
  const d2 = await t2.promise;
  console.log(`output opens: ${d2.numPages} pages`);
  const p20 = await d2.getPage(20);
  const vp = p20.getViewport({ scale: 900 / Math.max(p20.getViewport({ scale: 1 }).width, p20.getViewport({ scale: 1 }).height) });
  const c2 = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const cx2 = c2.getContext('2d');
  cx2.fillStyle = '#fff'; cx2.fillRect(0, 0, c2.width, c2.height);
  await p20.render({ canvas: c2, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
  fs.writeFileSync('compressed-p20-check.jpg', c2.toBuffer('image/jpeg', 85));
  await t2.destroy();
  console.log('wrote compressed-out.pdf + compressed-p20-check.jpg');
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
