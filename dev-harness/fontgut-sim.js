// FONT GUTTING harness — the safe form of font subsetting:
// keep every table/id/cmap byte-identical, only EMPTY the outlines of unused
// glyphs in glyf/loca. Handles (a) simple /TrueType + WinAnsi via cmap(3,1)
// format 4, (b) /Type0 CIDFontType2 Identity-H (+ CIDToGIDMap Identity) where
// 2-byte string codes ARE glyph ids. Composites kept recursively. Zero deps.
const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDict, PDFRef } = require('pdf-lib');

const FILE = process.argv[2] || 'C:/Users/Test/Downloads/FTP Access Dropship (2).pdf';

// ---- WinAnsi high-range map (0x80-0x9F specials; A0-FF = Latin-1) ----
const WIN_HI = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x2c6, 0x89: 0x2030, 0x8a: 0x160, 0x8b: 0x2039, 0x8c: 0x152, 0x8e: 0x17d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x2dc, 0x99: 0x2122, 0x9a: 0x161, 0x9b: 0x203a, 0x9c: 0x153, 0x9e: 0x17e, 0x9f: 0x178 };
const winAnsiToUnicode = (c) => (c < 0x80 ? c : WIN_HI[c] !== undefined ? WIN_HI[c] : c);

// ---- TrueType helpers ----
function parseTables(buf) {
  const num = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    tables[buf.toString('latin1', o, o + 4)] = { off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) };
  }
  return tables;
}
function cmap31(buf, tables) {
  const t = tables['cmap'];
  if (!t) return null;
  const base = t.off;
  const n = buf.readUInt16BE(base + 2);
  let sub = -1;
  for (let i = 0; i < n; i++) {
    const o = base + 4 + i * 8;
    const plat = buf.readUInt16BE(o), enc = buf.readUInt16BE(o + 2);
    if (plat === 3 && enc === 1) sub = base + buf.readUInt32BE(o + 4);
  }
  if (sub < 0) return null;
  if (buf.readUInt16BE(sub) !== 4) return null; // format 4 only
  const segX2 = buf.readUInt16BE(sub + 6);
  const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
  return (u) => {
    for (let s = 0; s < segX2; s += 2) {
      const end = buf.readUInt16BE(ends + s);
      if (u <= end) {
        const start = buf.readUInt16BE(starts + s);
        if (u < start) return 0;
        const delta = buf.readInt16BE(deltas + s);
        const ro = buf.readUInt16BE(ranges + s);
        if (ro === 0) return (u + delta) & 0xffff;
        const gi = buf.readUInt16BE(ranges + s + ro + (u - start) * 2);
        return gi === 0 ? 0 : (gi + delta) & 0xffff;
      }
    }
    return 0;
  };
}
function gutFont(fontBuf, keepGids) {
  const buf = Buffer.from(fontBuf);
  const tables = parseTables(buf);
  if (!tables['glyf'] || !tables['loca'] || !tables['head'] || !tables['maxp']) return null;
  const longLoca = buf.readInt16BE(tables['head'].off + 50) === 1;
  const numGlyphs = buf.readUInt16BE(tables['maxp'].off + 4);
  const locaOff = tables['loca'].off, glyfOff = tables['glyf'].off;
  const readLoca = (i) => (longLoca ? buf.readUInt32BE(locaOff + i * 4) : buf.readUInt16BE(locaOff + i * 2) * 2);

  // Expand keep set with composite components (recursive).
  const keep = new Set([0, ...keepGids].filter((g) => g < numGlyphs));
  const stack = [...keep];
  while (stack.length) {
    const g = stack.pop();
    const s = readLoca(g), e = readLoca(g + 1);
    if (e <= s) continue;
    const go = glyfOff + s;
    if (buf.readInt16BE(go) >= 0) continue; // simple glyph
    let p = go + 10;
    for (;;) {
      const flags = buf.readUInt16BE(p), comp = buf.readUInt16BE(p + 2);
      if (!keep.has(comp)) { keep.add(comp); stack.push(comp); }
      p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      if (!(flags & 0x20)) break;
    }
  }

  // Rebuild glyf keeping only kept outlines; others become zero-length.
  const parts = [];
  const newLoca = new Uint32Array(numGlyphs + 1);
  let pos = 0;
  for (let g = 0; g < numGlyphs; g++) {
    newLoca[g] = pos;
    if (keep.has(g)) {
      const s = readLoca(g), e = readLoca(g + 1);
      if (e > s) {
        let piece = buf.subarray(glyfOff + s, glyfOff + e);
        if (piece.length & 1) piece = Buffer.concat([piece, Buffer.alloc(1)]); // keep 2-byte align
        parts.push(piece);
        pos += piece.length;
      }
    }
  }
  newLoca[numGlyphs] = pos;
  const newGlyf = Buffer.concat(parts, pos);
  let newLocaBuf;
  const needLong = pos > 0x1fffe;
  if (needLong) {
    newLocaBuf = Buffer.alloc((numGlyphs + 1) * 4);
    newLoca.forEach((v, i) => newLocaBuf.writeUInt32BE(v, i * 4));
  } else {
    newLocaBuf = Buffer.alloc((numGlyphs + 1) * 2);
    newLoca.forEach((v, i) => newLocaBuf.writeUInt16BE(v >> 1, i * 2));
  }

  // Reassemble the sfnt: copy all tables, swapping glyf/loca; fix head flag.
  const names = Object.keys(tables);
  const out = [];
  const numT = names.length;
  const header = Buffer.from(buf.subarray(0, 12 + numT * 16));
  let off = header.length;
  const chunks = [];
  names.sort((a, b) => tables[a].off - tables[b].off);
  for (const name of names) {
    let data = name === 'glyf' ? newGlyf : name === 'loca' ? newLocaBuf : Buffer.from(buf.subarray(tables[name].off, tables[name].off + tables[name].len));
    if (name === 'head') { data = Buffer.from(data); data.writeInt16BE(needLong ? 1 : 0, 50); data.writeUInt32BE(0, 8); }
    // find dir entry for this tag and update
    for (let i = 0; i < numT; i++) {
      const o = 12 + i * 16;
      if (header.toString('latin1', o, o + 4) === name) {
        header.writeUInt32BE(off, o + 8);
        header.writeUInt32BE(data.length, o + 12);
        // checksum
        let sum = 0;
        for (let p = 0; p + 3 < data.length; p += 4) sum = (sum + data.readUInt32BE(p)) >>> 0;
        const rem = data.length & 3;
        if (rem) { const tail = Buffer.concat([data.subarray(data.length - rem), Buffer.alloc(4 - rem)]); sum = (sum + tail.readUInt32BE(0)) >>> 0; }
        header.writeUInt32BE(sum, o + 4);
      }
    }
    chunks.push(data);
    off += data.length;
    if (off & 3) { const pad = Buffer.alloc(4 - (off & 3)); chunks.push(pad); off += pad.length; }
  }
  let file = Buffer.concat([header, ...chunks]);
  // head.checkSumAdjustment
  let total = 0;
  for (let p = 0; p + 3 < file.length; p += 4) total = (total + file.readUInt32BE(p)) >>> 0;
  const headEntryOff = (() => { for (let i = 0; i < numT; i++) { const o = 12 + i * 16; if (header.toString('latin1', o, o + 4) === 'head') return file.readUInt32BE(o + 8); } return -1; })();
  if (headEntryOff >= 0) file.writeUInt32BE((0xb1b0afba - total) >>> 0, headEntryOff + 8);
  return { file, kept: keep.size, numGlyphs };
}

