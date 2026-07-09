// Lossless font "subsetting" via glyph gutting — the compression pass that wins
// on everyday office PDFs (embedded fonts are often >50% of the file).
//
// HOW IT'S SAFE (harness-proven pixel-identical, dev-harness/fontgut2.js):
// nothing that maps text to glyphs changes — every table, glyph id, cmap and
// metric stays byte-identical; only the OUTLINES of unused glyphs are emptied
// from glyf/loca. Guards: only TrueType (FontFile2); simple fonts must be
// ASCII-coded; Type0 must be Identity-H with Identity CIDToGIDMap (codes = glyph
// ids); usage collected from pdf.js operator lists (fonts tracked through q/Q
// save/restore — mis-attribution was a real bug); font dicts SHARING one font
// file are grouped and gutted once with the union of their glyphs (Word emits
// simple+CID variants over one file — gutting per-dict corrupted the other);
// AcroForm documents are skipped entirely (form re-fill needs full fonts);
// each font is replaced only if genuinely smaller; any error skips that font.

import type { PDFDocument, PDFRawStream as PDFRawStreamType } from 'pdf-lib';
import { getPdfjs, pdfDocOptions } from '@/lib/pdf-render';

const MAX_PAGES = 300; // operator-list collection cost gate (office docs are small)

// ---------- byte helpers (browser: no Buffer) ----------
const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const i16 = (b: Uint8Array, o: number) => { const v = u16(b, o); return v & 0x8000 ? v - 0x10000 : v; };
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const w16 = (b: Uint8Array, o: number, v: number) => { b[o] = (v >> 8) & 255; b[o + 1] = v & 255; };
const w32 = (b: Uint8Array, o: number, v: number) => { b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; };
const tag = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null;
    const s = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  } catch { return null; }
}
async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const s = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  } catch { return null; }
}

// ---------- TrueType parsing ----------
type Tables = Record<string, { off: number; len: number }>;
function parseTables(b: Uint8Array): Tables | null {
  if (b.length < 12) return null;
  const num = u16(b, 4);
  if (b.length < 12 + num * 16) return null;
  const t: Tables = {};
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    t[tag(b, o)] = { off: u32(b, o + 8), len: u32(b, o + 12) };
  }
  return t;
}

function cmapSub(b: Uint8Array, sub: number): ((u: number) => number) | null {
  const fmt = u16(b, sub);
  if (fmt === 4) {
    const segX2 = u16(b, sub + 6);
    const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    return (u) => {
      for (let s = 0; s < segX2; s += 2) {
        const end = u16(b, ends + s);
        if (u <= end) {
          const start = u16(b, starts + s);
          if (u < start) return 0;
          const delta = i16(b, deltas + s);
          const ro = u16(b, ranges + s);
          if (ro === 0) return (u + delta) & 0xffff;
          const gi = u16(b, ranges + s + ro + (u - start) * 2);
          return gi === 0 ? 0 : (gi + delta) & 0xffff;
        }
      }
      return 0;
    };
  }
  if (fmt === 6) {
    const first = u16(b, sub + 6), count = u16(b, sub + 8);
    return (u) => (u >= first && u < first + count ? u16(b, sub + 10 + (u - first) * 2) : 0);
  }
  if (fmt === 0) return (u) => (u < 256 ? b[sub + 6 + u] : 0);
  return null;
}
function allCmaps(b: Uint8Array, tables: Tables): Array<(u: number) => number> {
  const t = tables['cmap'];
  if (!t) return [];
  const out: Array<(u: number) => number> = [];
  const n = u16(b, t.off + 2);
  for (let i = 0; i < n; i++) {
    const o = t.off + 4 + i * 8;
    const fn = cmapSub(b, t.off + u32(b, o + 4));
    if (fn) out.push(fn);
  }
  return out;
}

// Tables that don't affect OUTLINE rendering, so dropping them keeps the page
// pixel-identical while shrinking the font: embedded bitmap strikes (only used at
// tiny sizes, and PDF viewers render from outlines), the digital signature, and
// device-metric hints. `post` is compacted to format 3 (drops the glyph-NAME
// list, which rendering never needs). All verified pixel-identical by the harness.
const DROP_TABLES = new Set(['EBDT', 'EBLC', 'EBSC', 'bdat', 'bloc', 'DSIG']);

