/**
 * Proves the doc-info engine on a real PDF, without a browser.
 *
 * The case that matters is the second one: a file carrying BOTH an Info
 * dictionary and an XMP packet that disagree with it. That is the file where
 * every "edit PDF metadata" tool that writes only Info appears to work and
 * changes nothing the reader shows.
 */
import fs from 'fs';
import { PDFDocument, PDFName, PDFRawStream, PDFNumber, PDFDict } from 'pdf-lib';

const SRC = process.argv[2] || 'dev-harness/ftp.pdf';

// --- the engine, transliterated from lib/pdf-docinfo.ts (same logic, no DOM) --
const OWNED = ['dc:title', 'dc:creator', 'dc:description', 'dc:subject', 'pdf:Keywords', 'xmp:CreatorTool', 'pdf:Producer'];
const enc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stripOwned(xml) {
  let out = xml;
  for (const tag of OWNED) {
    out = out.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>\\s*`, 'g'), '');
    out = out.replace(new RegExp(`<${tag}(?:\\s[^>]*)?/>\\s*`, 'g'), '');
  }
  return out;
}

function buildDescription(v) {
  const p = [];
  if (v.title) p.push(`<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${enc(v.title)}</rdf:li></rdf:Alt></dc:title>`);
  if (v.author) p.push(`<dc:creator><rdf:Seq>${v.author.split(/\s*;\s*/).filter(Boolean).map((a) => `<rdf:li>${enc(a)}</rdf:li>`).join('')}</rdf:Seq></dc:creator>`);
  if (v.subject) p.push(`<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${enc(v.subject)}</rdf:li></rdf:Alt></dc:description>`);
  if (v.keywords) {
    p.push(`<pdf:Keywords>${enc(v.keywords)}</pdf:Keywords>`);
    const kws = v.keywords.split(/\s*,\s*/).filter(Boolean);
    if (kws.length) p.push(`<dc:subject><rdf:Bag>${kws.map((k) => `<rdf:li>${enc(k)}</rdf:li>`).join('')}</rdf:Bag></dc:subject>`);
  }
  if (!p.length) return '';
  return `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">${p.join('')}</rdf:Description>`;
}

function patchXmp(xml, v) {
  const stripped = stripOwned(xml);
  const desc = buildDescription(v);
  if (!desc) return stripped;
  const close = stripped.lastIndexOf('</rdf:RDF>');
  if (close === -1) return stripped;
  return stripped.slice(0, close) + desc + stripped.slice(close);
}

function xmpOf(doc) {
  const ref = doc.catalog.get(PDFName.of('Metadata'));
  if (!ref) return null;
  const stream = doc.context.lookup(ref);
  if (!(stream instanceof PDFRawStream)) return null;
  return { xml: Buffer.from(stream.contents).toString('utf8'), ref };
}

async function write(bytes, v) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  doc.setTitle(v.title); doc.setAuthor(v.author); doc.setSubject(v.subject);
  doc.setKeywords(v.keywords ? [v.keywords] : []);
  if (v.creator) doc.setCreator(v.creator);
  if (v.producer) doc.setProducer(v.producer);
  const xmp = xmpOf(doc);
  if (xmp) {
    const raw = Buffer.from(patchXmp(xmp.xml, v), 'utf8');
    const dict = doc.context.lookup(xmp.ref).dict;
    dict.set(PDFName.of('Length'), PDFNumber.of(raw.length));
    doc.context.assign(xmp.ref, PDFRawStream.of(dict, new Uint8Array(raw)));
  }
  return doc.save({ useObjectStreams: true });
}

async function readBack(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const xmp = xmpOf(doc);
  return {
    info: { title: doc.getTitle(), author: doc.getAuthor(), subject: doc.getSubject(), keywords: doc.getKeywords(), producer: doc.getProducer(), creator: doc.getCreator() },
    xmp: xmp ? xmp.xml : null,
  };
}

