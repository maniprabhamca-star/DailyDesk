// Re-check every US form's stated version marker, field count and page count
// against the authority itself. The offline half of the contract is
// tests/unit/us-forms.test.ts, which runs in CI; this is the live half.
//
// Why it exists: our pages assert a revision. That is a verifiable claim about
// a federal document, and the moment it drifts we become the thing we are
// criticising — pdf.net's form pages wear an "Official IRS form" badge and link
// to irs.gov zero times. So the claim gets re-checked by script, not trusted.
//
// How it checks, and why this way: **it reads the marker off the form itself**
// rather than off an index page. Five agencies publish these and they do not
// agree on what a version is — the IRS prints "(Rev. March 2026)" or just a
// form year, USCIS prints "Edition 04/01/24", the DOL prints "Revised June
// 2020", the SSA prints "Form SS-5 (12-2024)". The one thing all five do is
// print it on the document, so the document is the source of truth.
//
// NOT in CI on purpose: it fetches 30 PDFs from five government sites, and
// those agencies revise on their own schedule. A drift is news to act on, not
// a reason to fail somebody's unrelated commit.
//
//   npm run verify:us-forms
//
// Exit code 1 on drift, so it can be wired into a scheduled job later.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
const qpdfFactory = require('../public/qpdf/qpdf.js');

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; DiemDesk form-revision check)' };
console.warn = () => {};
const realError = console.error;
console.error = () => {};

/** Several of these are permissions-only encrypted (every USCIS form, SSA SS-5):
 *  they open with no password, but pdf-lib refuses and getFields() returns 0.
 *  Same qpdf-wasm the app ships. See lib/pdf-open.ts. */
async function decrypt(bytes) {
  const mod = await qpdfFactory({ noInitialRun: true, print: () => {}, printErr: () => {} });
  mod.FS.writeFile('/in.pdf', bytes);
  try { mod.callMain(['--password=', '--decrypt', '/in.pdf', '/out.pdf']); }
  catch (e) { if (typeof e?.status !== 'number') throw e; }
  return mod.FS.readFile('/out.pdf');
}

// Read the data file as text: this runs outside Next, and lib/us-forms.ts is
// TypeScript behind a path alias.
const src = readFileSync('lib/us-forms.ts', 'utf8');
const forms = src.split(/\n  \{\n    slug: '/).slice(1).map((b) => ({
  slug: b.slice(0, b.indexOf("'")),
  name: (b.match(/name: '([^']+)'/) || [])[1],
  revisionLabel: (b.match(/revisionLabel: '([^']+)'/) || [])[1],
  revision: (b.match(/revision: '([^']+)'/) || [])[1],
  pdfUrl: (b.match(/pdfUrl: '([^']+)'/) || [])[1],
  officialUrl: (b.match(/officialUrl: '([^']+)'/) || [])[1],
  fields: Number((b.match(/fields: (\d+)/) || [])[1]),
  pages: Number((b.match(/pages: (\d+)/) || [])[1]),
}));

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Find the printed marker matching this form's label, and normalise both sides
 *  to YYYY-MM (or YYYY) so "March 2026" and "Mar 2026" are not a false drift. */
function findMarker(label, text) {
  const norm = (y, m) => (m ? `${y}-${String(m).padStart(2, '0')}` : String(y));
  const monthNum = (w) => MONTHS[w.slice(0, 3).toLowerCase()];

  if (label === 'Edition date') {
    const m = text.match(/Edition\s+(\d{2})\/(\d{2})\/(\d{2})/i);
    return m ? { raw: `${m[1]}/${m[2]}/${m[3]}`, key: `20${m[3]}-${m[1]}` } : null;
  }
  if (label === 'Rev.') {
    // Three real spellings, all seen on IRS forms today:
    //   "(Rev. March 2026)"  "(Rev. 6-2026)"  "(April 2025)"
    let m = text.match(/\(Rev\.?\s*(\d{1,2})-(\d{4})\)/i);
    if (m) return { raw: `${m[1]}-${m[2]}`, key: norm(m[2], Number(m[1])) };
    m = text.match(/\(Rev\.?\s*([A-Za-z]+)\.?\s*(\d{4})\)/i);
    if (m && monthNum(m[1])) return { raw: `${m[1]} ${m[2]}`, key: norm(m[2], monthNum(m[1])) };
    m = text.match(/\(([A-Za-z]+)\s+(\d{4})\)/);
    if (m && monthNum(m[1])) return { raw: `${m[1]} ${m[2]}`, key: norm(m[2], monthNum(m[1])) };
    return null;
  }
  if (label === 'Revised') {
    const m = text.match(/Revised\s+([A-Za-z]+)\s+(\d{4})/i);
    return m && monthNum(m[1]) ? { raw: `${m[1]} ${m[2]}`, key: norm(m[2], monthNum(m[1])) } : null;
  }
  if (label === 'Form date') {
    let m = text.match(/\((\d{2})-(\d{4})\)/);
    if (m) return { raw: `${m[1]}-${m[2]}`, key: norm(m[2], Number(m[1])) };
    m = text.match(/VA FORM[^A-Za-z]{0,20}([A-Z]{3})\s*(\d{4})/i);
    return m && monthNum(m[1]) ? { raw: `${m[1]} ${m[2]}`, key: norm(m[2], monthNum(m[1])) } : null;
  }
  if (label === 'Form year') {
    // "Form 1040 2025" / "Form 940 for 2025:" — the year beside the form number.
    let m = text.match(/Form\s+[\w-]+\s*(?:for\s*)?((?:\d\s*){4})/i);
    if (m) { const y = m[1].replace(/\s/g, ''); if (/^20\d{2}$/.test(y)) return { raw: y, key: y }; }
    // "Wage and Tax Statement 2026" — the year is beside the TITLE here.
    m = text.match(/Wage and Tax Statement\s*((?:\d\s*){4})/i) || text.match(/((?:\d\s*){4})\s*Wage and Tax Statement/i);
    if (m) { const y = m[1].replace(/\s/g, ''); if (/^20\d{2}$/.test(y)) return { raw: y, key: y }; }
    return null;
  }
  return null;
}

