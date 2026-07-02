// Full office-pipeline simulation on jobber.pdf (the file where Smallpdf basic
// beats our Strong: 349,044 B -> Smallpdf ~220,000 B vs our ~235,500 B).
// Mirrors compress-tool.tsx STRONG exactly (DPI-aware surgical pass + flate->JPEG
// + fontgut), then measures candidate levers:
//   A) re-encode stored-high-quality DCT JPEGs at the SAME dims when their
//      bytes-per-pixel says they're q85+ (the current fast-skip leaves these).
//   B) strip XMP metadata stream + Info dict entries (lossless).
//   C) garbage-collect unreachable objects (lossless).
// Usage: node jobber-sim.js [file] [A|AB|ABC|...] (default: run all variants)
const fs = require('fs');
const zlib = require('zlib');
const { createCanvas, ImageData } = require('@napi-rs/canvas');
const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDict, PDFRef } = require('pdf-lib');
const { subsetFonts } = require('./fontgut-lib.cjs');

const FILE = process.argv[2] || 'jobber.pdf';
const LEVEL = { dpi: 110, maxDim: 1200, quality: 60, flateQ: 80 }; // STRONG

// ---- content-stream CTM scan (copied from compress-sim.js / the app) ----
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
      else if (op === 'Do' && lastName) { const tag2 = nameToTag.get(lastName); if (tag2) { const sx = Math.hypot(ctm[0], ctm[1]), sy = Math.hypot(ctm[2], ctm[3]); const disp = Math.max(sx, sy); if (disp > (sizes.get(tag2) || 0)) sizes.set(tag2, disp); const area = sx * sy; if (area > maxArea) maxArea = area; } }
      else if (op === 'BI') { const ei = content.indexOf('EI', i); i = ei < 0 ? n : ei + 2; }
      ops = []; continue;
    }
    i++;
  }
  return maxArea;
}
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