const VALUES = {
  title: 'Quarterly Report — Q3 & "final"',
  author: 'Ada Lovelace; Grace Hopper',
  subject: 'Numbers for the board',
  keywords: 'finance, board, q3',
  creator: 'DiemDesk',
  producer: 'DiemDesk',
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

// --- case 1: a plain PDF with no XMP -----------------------------------------
{
  const out = await write(fs.readFileSync(SRC), VALUES);
  const back = await readBack(out);
  check('plain PDF: title round-trips', back.info.title === VALUES.title, back.info.title);
  check('plain PDF: author round-trips', back.info.author === VALUES.author, back.info.author);
  check('plain PDF: subject round-trips', back.info.subject === VALUES.subject, back.info.subject);
  check('plain PDF: keywords keep their commas', String(back.info.keywords) === VALUES.keywords, String(back.info.keywords));
  check('plain PDF: still a valid PDF', Buffer.from(out.slice(0, 5)).toString() === '%PDF-');
  check('plain PDF: our Producer survives the save (pdf-lib does not stamp itself)', back.info.producer === VALUES.producer, String(back.info.producer));
  check('plain PDF: our Creator survives the save', back.info.creator === VALUES.creator, String(back.info.creator));
  const pages = (await PDFDocument.load(out)).getPageCount();
  const before = (await PDFDocument.load(fs.readFileSync(SRC))).getPageCount();
  check('plain PDF: pages untouched', pages === before, `${before} → ${pages}`);
}

// --- case 2: THE case — Info and XMP disagree --------------------------------
{
  const doc = await PDFDocument.load(fs.readFileSync(SRC), { ignoreEncryption: true, updateMetadata: false });
  doc.setTitle('OLD INFO TITLE');
  doc.setAuthor('old.info.author');
  const xml = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">STALE XMP TITLE</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>stale.xmp.author</rdf:li></rdf:Seq></dc:creator><xmpRights:Marked>True</xmpRights:Marked></rdf:Description></rdf:RDF></x:xpacket>`;
  const raw = Buffer.from(xml, 'utf8');
  const dict = doc.context.obj({ Type: 'Metadata', Subtype: 'XML', Length: raw.length });
  const ref = doc.context.register(PDFRawStream.of(dict, new Uint8Array(raw)));
  doc.catalog.set(PDFName.of('Metadata'), ref);
  const conflicted = await doc.save({ useObjectStreams: true, updateMetadata: false });

  const beforeRead = await readBack(conflicted);
  check('setup: the fixture really does disagree with itself',
    beforeRead.info.title === 'OLD INFO TITLE' && beforeRead.xmp.includes('STALE XMP TITLE'));

  const out = await write(conflicted, VALUES);
  const back = await readBack(out);
  check('conflicted: Info updated', back.info.title === VALUES.title, back.info.title);
  check('conflicted: XMP no longer holds the stale title', !back.xmp.includes('STALE XMP TITLE'));
  check('conflicted: XMP no longer holds the stale author', !back.xmp.includes('stale.xmp.author'));
  check('conflicted: XMP now carries the new title', back.xmp.includes('Quarterly Report'));
  check('conflicted: XMP now carries both authors',
    back.xmp.includes('Ada Lovelace') && back.xmp.includes('Grace Hopper'));
  check('conflicted: unrelated XMP survived (xmpRights:Marked)', back.xmp.includes('xmpRights:Marked'));
  check('conflicted: special characters escaped, not injected',
    back.xmp.includes('Q3 &amp; &quot;final&quot;'), back.xmp.match(/<dc:title>[\s\S]{0,120}/)?.[0]);
  check('conflicted: XMP is still well-formed enough to parse',
    (back.xmp.match(/<rdf:Description/g) || []).length === (back.xmp.match(/<\/rdf:Description>/g) || []).length);
}

// --- case 3: clearing every field --------------------------------------------
{
  const out = await write(fs.readFileSync(SRC), { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' });
  const back = await readBack(out);
  check('cleared: title is empty', !back.info.title, JSON.stringify(back.info.title));
  check('cleared: author is empty', !back.info.author, JSON.stringify(back.info.author));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
