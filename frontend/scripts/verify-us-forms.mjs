// Re-check every US form's stated revision, field count and page count against
// the authority itself. This is the live half of the contract — the offline
// half is tests/unit/us-forms.test.ts, which runs in CI.
//
// Why this exists: our pages assert a revision ("Rev. Mar 2024"). That is a
// verifiable claim about a federal document, and the moment it drifts we become
// the thing we criticise — pdf.net's form pages wear an "Official IRS form"
// badge and link to irs.gov zero times. So the claim gets re-checked, by
// script, rather than trusted.
//
// NOT in CI on purpose: it hits irs.gov a dozen times and the IRS revises forms
// on its own schedule, so a drift is news to act on, not a reason to fail
// somebody's unrelated commit. Run it before shipping changes to the library,
// and periodically.
//
//   node scripts/verify-us-forms.mjs
//
// Exit code is 1 when anything drifts, so it can still be wired into a
// scheduled job later.
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; DiemDesk form-revision check)' };

// The IRS product table keys on the form number; the raw PDF lives under a
// different basename. Neither is derivable from our slug, so they are listed.
const LOOKUP = {
  'form-w-9': { find: 'W-9', pdf: 'fw9' },
  'form-w-4': { find: 'W-4', pdf: 'fw4' },
  'form-w-7': { find: 'W-7', pdf: 'fw7' },
  'form-ss-4': { find: 'SS-4', pdf: 'fss4' },
  'form-2848': { find: '2848', pdf: 'f2848' },
  'form-8821': { find: '8821', pdf: 'f8821' },
  'form-8822': { find: '8822', pdf: 'f8822' },
  'form-4506-t': { find: '4506-T', pdf: 'f4506t' },
  'form-ss-8': { find: 'SS-8', pdf: 'fss8' },
  'form-433-a': { find: '433-A', pdf: 'f433a' },
  'form-433-f': { find: '433-F', pdf: 'f433f' },
  'form-9465': { find: '9465', pdf: 'f9465' },
};

// Read the data file as text rather than importing it: this script runs outside
// Next, and lib/us-forms.ts is TypeScript with a path alias.
const src = readFileSync('lib/us-forms.ts', 'utf8');
const blocks = src.split(/\n  \{\n    slug: '/).slice(1);
const field = (b, k, re) => (b.match(re) || [])[1];

const forms = blocks.map((b) => ({
  slug: b.slice(0, b.indexOf("'")),
  name: field(b, 'name', /name: '([^']+)'/),
  revision: field(b, 'revision', /revision: '([^']+)'/),
  fields: Number(field(b, 'fields', /fields: (\d+)/)),
  pages: Number(field(b, 'pages', /pages: (\d+)/)),
  officialUrl: field(b, 'officialUrl', /officialUrl: '([^']+)'/),
}));

const strip = (h) =>
  h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The revision the IRS states today, off its own product table. */
async function liveRevision(find) {
  const url = `https://www.irs.gov/forms-instructions-and-publications?find=${encodeURIComponent(find)}&items_per_page=25`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return { err: `product table HTTP ${r.status}` };
  const html = await r.text();
  for (const row of html.split(/<tr[^>]*>/).slice(1)) {
    const cells = row.split(/<td[^>]*>/).slice(1).map((c) => strip(c.split('</td>')[0]));
    if (cells.length < 3) continue;
    if (cells[0].toLowerCase() === `form ${find}`.toLowerCase()) {
      return { revision: cells[2], title: cells[1] };
    }
  }
  return { err: 'no exact "Form X" row in the product table' };
}

// The data file writes "Mar 2024"; the IRS table writes "Mar 2024" too, but it
// has used full month names before now. Compare on month-number + year so a
// cosmetic difference is not reported as drift.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function norm(rev) {
  if (!rev) return null;
  const year = (rev.match(/\b(\d{4})\b/) || [])[1];
  if (!year) return null;
  const m = rev.trim().toLowerCase().slice(0, 3);
  const mi = MONTHS.indexOf(m);
  return mi === -1 ? year : `${year}-${String(mi + 1).padStart(2, '0')}`;
}

let drifts = 0;
let errors = 0;
const rows = [];

for (const f of forms) {
  const look = LOOKUP[f.slug];
  if (!look) {
    rows.push(`${f.slug.padEnd(14)} NOT IN LOOKUP — add it to this script when you add the form`);
    errors++;
    continue;
  }

  const live = await liveRevision(look.find).catch((e) => ({ err: e.message }));
  const notes = [];

  if (live.err) {
    notes.push(`revision UNCHECKED (${live.err})`);
    errors++;
  } else if (norm(live.revision) !== norm(f.revision)) {
    notes.push(`REVISION DRIFT: we say "${f.revision}", IRS says "${live.revision}"`);
    drifts++;
  }

  // Field and page counts, off the real PDF.
  try {
    const r = await fetch(`https://www.irs.gov/pub/irs-pdf/${look.pdf}.pdf`, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const b = new Uint8Array(await r.arrayBuffer());
    const doc = await PDFDocument.load(b.slice());
    const nf = doc.getForm().getFields().length;
    const np = doc.getPageCount();
    if (nf !== f.fields) { notes.push(`FIELDS DRIFT: we say ${f.fields}, file has ${nf}`); drifts++; }
    if (np !== f.pages) { notes.push(`PAGES DRIFT: we say ${f.pages}, file has ${np}`); drifts++; }
  } catch (e) {
    notes.push(`counts UNCHECKED (${e.message})`);
    errors++;
  }

  // The link has to still be a live authority page, not a 404 we are sending
  // readers to. A redirect is fine; a 404 is the page lying.
  try {
    const r = await fetch(f.officialUrl, { headers: UA, redirect: 'follow' });
    if (!r.ok) { notes.push(`officialUrl HTTP ${r.status}`); drifts++; }
  } catch (e) {
    notes.push(`officialUrl UNCHECKED (${e.message})`);
    errors++;
  }

  rows.push(
    `${f.slug.padEnd(14)} rev=${String(f.revision).padEnd(9)} fields=${String(f.fields).padEnd(5)} pages=${String(f.pages).padEnd(3)} ${notes.length ? '✗ ' + notes.join(' · ') : '✓'}`,
  );
}

console.log(rows.join('\n'));
console.log(`\nforms=${forms.length} drifts=${drifts} unchecked=${errors}`);
if (drifts || errors) {
  console.log(
    '\nA drift is not a build failure — the IRS revises on its own schedule. Update lib/us-forms.ts\n' +
      'and CHECKED_ON, then re-run. An "unchecked" line means the network or the IRS, not our data.',
  );
}
process.exit(drifts ? 1 : 0);