async function runVariant(original, opts) {
  const doc = await PDFDocument.load(new Uint8Array(original), { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;

  // display sizes (DPI awareness) — mirrors the app
  const displaySizes = new Map();
  for (const page of doc.getPages()) {
    const res = page.node.Resources();
    const xobjs = res ? res.lookup(PDFName.of('XObject')) : undefined;
    if (!xobjs || typeof xobjs.keys !== 'function') continue;
    const nameToTag = new Map();
    for (const k of xobjs.keys()) { const r = xobjs.get(k); if (r && r.tag) nameToTag.set(String(k), r.tag); }
    if (nameToTag.size === 0) continue;
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => ctx.lookup(r)) : [contents];
    let text = '';
    for (const s of streams) {
      if (!(s instanceof PDFRawStream)) continue;
      const f = String(s.dict.get(PDFName.of('Filter')) || '');
      let b = s.contents;
      if (f === '/FlateDecode' && !s.dict.get(PDFName.of('DecodeParms'))) b = zlib.inflateSync(Buffer.from(b));
      else if (f) b = null;
      if (b) text += Buffer.from(b).toString('latin1');
    }
    if (text) scanContent(text, nameToTag, displaySizes);
  }

  const { dpi, maxDim, quality, flateQ } = LEVEL;
  let recompressed = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (String(d.get(PDFName.of('Subtype'))) !== '/Image') continue;
    if (d.get(PDFName.of('ImageMask'))) continue;
    const filter = String(d.get(PDFName.of('Filter')) || '');
    const w = Number(d.get(PDFName.of('Width'))), h = Number(d.get(PDFName.of('Height')));
    const raw = obj.contents;
    if (!w || !h || raw.length < 1024) continue;
    const dispPt = displaySizes.get(ref.tag);
    const longPx = Math.max(w, h);

    let imageData = null;
    let kind = null;
    if (filter === '/DCTDecode') {
      kind = 'jpeg';
      const target = dispPt ? (dispPt / 72) * dpi * 1.15 : maxDim;
      const bpp = raw.length / (w * h);
      const skip = longPx <= target;
      // current app behaviour: skip when at/below target. Lever A: also
      // re-encode SKIPPED ones whose bytes-per-pixel betrays a q85+ source.
      if (skip && !(opts.A && bpp > opts.bppThreshold)) continue;
      const { loadImage } = require('@napi-rs/canvas');
      const img = await loadImage(Buffer.from(raw));
      const targetLong = Math.min(longPx, dispPt ? Math.max(64, Math.ceil((dispPt / 72) * dpi)) : maxDim);
      const scale = Math.min(1, targetLong / longPx);
      const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
      const canvas = createCanvas(nw, nh);
      const cx2 = canvas.getContext('2d');
      cx2.fillStyle = '#fff'; cx2.fillRect(0, 0, nw, nh);
      cx2.drawImage(img, 0, 0, nw, nh);
      const jpg = canvas.toBuffer('image/jpeg', quality);
      if (jpg.length < raw.length) {
        const ns = PDFRawStream.of(d, new Uint8Array(jpg));
        ns.dict.set(PDFName.of('Width'), PDFNumber.of(nw));
        ns.dict.set(PDFName.of('Height'), PDFNumber.of(nh));
        ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        ns.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
        ns.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        ns.dict.delete(PDFName.of('DecodeParms'));
        ns.dict.delete(PDFName.of('Decode'));
        ctx.assign(ref, ns);
        recompressed++;
        if (opts.verbose) console.log(`  jpeg ${w}x${h} bpp ${bpp.toFixed(2)} -> ${nw}x${nh} q${quality}: ${(raw.length / 1024).toFixed(0)}->${(jpg.length / 1024).toFixed(0)}KB`);
      }
      continue;
    }
    if (filter !== '/FlateDecode') continue;
    if (d.get(PDFName.of('SMask')) || d.get(PDFName.of('Mask'))) continue;
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
    if (!channels) continue;
    let samples = zlib.inflateSync(Buffer.from(raw));
    const parms = ctx.lookup(d.get(PDFName.of('DecodeParms')));
    if (parms && parms.get) {
      const pred = Number(parms.get(PDFName.of('Predictor')) || 1);
      if (pred >= 10) samples = pngUnfilter(new Uint8Array(samples), Number(parms.get(PDFName.of('Columns')) || w), h, Number(parms.get(PDFName.of('Colors')) || channels));
      else if (pred !== 1) continue;
    }
    if (!samples || samples.length < w * h * channels) continue;
    imageData = new ImageData(w, h);
    for (let i = 0, sp = 0; i < w * h; i++) {
      if (channels === 3) { imageData.data[i * 4] = samples[sp++]; imageData.data[i * 4 + 1] = samples[sp++]; imageData.data[i * 4 + 2] = samples[sp++]; }
      else { const g = samples[sp++]; imageData.data[i * 4] = g; imageData.data[i * 4 + 1] = g; imageData.data[i * 4 + 2] = g; }
      imageData.data[i * 4 + 3] = 255;
    }
    // DPI-aware downscale for flate too (mirrors app targetLong)
    const targetLong = dispPt ? Math.max(64, Math.ceil((dispPt / 72) * dpi)) : maxDim;
    const scale = Math.min(1, targetLong / longPx);
    const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
    const canvas = createCanvas(nw, nh);
    const cx2 = canvas.getContext('2d');
    cx2.fillStyle = '#fff'; cx2.fillRect(0, 0, nw, nh);
    if (nw === w && nh === h) cx2.putImageData(imageData, 0, 0);
    else {
      const t = createCanvas(w, h);
      t.getContext('2d').putImageData(imageData, 0, 0);
      cx2.drawImage(t, 0, 0, nw, nh);
    }
    const jpg = canvas.toBuffer('image/jpeg', Math.max(quality, flateQ));
    if (jpg.length < raw.length) {
      const ns = PDFRawStream.of(d, new Uint8Array(jpg));
      ns.dict.set(PDFName.of('Width'), PDFNumber.of(nw));
      ns.dict.set(PDFName.of('Height'), PDFNumber.of(nh));
      ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      ns.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      ns.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      ns.dict.delete(PDFName.of('DecodeParms'));
      ns.dict.delete(PDFName.of('Decode'));
      ctx.assign(ref, ns);
      recompressed++;
      if (opts.verbose) console.log(`  flate ${w}x${h} -> ${nw}x${nh} q${Math.max(quality, flateQ)}: ${(raw.length / 1024).toFixed(0)}->${(jpg.length / 1024).toFixed(0)}KB`);
    }
  }

  // font pass (the real shipping lib)
  let fonts = 0;
  try { fonts = await subsetFonts(doc, new Uint8Array(original)); } catch (e) { console.log('  fontgut failed:', e.message); }

  // Lever B: strip XMP metadata + Info entries
  if (opts.B) {
    const catalog = ctx.lookup(ctx.trailerInfo.Root);
    if (catalog instanceof PDFDict && catalog.get(PDFName.of('Metadata'))) {
      const mref = catalog.get(PDFName.of('Metadata'));
      catalog.delete(PDFName.of('Metadata'));
      if (mref instanceof PDFRef) ctx.delete(mref);
    }
    const infoRef = ctx.trailerInfo.Info;
    if (infoRef) {
      const info = ctx.lookup(infoRef);
      if (info instanceof PDFDict) for (const [k] of info.entries()) info.delete(k);
    }
    // per-page /Thumb thumbnails + /PieceInfo (private app data)
    for (const page of doc.getPages()) {
      const t = page.node.get(PDFName.of('Thumb'));
      if (t) { page.node.delete(PDFName.of('Thumb')); if (t instanceof PDFRef) ctx.delete(t); }
      if (page.node.get(PDFName.of('PieceInfo'))) page.node.delete(PDFName.of('PieceInfo'));
    }
  }

  // Lever C: GC unreachable indirect objects
  let orphans = 0, orphanBytes = 0;
  if (opts.C) {
    const reachable = new Set();
    const walk = (o) => {
      if (o instanceof PDFRef) {
        if (reachable.has(o.tag)) return;
        reachable.add(o.tag);
        walk(ctx.lookup(o));
        return;
      }
      if (o instanceof PDFDict) { for (const [, v] of o.entries()) walk(v); if (o.dict) for (const [, v] of o.dict.entries?.() || []) walk(v); }
      else if (o instanceof PDFRawStream) { for (const [, v] of o.dict.entries()) walk(v); }
      else if (o instanceof PDFArray) for (const v of o.asArray()) walk(v);
      else if (o && o.dict instanceof PDFDict) for (const [, v] of o.dict.entries()) walk(v);
    };
    walk(ctx.trailerInfo.Root);
    walk(ctx.trailerInfo.Info);
    walk(ctx.trailerInfo.Encrypt);
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!reachable.has(ref.tag)) {
        orphans++;
        if (obj instanceof PDFRawStream) orphanBytes += obj.contents.length;
        ctx.delete(ref);
      }
    }
  }

  const out = await doc.save({ useObjectStreams: true });
  return { out, recompressed, fonts, orphans, orphanBytes };
}

