// Re-check every box the Pro packet writes into, against the live form.
//
// ── Why this is the most important verifier in the repo ─────────────────────
// The other two check a CLAIM: that a page states the revision the agency
// publishes. A wrong claim is embarrassing. This one checks an ACTION: that
// when we write a social security number into `f1_11`, `f1_11` is still the
// box the form prints "Social security number" next to.
//
// IRS field names carry no meaning. There are no tooltips. `f1_11` on the W-9
// is the first three digits of a taxpayer number only because somebody
// rendered the form, stamped every box with its own id, and looked. If the IRS
// re-issues the form with one box inserted above, every name below it shifts
// and the map silently starts writing a person's taxpayer number into the
// wrong line of a federal form. Nothing would fail. Nothing would look wrong.
//
// ── What it actually proves ─────────────────────────────────────────────────
// Three things, in order of strength:
//   1. every mapped field still EXISTS on the file the agency served today;
//   2. it still reports the SIZE the map expects — the cheap, strong signal
//      that a comb box was not re-laid-out, since a three-digit box becoming a
//      nine-digit box is exactly what a renumbering looks like;
//   3. a fill actually ROUND-TRIPS: write a distinctive value, save, re-open
//      the saved bytes, and read it back out of the same named field — and
//      confirm no field the map does not name was touched.
//
// What it CANNOT prove is that the box still means what it meant, because that
// is a fact about printed ink next to a rectangle. (2) is the proxy. The real
// backstop is `verifiedOn` in lib/form-packet.ts, which only a person moves,
// after looking at a rendering. Two clocks, same as the form pages.
//
//   npm run verify:packet-maps
//
// Exit 1 on drift, so forms-sync.yml can act on it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const qpdfFactory = require('../public/qpdf/qpdf.js');

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; DiemDesk packet-map check)' };
console.warn = () => {};

async function decrypt(bytes) {
  const mod = await qpdfFactory({ noInitialRun: true, print: () => {}, printErr: () => {} });
  mod.FS.writeFile('/in.pdf', bytes);
  try { mod.callMain(['--password=', '--decrypt', '/in.pdf', '/out.pdf']); }
  catch (e) { if (typeof e?.status !== 'number') throw e; }
  return mod.FS.readFile('/out.pdf');
}

// ── Read the maps out of the TypeScript, rather than importing it ───────────
// lib/form-packet.ts imports lib/us-forms.ts and lib/form-tasks.ts through the
// `@/` alias, which Node cannot resolve without a build step. The maps are
// plain literals, so they are parsed out of the source. The unit test imports
// the module properly and checks the same data, so a parse that silently found
// nothing shows up as a zero count here — which is treated as failure below.
const src = readFileSync(new URL('../lib/form-packet.ts', import.meta.url), 'utf8');

function parseFieldArrays() {
  const arrays = {};
  const re = /const (\w+): readonly PacketField\[\] = \[([\s\S]*?)\n\];/g;
  let m;
  while ((m = re.exec(src))) arrays[m[1]] = parseFields(m[2]);
  return arrays;
}

function parseFields(block) {
  const out = [];
  for (const line of block.split('\n')) {
    const name = /name: '([^']+)'/.exec(line);
    if (!name) continue;
    const max = /maxLength: (null|\d+)/.exec(line);
    const label = /label: '((?:[^'\\]|\\.)*)'/.exec(line);
    const digits = /digits: \[(\d+), (\d+)\]/.exec(line);
    const as = /as: '([^']+)'/.exec(line);
    out.push({
      name: name[1],
      maxLength: !max || max[1] === 'null' ? null : Number(max[1]),
      label: label ? label[1] : '(unlabelled)',
      digits: digits ? [Number(digits[1]), Number(digits[2])] : null,
      as: as ? as[1] : null,
    });
  }
  return out;
}

