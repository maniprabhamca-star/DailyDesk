/**
 * Reading and rewriting a PDF's document information — title, author, subject,
 * keywords and the two application fields.
 *
 * The subtlety that makes most "edit PDF metadata" tools quietly useless: a PDF
 * can carry the same facts twice. There is the old Info dictionary in the
 * trailer, and there is an XMP packet hanging off the catalogue. When both are
 * present, Acrobat and most modern readers believe XMP. So a tool that writes
 * only the Info dictionary appears to work — the bytes really did change — and
 * then the reader still shows the old author, because it never looked there.
 *
 * We write both. Where XMP exists we strip the properties we are responsible
 * for out of it and append one authoritative rdf:Description carrying the new
 * values, which keeps whatever else the packet held (rights, ICC intent, an
 * editing history) intact.
 */

export type DocInfo = {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  /** ISO yyyy-mm-dd, or '' when the field is absent. Time of day is dropped —
   *  nobody edits a PDF because the minute was wrong. */
  created: string;
  modified: string;
};

export const EMPTY_DOCINFO: DocInfo = {
  title: '', author: '', subject: '', keywords: '', creator: '', producer: '', created: '', modified: '',
};

/** What we found in the file, plus whether an XMP packet is also present — the
 *  UI says so, because it explains why some readers disagree with others. */
export type DocInfoRead = {
  info: DocInfo;
  hasXmp: boolean;
  /** Fields where the Info dictionary and XMP currently disagree. Worth showing:
   *  it is usually the reason someone came here in the first place. */
  conflicts: string[];
  pages: number;
};

function isoFromPdfDate(v: string): string {
  // D:YYYYMMDDHHmmSS±HH'mm' — only the date part survives the round trip.
  const m = v.match(/^D?:?(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function dateFromIso(iso: string): Date | undefined {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Pull the text out of an XMP property, whether it is a bare element, an
 *  rdf:Alt (dc:title, dc:description) or an rdf:Seq (dc:creator). */
function xmpValue(xml: string, tag: string): string {
  const block = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!block) {
    const bare = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?/>`));
    return bare ? '' : '';
  }
  const inner = block[1];
  const li: string[] = [];
  const liRe = /<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/g;
  for (let m = liRe.exec(inner); m; m = liRe.exec(inner)) li.push(m[1].trim());
  const raw = li.length ? li.join(', ') : inner.trim();
  return decodeXml(raw.replace(/<[^>]+>/g, '').trim());
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function encodeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The properties this tool owns. Anything else in the packet is left alone. */
const OWNED = ['dc:title', 'dc:creator', 'dc:description', 'dc:subject', 'pdf:Keywords', 'xmp:CreatorTool', 'pdf:Producer'];

function stripOwned(xml: string): string {
  let out = xml;
  for (const tag of OWNED) {
    out = out.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>\\s*`, 'g'), '');
    out = out.replace(new RegExp(`<${tag}(?:\\s[^>]*)?/>\\s*`, 'g'), '');
  }
  return out;
}

function buildDescription(v: DocInfo): string {
  const parts: string[] = [];
  if (v.title) parts.push(`<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${encodeXml(v.title)}</rdf:li></rdf:Alt></dc:title>`);
  if (v.author) parts.push(`<dc:creator><rdf:Seq>${v.author.split(/\s*;\s*/).filter(Boolean).map((a) => `<rdf:li>${encodeXml(a)}</rdf:li>`).join('')}</rdf:Seq></dc:creator>`);
  if (v.subject) parts.push(`<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${encodeXml(v.subject)}</rdf:li></rdf:Alt></dc:description>`);
  if (v.keywords) {
    // Both forms, because readers disagree about which one keywords live in:
    // pdf:Keywords is the flat string, dc:subject the structured bag.
    parts.push(`<pdf:Keywords>${encodeXml(v.keywords)}</pdf:Keywords>`);
    const kws = v.keywords.split(/\s*,\s*/).filter(Boolean);
    if (kws.length) parts.push(`<dc:subject><rdf:Bag>${kws.map((k) => `<rdf:li>${encodeXml(k)}</rdf:li>`).join('')}</rdf:Bag></dc:subject>`);
  }
  if (v.creator) parts.push(`<xmp:CreatorTool>${encodeXml(v.creator)}</xmp:CreatorTool>`);
  if (v.producer) parts.push(`<pdf:Producer>${encodeXml(v.producer)}</pdf:Producer>`);
  if (!parts.length) return '';
  return (
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"` +
    ` xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">` +
    parts.join('') +
    `</rdf:Description>`
  );
}

/** Rewrite an XMP packet so it agrees with the values we just wrote to Info. */
function patchXmp(xml: string, v: DocInfo): string {
  const stripped = stripOwned(xml);
  const desc = buildDescription(v);
  if (!desc) return stripped;
  const close = stripped.lastIndexOf('</rdf:RDF>');
  if (close === -1) return stripped; // not RDF we recognise — leave it stripped
  return stripped.slice(0, close) + desc + stripped.slice(close);
}

async function xmpOf(doc: any): Promise<{ xml: string; ref: any } | null> {
  const { PDFName, PDFRawStream } = await import('pdf-lib');
  const ref = doc.catalog.get(PDFName.of('Metadata'));
  if (!ref) return null;
  const stream = doc.context.lookup(ref);
  if (!(stream instanceof PDFRawStream)) return null;
  try {
    return { xml: new TextDecoder('utf-8').decode(stream.contents as Uint8Array), ref };
  } catch {
    return null;
  }
}

export async function readDocInfo(bytes: ArrayBuffer | Uint8Array): Promise<DocInfoRead> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes as any, { ignoreEncryption: true, updateMetadata: false });

  const info: DocInfo = {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() as unknown as string) ?? '',
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
    created: '',
    modified: '',
  };
  try { const d = doc.getCreationDate(); if (d) info.created = isoFromPdfDate(`D:${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`); } catch { /* absent or unparseable */ }
  try { const d = doc.getModificationDate(); if (d) info.modified = isoFromPdfDate(`D:${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`); } catch { /* absent or unparseable */ }

  const xmp = await xmpOf(doc);
  const conflicts: string[] = [];
  if (xmp) {
    const pairs: Array<[string, string, string]> = [
      ['Title', 'dc:title', info.title],
      ['Author', 'dc:creator', info.author],
      ['Subject', 'dc:description', info.subject],
      ['Keywords', 'pdf:Keywords', info.keywords],
    ];
    for (const [label, tag, infoVal] of pairs) {
      const x = xmpValue(xmp.xml, tag);
      if (x && infoVal && x.trim() !== infoVal.trim()) conflicts.push(label);
      // XMP carrying a value the Info dictionary lacks is the same trap: the
      // reader shows something the user cannot find anywhere in Info.
      if (x && !infoVal) conflicts.push(label);
    }
  }

  return { info, hasXmp: !!xmp, conflicts, pages: doc.getPageCount() };
}

