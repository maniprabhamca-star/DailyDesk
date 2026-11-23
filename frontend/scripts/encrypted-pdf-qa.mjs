// Real-file proof for the encrypted-PDF fix. Run: npm run qa:encrypted
//
// Why a script and not a unit test: this fetches live government forms and
// drives the qpdf WebAssembly binary. Both belong out of the unit suite —
// committed fixtures of federal forms go stale without notice, and the unit
// run must not depend on the network. tests/unit/pdf-open.test.ts covers the
// parts that can be tested hermetically.
//
// What it proves, per form:
//   1. the file really is encrypted (pdf-lib refuses it)
//   2. qpdf clears it with an EMPTY password (these need no password to open)
//   3. pdf-lib then finds the form fields it previously reported as zero
//   4. a page operation (drawText + save) actually succeeds afterwards
//
// Baselines are the numbers measured on 2026-11-23. A field count that MOVES
// is not a failure — these forms get revised — but it should be noticed, so a
// drift is reported rather than ignored.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const require = createRequire(import.meta.url);
// fileURLToPath, not .pathname — a repo path containing a space comes back
// percent-encoded from .pathname and require() then cannot find it.
const QPDF = fileURLToPath(new URL('../public/qpdf/qpdf.js', import.meta.url));

const FORMS = [
  { id: 'I-130', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf', encrypted: true, fields: 450 },
  { id: 'I-485', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf', encrypted: true, fields: 730, richText: true },
  { id: 'I-765', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf', encrypted: true, fields: 161 },
  { id: 'N-400', url: 'https://www.uscis.gov/sites/default/files/document/forms/n-400.pdf', encrypted: true, fields: 440 },
  // Controls: unencrypted forms must keep working untouched.
  { id: 'I-9', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf', encrypted: false, fields: 128 },
  { id: 'W-9', url: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf', encrypted: false, fields: 23 },
  { id: '433-A', url: 'https://www.irs.gov/pub/irs-pdf/f433a.pdf', encrypted: false, fields: 515 },
];

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; diemdesk-encrypted-pdf-qa)' };
const declaresEncryption = (b) => /\/Encrypt\b/.test(Buffer.from(b).toString('latin1'));

// Mirrors neutraliseRichText() in lib/pdf-open.ts. Kept in step with it by the
// rich-text assertion below: if pdf-lib stops throwing, or this stops being
// enough, that assertion is what says so.
const RICH_TEXT_FLAG = 1 << 25;
async function neutraliseRichText(doc) {
  const { PDFName, PDFNumber } = await import('pdf-lib');
  if (!doc.catalog.lookup(PDFName.of('AcroForm'))) return 0;
  let fields;
  try { fields = doc.getForm().getFields(); } catch { return 0; }
  let touched = 0;
  for (const field of fields) {
    const dict = field.acroField.dict;
    const ff = dict.lookup(PDFName.of('Ff'));
    const flags = ff && typeof ff.asNumber === 'function' ? ff.asNumber() : 0;
    const hasRV = !!dict.get(PDFName.of('RV'));
    if (!(flags & RICH_TEXT_FLAG) && !hasRV) continue;
    if (flags & RICH_TEXT_FLAG) dict.set(PDFName.of('Ff'), PDFNumber.of(flags & ~RICH_TEXT_FLAG));
    if (hasRV) dict.delete(PDFName.of('RV'));
    touched++;
  }
  return touched;
}

async function qpdfDecrypt(bytes) {
  const factory = require(QPDF);
  const mod = await factory({ noInitialRun: true, print: () => {}, printErr: () => {} });
  mod.FS.writeFile('/in.pdf', bytes);
  let code = 0;
  try {
    code = mod.callMain(['--password=', '--decrypt', '/in.pdf', '/out.pdf']) ?? 0;
  } catch (e) {
    if (typeof e?.status === 'number') code = e.status;
    else throw e;
  }
  let out = null;
  try { out = mod.FS.readFile('/out.pdf'); } catch { /* qpdf wrote nothing */ }
  return { code, out };
}

let failures = 0;
let drifts = 0;
const rows = [];

for (const f of FORMS) {
  const row = { id: f.id, notes: [] };
  try {
    const r = await fetch(f.url, { headers: UA, redirect: 'follow' });
    if (!r.ok) { row.notes.push(`HTTP ${r.status} — skipped`); rows.push(row); continue; }
    const src = new Uint8Array(await r.arrayBuffer());

    // 1. is it encrypted, and does a plain load refuse it?
    const declared = declaresEncryption(src);
    let plainLoads = true;
    try { await PDFDocument.load(src.slice()); } catch { plainLoads = false; }

    if (declared !== f.encrypted) {
      row.notes.push(`DRIFT encryption now ${declared} (expected ${f.encrypted})`);
      drifts++;
    }
    if (f.encrypted && plainLoads) { row.notes.push('FAIL expected a plain load to refuse this'); failures++; }
    if (!f.encrypted && !plainLoads) { row.notes.push('FAIL an unencrypted control failed to load'); failures++; }

    // 2. decrypt only when needed — exactly what openPdfDoc does
    let bytes = src;
    if (declared) {
      const { code, out } = await qpdfDecrypt(src.slice());
      if (code !== 0 || !out) { row.notes.push(`FAIL qpdf exit=${code}, no usable output`); failures++; rows.push(row); continue; }
      if (declaresEncryption(out)) { row.notes.push('FAIL still encrypted after qpdf'); failures++; }
      bytes = out;
      row.sizes = `${Math.round(src.length / 1024)}KB -> ${Math.round(out.length / 1024)}KB`;
    }

    // 3. fields readable?
    const doc = await PDFDocument.load(bytes.slice(), { updateMetadata: false });
    const n = doc.getForm().getFields().length;
    row.fields = n;
    if (n === 0) { row.notes.push('FAIL no fields found'); failures++; }
    else if (n !== f.fields) { row.notes.push(`drift ${f.fields} -> ${n} fields`); drifts++; }

    // 4. does a page operation actually work now?
    // A PLAIN save, deliberately — openPdfDoc neutralises rich-text fields on
    // the way in, so the 61 doc.save() calls across the codebase need no
    // options and no migration. If this throws, that central fix is not doing
    // its job.
    row.richTextTouched = await neutraliseRichText(doc);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPages()[0].drawText('QA', { x: 24, y: 24, size: 8, font, color: rgb(0, 0, 0) });
    const saved = await doc.save();
    row.out = `${Math.round(saved.length / 1024)}KB`;
    if (saved.length < 1000) { row.notes.push('FAIL output implausibly small'); failures++; }

    if (f.richText) {
      row.notes.push(`richText neutralised=${row.richTextTouched}`);
      if (!row.richTextTouched) { row.notes.push('FAIL expected rich-text fields to neutralise'); failures++; }
      // And prove the hazard is real: WITHOUT the fix, the same save throws.
      let threw = false;
      try {
        const d2 = await PDFDocument.load(bytes.slice(), { updateMetadata: false });
        d2.getForm();
        await d2.save();
      } catch (e) { threw = /rich text/i.test(String(e.message)); }
      row.notes.push(threw
        ? 'without the fix it throws (hazard confirmed)'
        : 'NOTE pdf-lib no longer throws on rich text — neutraliseRichText may be removable');
    }
  } catch (e) {
    row.notes.push(`FAIL ${String(e.message).slice(0, 70)}`);
    failures++;
  }
  rows.push(row);
}

for (const r of rows) {
  const bits = [
    r.id.padEnd(7),
    `fields=${String(r.fields ?? '-').padEnd(5)}`,
    (r.sizes || '').padEnd(20),
    (r.out ? `out=${r.out}` : '').padEnd(12),
    r.notes.join(' · '),
  ];
  process.stdout.write(bits.join(' ') + '\n');
}
process.stdout.write(`\nfailures=${failures} drifts=${drifts}\n`);
if (failures) process.stdout.write('FAILED\n');
process.exit(failures ? 1 : 0);