function parseMaps(arrays) {
  const maps = [];
  const body = src.slice(src.indexOf('export const PACKET_MAPS'));
  const re = /taskSlug: '([^']+)',\s*formSlug: '([^']+)',\s*verifiedOn: VERIFIED,\s*fields: (\w+)/g;
  let m;
  while ((m = re.exec(body))) {
    maps.push({ taskSlug: m[1], formSlug: m[2], fieldsName: m[3], fields: arrays[m[3]] ?? [] });
  }
  return maps;
}

/** pdfUrl for a form slug, read out of lib/us-forms.ts the same way. */
function formUrls() {
  const forms = readFileSync(new URL('../lib/us-forms.ts', import.meta.url), 'utf8');
  const urls = {};
  const re = /slug: '([^']+)',[\s\S]*?pdfUrl: '([^']+)'/g;
  let m;
  while ((m = re.exec(forms))) if (!urls[m[1]]) urls[m[1]] = m[2];
  return urls;
}

const arrays = parseFieldArrays();
const maps = parseMaps(arrays);
const urls = formUrls();

if (maps.length === 0) {
  console.error('Parsed no packet maps out of lib/form-packet.ts. The file changed shape — fix this script.');
  console.log('forms=0 drifts=1 unchecked=0');
  process.exit(1);
}

// Distinctive, obviously-synthetic values. Nine digits so the taxpayer-number
// boxes take them, and nothing that resembles a real person's details.
const TEST = { nine: '000000000', text: 'ZZTESTZZ' };

let drifts = 0;
let unchecked = 0;
let boxes = 0;

/** One form may appear in several tasks; fetch it once. */
const cache = new Map();
async function load(formSlug) {
  if (cache.has(formSlug)) return cache.get(formSlug);
  const url = urls[formSlug];
  if (!url) throw new Error(`no pdfUrl for ${formSlug}`);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  let bytes = new Uint8Array(await res.arrayBuffer());
  try { await PDFDocument.load(bytes); }
  catch { bytes = await decrypt(bytes); }
  cache.set(formSlug, bytes);
  return bytes;
}

for (const map of maps) {
  const id = `${map.taskSlug} → ${map.formSlug}`;
  if (map.fields.length === 0) {
    console.log(`\n✗ ${id}\n    the map parsed with no fields — ${map.fieldsName} was not found`);
    drifts += 1;
    continue;
  }

  let bytes;
  try {
    bytes = await load(map.formSlug);
  } catch (e) {
    console.log(`\n? ${id}\n    could not read the form: ${e.message}`);
    unchecked += 1;
    continue;
  }

  const problems = [];
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  // Everything the file has, before we touch it.
  const before = new Map();
  for (const f of form.getFields()) {
    if (f.constructor.name !== 'PDFTextField') continue;
    before.set(f.getName(), f.getText() ?? '');
  }

  // 1 + 2 — existence and size.
  const writable = [];
  for (const field of map.fields) {
    boxes += 1;
    let real;
    try { real = form.getTextField(field.name); }
    catch { problems.push(`${field.name} (${field.label}) is not on the form any more`); continue; }
    const actual = real.getMaxLength() ?? null;
    if (actual !== field.maxLength) {
      problems.push(`${field.name} (${field.label}) holds ${actual ?? 'any length'}, the map expects ${field.maxLength ?? 'any length'}`);
      continue;
    }
    writable.push({ field, real });
  }

  // 3 — round-trip. Write, save, re-open, read back.
  const expected = new Map();
  for (const { field, real } of writable) {
    const value = field.digits
      ? TEST.nine.slice(field.digits[0], field.digits[1])
      : field.as === 'ssn-dashed'
        ? '000-00-0000'
        : field.as === 'ein-dashed'
          ? '00-0000000'
          : TEST.text;
    try { real.setText(value); } catch (e) { problems.push(`${field.name} refused a value: ${e.message}`); continue; }
    expected.set(field.name, value);
  }

  const saved = await doc.save({ updateFieldAppearances: false });
  const reread = (await PDFDocument.load(saved)).getForm();

  for (const [name, value] of expected) {
    let got;
    try { got = reread.getTextField(name).getText() ?? ''; }
    catch { problems.push(`${name} vanished after saving`); continue; }
    if (got !== value) problems.push(`${name} read back as "${got}", not "${value}"`);
  }

  // Nothing outside the map may have moved. This is what catches a map that
  // writes through a shared parent node.
  for (const f of reread.getFields()) {
    if (f.constructor.name !== 'PDFTextField') continue;
    const name = f.getName();
    if (expected.has(name)) continue;
    const now = f.getText() ?? '';
    if (now !== (before.get(name) ?? '')) problems.push(`${name} changed but is not in the map`);
  }

  if (problems.length) {
    drifts += 1;
    console.log(`\n✗ ${id}`);
    for (const p of problems) console.log(`    ${p}`);
  } else {
    console.log(`✓ ${id} — ${map.fields.length} boxes, all present, correctly sized, and they round-trip`);
  }
}

console.log('');
console.log(`Checked ${boxes} boxes across ${maps.length} task/form maps.`);
if (drifts) {
  console.log('');
  console.log('A box the packet writes into has moved. Do NOT guess the new name:');
  console.log('re-render the form with scripts/probe-form-fields.mjs, look at it, and move');
  console.log("verifiedOn in lib/form-packet.ts once a person has confirmed the box.");
}
// The exact summary shape the other verifiers print. forms-sync.yml greps for
// `^forms=` and SUMS every line it finds, so this has to start the same way or
// a drift here would be counted by nobody.
console.log(`forms=${maps.length} drifts=${drifts} unchecked=${unchecked}`);
process.exit(drifts ? 1 : 0);