export async function writeDocInfo(bytes: ArrayBuffer | Uint8Array, v: DocInfo): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFRawStream, PDFNumber } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes as any, { ignoreEncryption: true, updateMetadata: false });

  // pdf-lib has no "unset" — writing '' leaves an empty entry, which is both
  // honest (the field exists and is blank) and what the user asked for.
  doc.setTitle(v.title);
  doc.setAuthor(v.author);
  doc.setSubject(v.subject);
  // One element, not one per keyword: pdf-lib joins the array with spaces, so
  // splitting here would silently turn "tax, 2026" into "tax 2026" and the
  // user's commas would vanish on the next read.
  doc.setKeywords(v.keywords ? [v.keywords] : []);
  doc.setCreator(v.creator);
  doc.setProducer(v.producer);
  const c = dateFromIso(v.created);
  const m = dateFromIso(v.modified);
  if (c) doc.setCreationDate(c);
  if (m) doc.setModificationDate(m);

  const xmp = await xmpOf(doc);
  if (xmp) {
    const patched = patchXmp(xmp.xml, v);
    const raw = new TextEncoder().encode(patched);
    const old = doc.context.lookup(xmp.ref) as any;
    const dict = old.dict;
    dict.set(PDFName.of('Length'), PDFNumber.of(raw.length));
    doc.context.assign(xmp.ref as any, PDFRawStream.of(dict, raw));
  }

  // No updateMetadata here: it is a LOAD option, not a save one. Loading with
  // it false is what stops pdf-lib stamping its own Producer and ModDate over
  // the values the user just typed — passing it to save() only looks like it
  // helps. The harness asserts the Producer survives, which is the proof.
  return doc.save({ useObjectStreams: true });
}
