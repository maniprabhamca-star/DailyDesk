// FONT GUTTING v2 — same safe gutting core as v1, but the used-character
// collection now comes from pdf.js getOperatorList (authoritative: handles all
// escapes, TJ forms, Form XObjects, etc.) instead of a hand-rolled parser.
// Usage: node fontgut2.js [input.pdf] [output.pdf]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDict, PDFRef } = require('pdf-lib');

const FILE = process.argv[2] || 'C:/Users/Test/Downloads/FTP Access Dropship (2).pdf';
const OUT = process.argv[3] || 'fontgut2-out.pdf';

// ---- TrueType glyph gutting core (identical to v1) ----
function parseTables(buf) {
  const num = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    tables[buf.toString('latin1', o, o + 4)] = { off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) };
  }
  return tables;
}
// Parse ONE cmap subtable at `sub` (formats 4, 6, 0) into a lookup(u)->gid fn.
function cmapSub(buf, sub) {
  const fmt = buf.readUInt16BE(sub);
  if (fmt === 4) {
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
  if (fmt === 6) {
    const first = buf.readUInt16BE(sub + 6), count = buf.readUInt16BE(sub + 8);
    return (u) => (u >= first && u < first + count ? buf.readUInt16BE(sub + 10 + (u - first) * 2) : 0);
  }
  if (fmt === 0) {
    return (u) => (u < 256 ? buf[sub + 6 + u] : 0);
  }
  return null;
}

// ALL cmap lookups (any platform) — used to union every plausible code->gid
// mapping, since subset fonts vary in which table the viewer actually reads.
function allCmaps(buf, tables) {
  const t = tables['cmap'];
  if (!t) return [];
  const base = t.off;
  const n = buf.readUInt16BE(base + 2);
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = base + 4 + i * 8;
    const plat = buf.readUInt16BE(o), enc = buf.readUInt16BE(o + 2);
    const fn = cmapSub(buf, base + buf.readUInt32BE(o + 4));
    if (fn) out.push({ plat, enc, fn });
  }
  return out;
}
function gutFont(fontBuf, keepGids) {
  const buf = Buffer.from(fontBuf);
  const tables = parseTables(buf);
  if (!tables['glyf'] || !tables['loca'] || !tables['head'] || !tables['maxp']) return null;
  const longLoca = buf.readInt16BE(tables['head'].off + 50) === 1;
  const numGlyphs = buf.readUInt16BE(tables['maxp'].off + 4);
  const locaOff = tables['loca'].off, glyfOff = tables['glyf'].off;
  const readLoca = (i) => (longLoca ? buf.readUInt32BE(locaOff + i * 4) : buf.readUInt16BE(locaOff + i * 2) * 2);

  const keep = new Set([0, ...keepGids].filter((g) => Number.isInteger(g) && g >= 0 && g < numGlyphs));
  const stack = [...keep];
  while (stack.length) {
    const g = stack.pop();
    const s = readLoca(g), e = readLoca(g + 1);
    if (e <= s) continue;
    const go = glyfOff + s;
    if (buf.readInt16BE(go) >= 0) continue;
    let p = go + 10;
    for (;;) {
      const flags = buf.readUInt16BE(p), comp = buf.readUInt16BE(p + 2);
      if (!keep.has(comp)) { keep.add(comp); stack.push(comp); }
      p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      if (!(flags & 0x20)) break;
    }
  }

  const parts = [];
  const newLoca = new Uint32Array(numGlyphs + 1);
  let pos = 0;
  for (let g = 0; g < numGlyphs; g++) {
    newLoca[g] = pos;
    if (keep.has(g)) {
      const s = readLoca(g), e = readLoca(g + 1);
      if (e > s) {
        let piece = buf.subarray(glyfOff + s, glyfOff + e);
        if (piece.length & 1) piece = Buffer.concat([piece, Buffer.alloc(1)]);
        parts.push(piece);
        pos += piece.length;
      }
    }
  }
  newLoca[numGlyphs] = pos;
  const newGlyf = Buffer.concat(parts, pos);
  const needLong = pos > 0x1fffe;
  let newLocaBuf;
  if (needLong) {
    newLocaBuf = Buffer.alloc((numGlyphs + 1) * 4);
    newLoca.forEach((v, i) => newLocaBuf.writeUInt32BE(v, i * 4));
  } else {
    newLocaBuf = Buffer.alloc((numGlyphs + 1) * 2);
    newLoca.forEach((v, i) => newLocaBuf.writeUInt16BE(v >> 1, i * 2));
  }

  const names = Object.keys(tables).sort((a, b) => tables[a].off - tables[b].off);
  const numT = names.length;
  const header = Buffer.from(buf.subarray(0, 12 + numT * 16));
  let off = header.length;
  const chunks = [];
  for (const name of names) {
    let data = name === 'glyf' ? newGlyf : name === 'loca' ? newLocaBuf : Buffer.from(buf.subarray(tables[name].off, tables[name].off + tables[name].len));
    if (name === 'head') { data = Buffer.from(data); data.writeInt16BE(needLong ? 1 : 0, 50); data.writeUInt32BE(0, 8); }
    for (let i = 0; i < numT; i++) {
      const o = 12 + i * 16;
      if (header.toString('latin1', o, o + 4) === name) {
        header.writeUInt32BE(off, o + 8);
        header.writeUInt32BE(data.length, o + 12);
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
  const file = Buffer.concat([header, ...chunks]);
  let total = 0;
  for (let p = 0; p + 3 < file.length; p += 4) total = (total + file.readUInt32BE(p)) >>> 0;
  for (let i = 0; i < numT; i++) {
    const o = 12 + i * 16;
    if (file.toString('latin1', o, o + 4) === 'head') {
      file.writeUInt32BE((0xb1b0afba - total) >>> 0, file.readUInt32BE(o + 8) + 8);
    }
  }
  return { file, kept: keep.size, numGlyphs };
}

(async () => {
  const original = fs.readFileSync(FILE);

  // ---- 1) AUTHORITATIVE used-code collection via pdf.js operator lists ----
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(original),
    wasmUrl: path.join(__dirname, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/',
    standardFontDataUrl: path.join(__dirname, 'node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/',
  });
  const jsDoc = await task.promise;
  const usedByBaseFont = new Map(); // 'BCDEEE+Calibri-Bold' -> Set<originalCharCode>
  for (let n = 1; n <= jsDoc.numPages; n++) {
    const page = await jsDoc.getPage(n);
    const opList = await page.getOperatorList();
    // The font is part of the graphics state: q/Q (save/restore) must push/pop
    // it, or glyphs after a Q get attributed to the wrong font (that mis-
    // attribution was the v2 corruption bug).
    let curName = null;
    const gsStack = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      if (fn === pdfjs.OPS.save) { gsStack.push(curName); }
      else if (fn === pdfjs.OPS.restore) { curName = gsStack.length ? gsStack.pop() : curName; }
      else if (fn === pdfjs.OPS.setFont) {
        const id = opList.argsArray[i][0];
        try {
          const font = page.commonObjs.get(id);
          curName = font && font.name ? String(font.name) : null;
        } catch { curName = null; }
      } else if (fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText) {
        if (!curName) continue;
        let set = usedByBaseFont.get(curName);
        if (!set) { set = new Set(); usedByBaseFont.set(curName, set); }
        const glyphs = opList.argsArray[i][0];
        if (!Array.isArray(glyphs)) continue;
        for (const g of glyphs) {
          if (g && typeof g === 'object' && Number.isInteger(g.originalCharCode)) set.add(g.originalCharCode);
        }
      }
    }
    page.cleanup();
  }
  await task.destroy();
  console.log('collected fonts:', [...usedByBaseFont.entries()].map(([k, v]) => `${k}(${v.size})`).join(', '));

  // ---- 2) pdf-lib side: find guttable fonts, match by BaseFont ----
  const doc = await PDFDocument.load(new Uint8Array(original), { ignoreEncryption: true });
  const ctx = doc.context;
  let savedTotal = 0;
  // PHASE A: collect keep-gids per font dict, GROUPED BY FontFile2 stream —
  // multiple font dicts (e.g., Word's simple + CID variants of one face) often
  // SHARE one font file; gutting per-dict would strip each other's glyphs.
  const byStream = new Map(); // ffRefTag -> { ffRef, gids:Set, names:[] }
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    if (String(obj.get(PDFName.of('Type'))) !== '/Font') continue;
    const sub = String(obj.get(PDFName.of('Subtype')));
    let kind = null, descDict = null;
    if (sub === '/TrueType') {
      kind = 'simple';
      descDict = ctx.lookup(obj.get(PDFName.of('FontDescriptor')));
    } else if (sub === '/Type0') {
      if (String(obj.get(PDFName.of('Encoding'))) !== '/Identity-H') continue;
      const df = ctx.lookup(obj.get(PDFName.of('DescendantFonts')));
      const d0 = df instanceof PDFArray ? ctx.lookup(df.get(0)) : null;
      if (!(d0 instanceof PDFDict) || String(d0.get(PDFName.of('Subtype'))) !== '/CIDFontType2') continue;
      const c2g = d0.get(PDFName.of('CIDToGIDMap'));
      if (c2g && String(c2g) !== '/Identity') continue;
      kind = 'cid';
      descDict = ctx.lookup(d0.get(PDFName.of('FontDescriptor')));
    } else continue;
    if (!(descDict instanceof PDFDict)) continue;
    const ffRef = descDict.get(PDFName.of('FontFile2'));
    if (!ffRef) continue;
    const base = String(obj.get(PDFName.of('BaseFont'))).replace(/^\//, '');
    const used = usedByBaseFont.get(base);
    if (!used || used.size === 0) { console.log(`  ${base}: no collected usage — SKIPPED (safe)`); continue; }

    const ffStream = ctx.lookup(ffRef);
    if (!(ffStream instanceof PDFRawStream)) continue;
    const raw = ffStream.contents;
    const filt = ffStream.dict.get(PDFName.of('Filter'));
    let fontBuf;
    try { fontBuf = filt && String(filt) === '/FlateDecode' ? zlib.inflateSync(Buffer.from(raw)) : Buffer.from(raw); } catch { continue; }

    let gids;
    if (kind === 'cid') {
      gids = new Set(used); // Identity-H + Identity CIDToGIDMap: codes ARE gids
    } else {
      // Simple TrueType: subset fonts disagree about which cmap the viewer will
      // read — so UNION every plausible mapping per code: unicode via (3,1),
      // symbol (3,0) at 0xF000+code and raw code, Mac (1,0) by code, plus the
      // code-as-gid convention some subsetters use. Keep-set grows a little;
      // correctness is what matters (the render QA is the final gate).
      const tables = parseTables(fontBuf);
      const maps = allCmaps(fontBuf, tables);
      if ([...used].some((c) => c >= 0x80)) { console.log(`  ${base}: non-ASCII codes present — SKIPPED (v2 safety)`); continue; }
      gids = new Set();
      for (const c of used) {
        gids.add(c); // code-as-gid convention
        for (const m of maps) {
          gids.add(m.fn(c)); // raw code in any table
          gids.add(m.fn(0xf000 + c)); // symbol range
        }
      }
      gids.delete(0);
    }
    // Group by the UNDERLYING stream — union keep-sets of every font dict that
    // shares this font file, then gut once (phase B).
    const tag = String(ffRef);
    let entry = byStream.get(tag);
    if (!entry) { entry = { ffRef, ffStream, raw, fontBuf, gids: new Set(), names: [] }; byStream.set(tag, entry); }
    for (const g of gids) entry.gids.add(g);
    entry.names.push(`${base}[${kind}]`);
  }

  // PHASE B: gut each unique font stream ONCE with the unioned keep-set.
  for (const entry of byStream.values()) {
    const gutted = gutFont(entry.fontBuf, entry.gids);
    if (!gutted) { console.log(`  ${entry.names.join('+')}: not guttable — skipped`); continue; }
    const deflated = zlib.deflateSync(gutted.file, { level: 9 });
    if (deflated.length >= entry.raw.length) { console.log(`  ${entry.names.join('+')}: no win`); continue; }
    const ns = PDFRawStream.of(entry.ffStream.dict, new Uint8Array(deflated));
    ns.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    ns.dict.set(PDFName.of('Length1'), PDFNumber.of(gutted.file.length));
    ctx.assign(entry.ffRef, ns);
    savedTotal += entry.raw.length - deflated.length;
    console.log(`  ${entry.names.join(' + ')}: kept ${gutted.kept}/${gutted.numGlyphs} glyphs; ${(entry.raw.length / 1024).toFixed(0)}KB -> ${(deflated.length / 1024).toFixed(0)}KB`);
  }

  const out = await doc.save({ useObjectStreams: true });
  fs.writeFileSync(OUT, out);
  console.log(`\nfont savings ${(savedTotal / 1024).toFixed(0)}KB · RESULT ${(original.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB (${Math.round(100 * (1 - out.length / original.length))}%)`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
