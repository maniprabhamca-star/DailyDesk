// Path-A QA: prove the new table-stripping in gutFont() is pixel-identical.
// Extract a real font, run gutFont keeping ALL glyphs (so ONLY the stripping
// differs from the original), render the same text with both via Skia, pixel-diff.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const FE = 'C:/Mani Documents/MyBiz/DailyDesk/frontend';

// Stub the '@/lib/pdf-render' import (gutFont doesn't use it, but the module loads it).
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) {
  if (req === '@/lib/pdf-render') return path.join(__dirname, 'pdfrender-stub.cjs');
  return orig.call(this, req, ...a);
};
fs.writeFileSync(path.join(__dirname, 'pdfrender-stub.cjs'), 'module.exports={getPdfjs:async()=>({}),pdfDocOptions:()=>({})};');
require(path.join(FE, 'node_modules/sucrase/register'));
const { gutFont } = require(path.join(FE, 'lib/pdf-fontgut.ts'));

const { PDFDocument, PDFName, PDFRawStream, PDFDict } = require(path.join(FE, 'node_modules/pdf-lib'));
const { createCanvas, GlobalFonts } = require(path.join(FE, 'node_modules/@napi-rs/canvas'));
const u16 = (b, o) => (b[o] << 8) | b[o + 1], u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const tagAt = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

function render(fontBuf, alias) {
  GlobalFonts.register(Buffer.from(fontBuf), alias);
  const c = createCanvas(1000, 120);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 120);
  ctx.fillStyle = '#000'; ctx.font = `48px ${alias}`;
  ctx.fillText('The quick brown fox — FTP 0123456789 aBcDeFgH.', 12, 70);
  return c.getContext('2d').getImageData(0, 0, 1000, 120).data;
}
function diffCount(a, b) { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i]) n++; return n; }

(async () => {
  const d = await PDFDocument.load(fs.readFileSync(path.join(__dirname, 'ftp.pdf')), { updateMetadata: false });
  const ctx = d.context;
  let tested = 0;
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const ff = obj.get(PDFName.of('FontFile2')); if (!ff) continue;
    const st = ctx.lookup(ff); if (!(st instanceof PDFRawStream)) continue;
    const filt = st.dict.get(PDFName.of('Filter'));
    let font = filt && String(filt) === '/FlateDecode' ? new Uint8Array(zlib.inflateSync(Buffer.from(st.contents))) : new Uint8Array(st.contents);
    // need a cmap so Skia can map text→glyphs (else both render blank = useless test)
    const num = u16(font, 4); let hasCmap = false, numGlyphs = 0, maxpOff = 0;
    for (let i = 0; i < num; i++) { const o = 12 + i * 16; const t = tagAt(font, o); if (t === 'cmap') hasCmap = true; if (t === 'maxp') maxpOff = u32(font, o + 8); }
    if (!hasCmap || !maxpOff) continue;
    numGlyphs = u16(font, maxpOff + 4);

    const keepAll = new Set(); for (let g = 0; g < numGlyphs; g++) keepAll.add(g);
    const gutted = gutFont(font, keepAll);
    if (!gutted) { console.log('gutFont returned null — skip'); continue; }

    const a = render(font, `Orig${tested}`);
    const b = render(gutted.file, `Strip${tested}`);
    const ink = (() => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] < 128) n++; return n; })();
    const diff = diffCount(a, b);
    console.log(`font #${tested}: glyphs ${numGlyphs} | orig ${font.length}B -> stripped ${gutted.file.length}B (${((1 - gutted.file.length / font.length) * 100).toFixed(1)}% raw) | ink px ${ink} | PIXEL DIFF: ${diff} ${diff === 0 ? '✅ IDENTICAL' : '❌'}`);
    if (++tested >= 3) break;
  }
  if (tested === 0) console.log('no testable fonts found');
  fs.rmSync(path.join(__dirname, 'pdfrender-stub.cjs'), { force: true });
})().catch((e) => { console.error('ERR', e); process.exit(1); });
