import { PDFDocument, degrees } from 'pdf-lib';
import { toU8, type Bytes } from './types.js';
import { parsePageSelection, PdfError } from './pages.js';

/** A selection of pages: a spec string ("1-3, 7"), or explicit 1-based numbers. */
export type PageSelection = string | number[];

export type PdfInfo = {
  pages: number;
  /** Page sizes in PDF points, in document order. */
  sizes: { width: number; height: number }[];
  title?: string;
  author?: string;
  producer?: string;
};

export type RotateOptions = {
  /** Which pages to turn. Defaults to all of them. */
  pages?: PageSelection;
  /** Clockwise degrees; must be a multiple of 90. Negative turns anticlockwise. */
  degrees: number;
};

const SAVE = { useObjectStreams: true } as const;

async function load(bytes: Bytes, what = 'PDF'): Promise<PDFDocument> {
  try {
    // ignoreEncryption lets us read files that merely declare an owner password.
    // A file with a real *user* password fails below, and says which.
    return await PDFDocument.load(toU8(bytes), { ignoreEncryption: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/encrypt/i.test(msg)) {
      throw new PdfError('encrypted', `That ${what} is password-protected. Unlock it before processing.`);
    }
    throw new PdfError('bad-input', `That ${what} could not be read as a PDF.`);
  }
}

function resolve(sel: PageSelection | undefined, pageCount: number): number[] {
  if (sel === undefined) return Array.from({ length: pageCount }, (_, i) => i);
  if (typeof sel === 'string') return parsePageSelection(sel, pageCount);
  if (!Array.isArray(sel) || sel.length === 0) {
    throw new PdfError('bad-selection', 'Give at least one page.');
  }
  const out = new Set<number>();
  for (const n of sel) {
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      throw new PdfError('bad-selection', `Page ${n} is outside this ${pageCount}-page document.`);
    }
    out.add(n - 1);
  }
  return [...out].sort((a, b) => a - b);
}

/** Read a document without changing it. Cheap; use it to drive your own UI. */
export async function info(bytes: Bytes): Promise<PdfInfo> {
  const doc = await load(bytes);
  return {
    pages: doc.getPageCount(),
    sizes: doc.getPages().map((p) => {
      const { width, height } = p.getSize();
      return { width, height };
    }),
    title: doc.getTitle() || undefined,
    author: doc.getAuthor() || undefined,
    producer: doc.getProducer() || undefined,
  };
}

/**
 * Join documents in the order given.
 *
 * Bookmarks and form fields are not carried across — pdf-lib copies pages, not
 * the document-level structures that point at them, and a half-copied outline
 * is worse than none. If you need those preserved, this is not the right tool
 * and we would rather say so than surprise you.
 */
export async function merge(files: Bytes[]): Promise<Uint8Array> {
  if (!Array.isArray(files) || files.length === 0) {
    throw new PdfError('bad-input', 'Give at least one PDF to merge.');
  }
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i += 1) {
    const src = await load(files[i], `PDF #${i + 1}`);
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const p of copied) out.addPage(p);
  }
  if (out.getPageCount() === 0) throw new PdfError('empty-result', 'The merged document has no pages.');
  return out.save(SAVE);
}

/** Keep only the pages selected, in the order the document has them. */
export async function extractPages(bytes: Bytes, pages: PageSelection): Promise<Uint8Array> {
  const src = await load(bytes);
  const idx = resolve(pages, src.getPageCount());
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, idx);
  for (const p of copied) out.addPage(p);
  return out.save(SAVE);
}

/** Drop the pages selected. Removing every page is an error, not an empty file. */
export async function deletePages(bytes: Bytes, pages: PageSelection): Promise<Uint8Array> {
  const src = await load(bytes);
  const count = src.getPageCount();
  const drop = new Set(resolve(pages, count));
  const keep = Array.from({ length: count }, (_, i) => i).filter((i) => !drop.has(i));
  if (keep.length === 0) {
    throw new PdfError('empty-result', 'That would delete every page. A PDF needs at least one.');
  }
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, keep);
  for (const p of copied) out.addPage(p);
  return out.save(SAVE);
}

/** Turn pages. Rotation is relative to whatever the page already had. */
export async function rotate(bytes: Bytes, opts: RotateOptions): Promise<Uint8Array> {
  const { degrees: deg } = opts;
  if (!Number.isInteger(deg) || deg % 90 !== 0) {
    throw new PdfError('bad-input', 'Rotation must be a whole multiple of 90 degrees.');
  }
  const doc = await load(bytes);
  const idx = resolve(opts.pages, doc.getPageCount());
  const pages = doc.getPages();
  for (const i of idx) {
    const page = pages[i];
    // Normalise into 0–359 so a caller passing -90 or 450 gets what they meant.
    const next = (((page.getRotation().angle + deg) % 360) + 360) % 360;
    page.setRotation(degrees(next));
  }
  return doc.save(SAVE);
}

/**
 * Strip document metadata — title, author, subject, keywords, producer, creator
 * and the timestamps.
 *
 * This clears the standard information dictionary. It does not rewrite content
 * streams, so text that is visible on the page stays visible: if you need
 * something *removed from the page*, that is redaction, and it is a different
 * and much more careful operation than this one.
 */
export async function removeMetadata(bytes: Bytes): Promise<Uint8Array> {
  const doc = await load(bytes);
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('');
  doc.setCreator('');
  const epoch = new Date(0);
  doc.setCreationDate(epoch);
  doc.setModificationDate(epoch);
  return doc.save(SAVE);
}

/** Cut into fixed-size chunks — `splitEvery(bytes, 1)` gives one file per page. */
export async function splitEvery(bytes: Bytes, pagesPerFile: number): Promise<Uint8Array[]> {
  if (!Number.isInteger(pagesPerFile) || pagesPerFile < 1) {
    throw new PdfError('bad-input', 'pagesPerFile must be 1 or more.');
  }
  const src = await load(bytes);
  const count = src.getPageCount();
  const out: Uint8Array[] = [];
  for (let start = 0; start < count; start += pagesPerFile) {
    const idx = Array.from({ length: Math.min(pagesPerFile, count - start) }, (_, k) => start + k);
    const doc = await PDFDocument.create();
    const copied = await doc.copyPages(src, idx);
    for (const p of copied) doc.addPage(p);
    out.push(await doc.save(SAVE));
  }
  return out;
}