function ourKey(label, value) {
  const monthNum = (w) => MONTHS[w.slice(0, 3).toLowerCase()];
  if (label === 'Edition date') { const m = value.match(/^(\d{2})\/\d{2}\/(\d{2})$/); return m ? `20${m[2]}-${m[1]}` : value; }
  if (label === 'Form year') return value;
  let m = value.match(/^(\d{2})-(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  m = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m && monthNum(m[1])) return `${m[2]}-${String(monthNum(m[1])).padStart(2, '0')}`;
  return value;
}

let drifts = 0, unchecked = 0;
const rows = [];

for (const f of forms) {
  const notes = [];
  try {
    const r = await fetch(f.pdfUrl, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = new Uint8Array(await r.arrayBuffer());

    let bytes = raw, encrypted = false;
    try { await PDFDocument.load(raw.slice()); }
    catch { encrypted = true; bytes = await decrypt(raw.slice()); }

    const doc = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
    const nf = doc.getForm().getFields().length;
    const np = doc.getPageCount();
    if (nf !== f.fields) { notes.push(`FIELDS: we say ${f.fields}, file has ${nf}`); drifts++; }
    if (np !== f.pages) { notes.push(`PAGES: we say ${f.pages}, file has ${np}`); drifts++; }

    // the marker, off the form itself (first pages only — that is where it is)
    const pd = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
    let text = '';
    for (let i = 1; i <= Math.min(pd.numPages, 4); i++) {
      const pg = await pd.getPage(i);
      text += ' ' + (await pg.getTextContent()).items.map((x) => x.str).join(' ');
    }
    text = text.replace(/\s+/g, ' ');

    let found = findMarker(f.revisionLabel, text);
    let from = 'the form';
    if (!found) {
      // Some forms do not print it in extractable text — the I-9's edition date
      // sits in a footer pdf.js does not surface. The agency's own page states
      // it, so ask there before giving up.
      try {
        const page = await fetch(f.officialUrl, { headers: UA, redirect: 'follow' });
        if (page.ok) {
          const html = (await page.text()).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
          const alt = findMarker(f.revisionLabel, html) || findMarker(f.revisionLabel, html.replace(/Edition Date/gi, 'Edition'));
          if (alt) { found = alt; from = 'the agency page'; }
        }
      } catch { /* leave it unchecked */ }
    }
    if (!found) {
      notes.push(`marker NOT FOUND on the form (we say ${f.revisionLabel} ${f.revision}) — verify by hand`);
      unchecked++;
    } else if (found.key !== ourKey(f.revisionLabel, f.revision)) {
      notes.push(`REVISION: we say "${f.revision}", ${from} says "${found.raw}"`);
      drifts++;
    }

    rows.push(
      `${f.slug.padEnd(16)} ${String(f.revisionLabel).padEnd(12)} ${String(f.revision).padEnd(10)} fields=${String(f.fields).padEnd(5)} pages=${String(f.pages).padEnd(3)} ${encrypted ? 'enc ' : '    '}${notes.length ? '✗ ' + notes.join(' · ') : '✓'}`,
    );
  } catch (e) {
    rows.push(`${f.slug.padEnd(16)} UNCHECKED (${e.message})`);
    unchecked++;
  }

  // the link we send readers to must still work
  try {
    const a = await fetch(f.officialUrl, { headers: UA, redirect: 'follow' });
    if (!a.ok) { rows.push(`${''.padEnd(16)} ✗ officialUrl HTTP ${a.status}  ${f.officialUrl}`); drifts++; }
  } catch (e) { rows.push(`${''.padEnd(16)} officialUrl UNCHECKED (${e.message})`); unchecked++; }
}

console.log(rows.join('\n'));
console.log(`\nforms=${forms.length} drifts=${drifts} unchecked=${unchecked}`);
if (drifts || unchecked) {
  realError(
    '\nA drift is not a build failure — these agencies revise on their own schedule.\n' +
      'Update lib/us-forms.ts and CHECKED_ON, then re-run. "UNCHECKED" means the network,\n' +
      'the agency, or a marker this script cannot parse — not necessarily bad data.',
  );
}
process.exit(drifts ? 1 : 0);