// Empty the outlines of every glyph NOT in keepGids (composites expanded).
export function gutFont(src: Uint8Array, keepGids: Set<number>): { file: Uint8Array; kept: number } | null {
  const tables = parseTables(src);
  if (!tables || !tables['glyf'] || !tables['loca'] || !tables['head'] || !tables['maxp']) return null;
  const longLoca = i16(src, tables['head'].off + 50) === 1;
  const numGlyphs = u16(src, tables['maxp'].off + 4);
  const locaOff = tables['loca'].off, glyfOff = tables['glyf'].off;
  const readLoca = (i: number) => (longLoca ? u32(src, locaOff + i * 4) : u16(src, locaOff + i * 2) * 2);

  const keep = new Set<number>([0]);
  keepGids.forEach((g) => { if (Number.isInteger(g) && g > 0 && g < numGlyphs) keep.add(g); });
  const stack = Array.from(keep);
  while (stack.length) {
    const g = stack.pop()!;
    const s = readLoca(g), e = readLoca(g + 1);
    if (e <= s) continue;
    const go = glyfOff + s;
    if (i16(src, go) >= 0) continue; // simple glyph
    let p = go + 10;
    for (;;) {
      const flags = u16(src, p), comp = u16(src, p + 2);
      if (!keep.has(comp)) { keep.add(comp); stack.push(comp); }
      p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      if (!(flags & 0x20)) break;
    }
  }

  // Rebuild glyf/loca.
  const pieces: Uint8Array[] = [];
  const newLoca = new Uint32Array(numGlyphs + 1);
  let pos = 0;
  for (let g = 0; g < numGlyphs; g++) {
    newLoca[g] = pos;
    if (keep.has(g)) {
      const s = readLoca(g), e = readLoca(g + 1);
      if (e > s) {
        const len = e - s;
        const padded = len & 1 ? len + 1 : len;
        const piece = new Uint8Array(padded);
        piece.set(src.subarray(glyfOff + s, glyfOff + e));
        pieces.push(piece);
        pos += padded;
      }
    }
  }
  newLoca[numGlyphs] = pos;
  const newGlyf = new Uint8Array(pos);
  { let p = 0; for (const piece of pieces) { newGlyf.set(piece, p); p += piece.length; } }
  const needLong = pos > 0x1fffe;
  const newLocaBuf = new Uint8Array((numGlyphs + 1) * (needLong ? 4 : 2));
  for (let i = 0; i <= numGlyphs; i++) {
    if (needLong) w32(newLocaBuf, i * 4, newLoca[i]);
    else w16(newLocaBuf, i * 2, newLoca[i] >> 1);
  }

  // Reassemble the sfnt: drop DROP_TABLES, compact `post` to format 3, and
  // rebuild the table directory (fewer tables) with fresh offsets + checksums.
  const checksum = (b: Uint8Array, o: number, len: number): number => {
    let s = 0;
    const full = len & ~3;
    for (let p = 0; p < full; p += 4) s = (s + u32(b, o + p)) >>> 0;
    if (len & 3) { const t4 = new Uint8Array(4); t4.set(b.subarray(o + full, o + len)); s = (s + u32(t4, 0)) >>> 0; }
    return s >>> 0;
  };
  const dataOf = (name: string): Uint8Array => {
    if (name === 'glyf') return newGlyf;
    if (name === 'loca') return newLocaBuf;
    const d = new Uint8Array(src.subarray(tables[name].off, tables[name].off + tables[name].len));
    if (name === 'head') { w16(d, 50, needLong ? 1 : 0); w32(d, 8, 0); return d; }
    if (name === 'post' && d.length > 32) { const h = d.slice(0, 32); w32(h, 0, 0x00030000); return h; } // fmt 3: no glyph names
    return d;
  };

  const keepTables = Object.keys(tables).filter((n) => !DROP_TABLES.has(n)).sort();
  const numT = keepTables.length;
  let pow = 1, es = 0;
  while (pow * 2 <= numT) { pow *= 2; es++; }
  const laid = keepTables.map((name) => ({ name, data: dataOf(name), off: 0 }));
  let off = 12 + numT * 16;
  for (const e of laid) { e.off = off; off += (e.data.length + 3) & ~3; } // 4-byte aligned

  const file = new Uint8Array(off);
  w32(file, 0, u32(src, 0));               // scaler type
  w16(file, 4, numT);
  w16(file, 6, pow * 16);                  // searchRange
  w16(file, 8, es);                        // entrySelector
  w16(file, 10, numT * 16 - pow * 16);     // rangeShift
  let dir = 12;
  for (const e of laid) {
    file.set(e.data, e.off);
    for (let k = 0; k < 4; k++) file[dir + k] = e.name.charCodeAt(k) || 0x20;
    w32(file, dir + 4, checksum(e.data, 0, e.data.length));
    w32(file, dir + 8, e.off);
    w32(file, dir + 12, e.data.length);
    dir += 16;
  }
  const head = laid.find((e) => e.name === 'head');
  if (head) w32(file, head.off + 8, (0xb1b0afba - checksum(file, 0, file.length)) >>> 0);
  return { file, kept: keep.size };
}

// ---------- main entry ----------
/** Losslessly slim the embedded fonts of `doc` (mutates its streams in place).
 * `original` = the untouched source bytes (used to collect glyph usage with
 * pdf.js). Returns the number of font files slimmed. Best-effort: any doubt or
 * error skips that font; unsupported environments return 0 silently. */