// ---- content-stream text collector: Tf tracking + Tj/TJ/'/" strings ----
function collectUsedCodes(text, fontMeta /* Map resName -> { codes:Set, cid:boolean } */) {
  let i = 0; const n = text.length; let curFont = null; let lastName = null; const strs = [];
  const flush = (s) => {
    if (!curFont || !fontMeta.has(curFont)) return;
    const m = fontMeta.get(curFont);
    if (m.cid) { for (let p = 0; p + 1 < s.length; p += 2) m.codes.add((s[p] << 8) | s[p + 1]); }
    else { for (const c of s) m.codes.add(c); }
  };
  while (i < n) {
    const ch = text[i];
    if (ch === '%') { while (i < n && text[i] !== '\n' && text[i] !== '\r') i++; continue; }
    if (ch === '(') {
      const bytes = [];
      i++;
      let depth = 1;
      while (i < n && depth > 0) {
        const c = text[i];
        if (c === '\\') {
          const nx = text[i + 1];
          if (nx >= '0' && nx <= '7') { let oct = ''; let j = i + 1; while (j < n && oct.length < 3 && text[j] >= '0' && text[j] <= '7') oct += text[j++]; bytes.push(parseInt(oct, 8)); i = j; continue; }
          const map = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
          if (map[nx] !== undefined) { bytes.push(map[nx]); i += 2; continue; }
          i += 2; continue;
        }
        if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) { i++; break; } }
        if (depth > 0) bytes.push(text.charCodeAt(i));
        i++;
      }
      strs.push(bytes);
      continue;
    }
    if (ch === '<' && text[i + 1] !== '<') {
      let hex = ''; i++;
      while (i < n && text[i] !== '>') { const c = text[i]; if (/[0-9a-fA-F]/.test(c)) hex += c; i++; }
      i++;
      if (hex.length & 1) hex += '0';
      const bytes = [];
      for (let p = 0; p < hex.length; p += 2) bytes.push(parseInt(hex.slice(p, p + 2), 16));
      strs.push(bytes);
      continue;
    }
    if (ch === '<' && text[i + 1] === '<') { i += 2; continue; }
    if (ch === '[') { i++; continue; }
    if (ch === ']') { i++; continue; }
    if (ch === '/') { let j = i + 1; while (j < n && !/[\s/<>[\]()%]/.test(text[j])) j++; lastName = text.slice(i + 1, j); i = j; continue; }
    if (/[A-Za-z'"]/.test(ch)) {
      let j = i; while (j < n && /[A-Za-z'"*01]/.test(text[j])) j++;
      const op = text.slice(i, j); i = j;
      if (op === 'Tf' && lastName) { curFont = lastName; strs.length = 0; continue; }
      if (op === 'Tj' || op === "'" || op === '"') { const s = strs.pop(); if (s) flush(s); strs.length = 0; continue; }
      if (op === 'TJ') { for (const s of strs) flush(s); strs.length = 0; continue; }
      strs.length = 0;
      continue;
    }
    i++;
  }
}

(async () => {
  const original = fs.readFileSync(FILE);
  const doc = await PDFDocument.load(new Uint8Array(original), { ignoreEncryption: true });
  const ctx = doc.context;

  // 1) Find guttable fonts: map font-dict ref -> descriptor/FontFile2 + type info.
  const targets = new Map(); // refTag -> { kind:'simple'|'cid', fontDict, ffRef, cmapFn?, codes:Set }
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    if (String(obj.get(PDFName.of('Type'))) !== '/Font') continue;
    const sub = String(obj.get(PDFName.of('Subtype')));
    if (sub === '/TrueType') {
      const enc = obj.get(PDFName.of('Encoding'));
      const encStr = enc ? String(enc) : '';
      if (enc && encStr !== '/WinAnsiEncoding') continue; // Differences etc. — skip (safety)
      const desc = ctx.lookup(obj.get(PDFName.of('FontDescriptor')));
      const ff = desc instanceof PDFDict ? desc.get(PDFName.of('FontFile2')) : null;
      if (!ff) continue;
      targets.set(String(ref), { kind: 'simple', dict: obj, ffRef: ff, codes: new Set(), name: String(obj.get(PDFName.of('BaseFont'))) });
    } else if (sub === '/Type0') {
      if (String(obj.get(PDFName.of('Encoding'))) !== '/Identity-H') continue;
      const descFonts = ctx.lookup(obj.get(PDFName.of('DescendantFonts')));
      const d0 = descFonts instanceof PDFArray ? ctx.lookup(descFonts.get(0)) : null;
      if (!(d0 instanceof PDFDict) || String(d0.get(PDFName.of('Subtype'))) !== '/CIDFontType2') continue;
      const c2g = d0.get(PDFName.of('CIDToGIDMap'));
      if (c2g && String(c2g) !== '/Identity') continue;
      const desc = ctx.lookup(d0.get(PDFName.of('FontDescriptor')));
      const ff = desc instanceof PDFDict ? desc.get(PDFName.of('FontFile2')) : null;
      if (!ff) continue;
      targets.set(String(ref), { kind: 'cid', dict: obj, ffRef: ff, codes: new Set(), name: String(obj.get(PDFName.of('BaseFont'))) });
    }
  }
  console.log('guttable fonts:', [...targets.values()].map((t) => `${t.name} (${t.kind})`).join(', ') || 'none');

  // 2) Collect used codes per page via resource-name -> font-ref mapping.
  const dec = new TextDecoder('latin1');
  for (const page of doc.getPages()) {
    const res = page.node.Resources();
    const fonts = res ? ctx.lookup(res.get(PDFName.of('Font'))) : null;
    if (!(fonts instanceof PDFDict)) continue;
    const nameToSet = new Map();
    for (const [key, val] of fonts.entries()) {
      const tag = String(val instanceof PDFRef ? val : val);
      const t = targets.get(tag);
      if (t) nameToSet.set(String(key).slice(1), { codes: t.codes, cid: t.kind === 'cid' });
    }
    if (nameToSet.size === 0) continue;
    const contents = page.node.Contents();
    const streams = [];
    if (contents instanceof PDFArray) for (const r of contents.asArray()) streams.push(ctx.lookup(r));
    else if (contents) streams.push(ctx.lookup(contents) ?? contents);
    let text = '';
    for (const s of streams) {
      if (!(s instanceof PDFRawStream)) continue;
      const f = s.dict.get(PDFName.of('Filter'));
      let b = s.contents;
      if (f && String(f) === '/FlateDecode') { try { b = zlib.inflateSync(Buffer.from(b)); } catch { b = null; } }
      else if (f) b = null;
      if (b) text += dec.decode(b);
    }
    if (text) collectUsedCodes(text, nameToSet);
  }

  // 3) Gut each font.
  let savedTotal = 0;
  for (const t of targets.values()) {
    const ffStream = ctx.lookup(t.ffRef);
    if (!(ffStream instanceof PDFRawStream)) continue;
    let raw = ffStream.contents;
    const filt = ffStream.dict.get(PDFName.of('Filter'));
    let fontBuf = filt && String(filt) === '/FlateDecode' ? zlib.inflateSync(Buffer.from(raw)) : Buffer.from(raw);

    let gids = new Set();
    if (t.kind === 'cid') {
      // Identity-H + Identity CIDToGIDMap: the collected 2-byte codes ARE glyph ids.
      gids = new Set(t.codes);
      gids.delete(0);
    } else {
      const tables = parseTables(fontBuf);
      const lookup = cmap31(fontBuf, tables);
      if (!lookup) { console.log(`  ${t.name}: no cmap(3,1) fmt4 — skipped`); continue; }
      for (const c of t.codes) gids.add(lookup(winAnsiToUnicode(c)));
      gids.delete(0);
    }
    if (!gids || gids.size === 0) { console.log(`  ${t.name}: no usable code set — skipped`); continue; }

    const gutted = gutFont(fontBuf, gids);
    if (!gutted) { console.log(`  ${t.name}: not guttable (CFF or missing tables)`); continue; }
    const deflated = zlib.deflateSync(gutted.file, { level: 9 });
    if (deflated.length >= raw.length) { console.log(`  ${t.name}: no win (${raw.length} -> ${deflated.length})`); continue; }
    const ns = PDFRawStream.of(ffStream.dict, new Uint8Array(deflated));
    ns.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    ns.dict.set(PDFName.of('Length1'), PDFNumber.of(gutted.file.length));
    ctx.assign(t.ffRef instanceof PDFRef ? t.ffRef : t.ffRef, ns);
    savedTotal += raw.length - deflated.length;
    console.log(`  ${t.name} [${t.kind}]: glyphs kept ${gutted.kept}/${gutted.numGlyphs}; stream ${(raw.length / 1024).toFixed(0)}KB -> ${(deflated.length / 1024).toFixed(0)}KB`);
  }

  const out = await doc.save({ useObjectStreams: true });
  fs.writeFileSync('fontgut-out.pdf', out);
  console.log(`\nfont savings: ${(savedTotal / 1024).toFixed(0)}KB`);
  console.log(`RESULT: ${(original.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB (${Math.round(100 * (1 - out.length / original.length))}% saved) [fonts only, no image pass]`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