(async () => {
  // getPdfjs() (inside the bundled fontgut lib) hard-sets workerSrc to the app
  // path '/pdf.worker.min.mjs', which explodes in Node. Pin it to the real
  // worker file and make the setter a no-op so the lib can't override it.
  {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const real = require('url').pathToFileURL(require('path').join(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
    Object.defineProperty(pdfjs.GlobalWorkerOptions, 'workerSrc', { get: () => real, set() { /* ignore */ } });
  }
  // The lib also fetches app-absolute assets (/pdfjs/standard_fonts/...) —
  // redirect those to the real files in node_modules so pdf.js can load fonts.
  {
    const path = require('path');
    const MAP = { '/pdfjs/standard_fonts/': 'standard_fonts/', '/pdfjs/wasm/': 'wasm/', '/pdfjs/iccs/': 'iccs/', '/pdfjs/cmaps/': 'cmaps/' };
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => {
      const u = String(url);
      for (const [prefix, dir] of Object.entries(MAP)) {
        if (u.startsWith(prefix)) {
          const p = path.join(__dirname, 'node_modules/pdfjs-dist', dir, u.slice(prefix.length));
          try { return Promise.resolve(new Response(fs.readFileSync(p))); }
          catch (e) { return Promise.reject(e); }
        }
      }
      return realFetch(url, init);
    };
  }
  const original = fs.readFileSync(FILE);
  console.log(`file: ${original.length} B  (Smallpdf basic on jobber: ~220,000 B)`);
  const variants = [
    ['baseline (current app @Strong)', { A: false, B: false, C: false }],
    ['A: re-encode high-bpp DCT (>0.10)', { A: true, bppThreshold: 0.10, B: false, C: false, verbose: true }],
    ['B: strip XMP/Info/Thumb', { A: false, B: true, C: false }],
    ['C: GC orphans', { A: false, B: false, C: true }],
    ['A+B+C', { A: true, bppThreshold: 0.10, B: true, C: true }],
  ];
  for (const [name, opts] of variants) {
    const t0 = Date.now();
    const r = await runVariant(original, opts);
    console.log(`${name}: ${r.out.length} B (${Math.round(100 * (1 - r.out.length / original.length))}% saved) — ${r.recompressed} imgs, ${r.fonts} fonts, orphans ${r.orphans}/${(r.orphanBytes / 1024).toFixed(0)}KB, ${Date.now() - t0}ms`);
    fs.writeFileSync(`jobber-out-${name.split(':')[0].replace(/[^A-Za-z+]/g, '')}.pdf`, r.out);
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