export async function subsetFonts(doc: PDFDocument, original: Uint8Array): Promise<number> {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') return 0;
  const { PDFName, PDFNumber, PDFRawStream, PDFArray, PDFDict } = await import('pdf-lib');
  const ctx = doc.context;

  // Guard: form documents need complete fonts for later refills.
  try {
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'));
    if (acro instanceof PDFDict) {
      const fields = acro.lookup(PDFName.of('Fields'));
      if (fields instanceof PDFArray && fields.size() > 0) return 0;
    }
  } catch { /* no form */ }
  if (doc.getPageCount() > MAX_PAGES) return 0;

  // 1) Collect used char codes per BaseFont from pdf.js operator lists.
  const usedByBaseFont = new Map<string, Set<number>>();
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument(pdfDocOptions(new Uint8Array(original)));
  try {
    const jsDoc = await task.promise;
    for (let n = 1; n <= jsDoc.numPages; n++) {
      const page = await jsDoc.getPage(n);
      const opList = await page.getOperatorList();
      let curName: string | null = null;
      const gsStack: Array<string | null> = [];
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        if (fn === pdfjs.OPS.save) gsStack.push(curName);
        else if (fn === pdfjs.OPS.restore) curName = gsStack.length ? (gsStack.pop() as string | null) : curName;
        else if (fn === pdfjs.OPS.setFont) {
          try {
            const font = page.commonObjs.get(opList.argsArray[i][0]) as { name?: string } | null;
            curName = font && font.name ? String(font.name) : null;
          } catch { curName = null; }
        } else if (fn === pdfjs.OPS.showText) {
          if (!curName) continue;
          let set = usedByBaseFont.get(curName);
          if (!set) { set = new Set(); usedByBaseFont.set(curName, set); }
          const glyphs = opList.argsArray[i][0];
          if (!Array.isArray(glyphs)) continue;
          for (const g of glyphs) {
            if (g && typeof g === 'object' && Number.isInteger((g as { originalCharCode?: number }).originalCharCode)) {
              set.add((g as { originalCharCode: number }).originalCharCode);
            }
          }
        }
      }
      page.cleanup();
    }
  } finally {
    try { void task.destroy(); } catch { /* ignore */ }
  }
  if (usedByBaseFont.size === 0) return 0;

  // 2) Find guttable fonts; group keep-sets by the UNDERLYING font stream.
  type Entry = { ffRef: unknown; stream: PDFRawStreamType; raw: Uint8Array; font: Uint8Array; gids: Set<number> };
  const byStream = new Map<string, Entry>();
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    try {
      if (!(obj instanceof PDFDict)) continue;
      if (String(obj.get(PDFName.of('Type'))) !== '/Font') continue;
      const sub = String(obj.get(PDFName.of('Subtype')));
      let kind: 'simple' | 'cid' | null = null;
      let descDict: unknown = null;
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
      if (!used || used.size === 0) continue; // no observed usage → leave intact

      const stream = ctx.lookup(ffRef);
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = stream.contents as Uint8Array;
      const filt = stream.dict.get(PDFName.of('Filter'));
      let font: Uint8Array | null;
      if (filt && String(filt) === '/FlateDecode') font = await inflate(raw);
      else if (filt) continue;
      else font = raw;
      if (!font) continue;

      let gids: Set<number>;
      if (kind === 'cid') {
        gids = new Set(used); // Identity-H + Identity CIDToGIDMap: codes ARE gids
      } else {
        if (Array.from(used).some((c) => c >= 0x80)) continue; // non-ASCII simple font → skip (safety)
        const tables = parseTables(font);
        if (!tables) continue;
        const maps = allCmaps(font, tables);
        const g2 = new Set<number>();
        used.forEach((c) => {
          g2.add(c); // code-as-gid convention
          maps.forEach((m) => { g2.add(m(c)); g2.add(m(0xf000 + c)); });
        });
        gids = g2;
        gids.delete(0);
      }
      const key = String(ffRef);
      let entry = byStream.get(key);
      if (!entry) { entry = { ffRef, stream, raw, font, gids: new Set() }; byStream.set(key, entry); }
      gids.forEach((g) => entry.gids.add(g));
    } catch { /* skip this font */ }
  }

  // 3) Gut each unique stream once with the unioned keep-set; only-if-smaller.
  let slimmed = 0;
  const entries: Entry[] = [];
  byStream.forEach((e) => entries.push(e));
  for (const entry of entries) {
    try {
      if (entry.gids.size === 0) continue;
      const gutted = gutFont(entry.font, entry.gids);
      if (!gutted) continue;
      const deflated = await deflate(gutted.file);
      if (!deflated || deflated.length >= entry.raw.length) continue;
      const ns = PDFRawStream.of(entry.stream.dict, deflated);
      ns.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      ns.dict.set(PDFName.of('Length1'), PDFNumber.of(gutted.file.length));
      ctx.assign(entry.ffRef as Parameters<typeof ctx.assign>[0], ns);
      slimmed++;
    } catch { /* skip this font */ }
  }
  return slimmed;
}
