'use client';

// On-device PDF → EPUB. A PDF is a fixed page; an EPUB is a river of text that
// reflows to whatever screen it lands on. So this isn't a re-wrap — the layout
// has to be read back into structure (headings, lists, tables, chapters) and
// the page's furniture (running heads, page numbers, hyphens at the line edge)
// has to be thrown away, or the book reads like a photocopy.
//
// Text comes from pdf.js via the same layout model the Markdown tool uses, so
// the two tools can never disagree about what a page says. Everything runs in
// the browser: the file is never uploaded.

import { getPdfjs, openPdf } from './pdf-render';
import { pageToItems } from './pdf-markdown';
import { pdfItemsToMarkdown, type MItem } from './pdf-markdown-core';
import { renderMarkdown } from './md-render';
import {
  buildEpubFiles, dehyphenate, imageToken, replaceImageTokens, splitByHeadings, splitByOutline, splitByPages,
  stitchPages, stripRunningHeads,
  type EpubChapter, type EpubImage, type MdChapter,
} from './epub-core';
import { capImages, dropRepeatedImages, imagesOnPage, type ImageCache, type PageImage } from './pdf-page-images';

export type ChapterMode = 'auto' | 'outline' | 'headings' | 'pages' | 'single';

export type EpubOptions = {
  title: string;
  author: string;
  language: string;
  headings: boolean;
  tables: boolean;
  cleanUp: boolean; // de-hyphenate + drop running heads/page numbers
  cover: boolean;
  images: boolean; // carry the pictures inside the book across
  chapters: ChapterMode;
  pagesPer: number;
};

export type EpubResult = {
  blob: Blob;
  name: string;
  chapters: { title: string; words: number }[];
  words: number;
  numPages: number;
  hasText: boolean;
  splitBy: 'outline' | 'headings' | 'pages' | 'single';
  coverIncluded: boolean;
  imagesIncluded: number;
};

export const DEFAULT_EPUB_OPTIONS: Omit<EpubOptions, 'title' | 'author'> = {
  language: 'en',
  headings: true,
  tables: true,
  cleanUp: true,
  cover: true,
  images: true,
  chapters: 'auto',
  pagesPer: 20,
};

const countWords = (md: string) => (md.trim().match(/\S+/g) || []).length;

/** Top-level bookmarks → page indices. Bookmarks are the best chapter source
 *  there is: a person chose those divisions. Resolving a destination can fail on
 *  damaged files, so each one is guarded and simply dropped on failure. */
async function outlineMarks(doc: {
  getOutline: () => Promise<unknown>;
  getDestination: (d: string) => Promise<unknown>;
  getPageIndex: (ref: unknown) => Promise<number>;
}): Promise<Array<{ title: string; page: number }>> {
  let items: Array<{ title?: string; dest?: unknown; items?: unknown[] }> = [];
  try {
    items = ((await doc.getOutline()) as typeof items) || [];
  } catch { return []; }
  // A single top-level bookmark ("Contents") hides the real chapters one level
  // down — step into it rather than giving up on the outline.
  if (items.length === 1 && Array.isArray(items[0]?.items) && items[0].items.length > 1) {
    items = items[0].items as typeof items;
  }
  const out: Array<{ title: string; page: number }> = [];
  for (const it of items) {
    try {
      const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
      const ref = Array.isArray(dest) ? dest[0] : null;
      if (!ref) continue;
      const page = await doc.getPageIndex(ref);
      if (Number.isInteger(page)) out.push({ title: String(it.title ?? '').trim(), page });
    } catch { /* unresolvable bookmark — skip it, keep the rest */ }
  }
  return out;
}

/** Render page 1 as the book's cover, so it looks like a book in a library
 *  instead of a grey placeholder. Drawn straight to a canvas — we never hand out
 *  a blob URL here, so nothing can be revoked out from under the caller. */
async function renderCover(
  handle: { doc: { getPage: (n: number) => Promise<PdfjsPage> } },
): Promise<{ data: Uint8Array; mime: string; ext: string } | null> {
  try {
    const page = await handle.doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1400 / Math.max(base.width, base.height), 3);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // intent:'print' for the same reason as lib/pdf-render: the default paces on
    // requestAnimationFrame, which never fires in a hidden or background tab —
    // switch tabs mid-convert and the cover would never finish.
    const task = page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' });
    // A cover is a nicety. If a page renders pathologically slowly (huge vector
    // art, a broken font) the book still ships — it just ships without one.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'slow'>((res) => { timer = setTimeout(() => res('slow'), 20_000); });
    const outcome = await Promise.race([task.promise.then(() => 'ok' as const), timeout]);
    clearTimeout(timer);
    if (outcome === 'slow') { task.cancel?.(); return null; }
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg', ext: 'jpg' };
  } catch {
    return null; // a cover is a nicety — never fail the conversion over it
  }
}

type PdfjsPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: unknown) => { promise: Promise<void>; cancel?: () => void };
};

/** Everything read off the PDF once. Re-reading a 300-page file every time a
 *  toggle flips would be unusable, so the slow pdf.js pass happens once and the
 *  assembly below is pure and instant. */
export type EpubSource = {
  pageItems: MItem[][];
  marks: Array<{ title: string; page: number }>;
  cover: { data: Uint8Array; mime: string; ext: string } | null;
  /** Pictures found inside the book, in reading order, already de-duplicated
   *  against page furniture and capped. Index into this array IS the token id. */
  images: PageImage[];
  imagesDropped: number;
  numPages: number;
  hasText: boolean;
  title: string;
  author: string;
  fileName: string;
};

export async function extractForEpub(
  file: File,
  onProgress?: (fraction: number, label: string) => void,
  signal?: AbortSignal,
): Promise<EpubSource> {
  const bail = () => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  bail();
  const handle = await openPdf(file);
  const pageItems: MItem[][] = [];
  const rawImages: PageImage[] = [];
  let marks: Array<{ title: string; page: number }> = [];
  let cover: Awaited<ReturnType<typeof renderCover>> = null;
  let title = '';
  let author = '';
  try {
    try {
      const md = (await (handle.doc as unknown as { getMetadata: () => Promise<{ info?: Record<string, unknown> }> }).getMetadata()) || {};
      title = String(md.info?.Title ?? '').trim();
      author = String(md.info?.Author ?? '').trim();
    } catch { /* no Info dictionary — the filename stands in */ }

    // Cover first, while page one is untouched: reading the text calls pdf.js's
    // per-page cleanup(), and rendering a cleaned-up page never resolves.
    onProgress?.(0.02, 'Making the cover');
    cover = await renderCover(handle as never);

    const { OPS } = await getPdfjs();
    const imageCache: ImageCache = new Map();
    for (let i = 0; i < handle.numPages; i++) {
      bail();
      const page = await handle.doc.getPage(i + 1);
      pageItems.push(await pageToItems(page));
      // Pictures must come off the page BEFORE cleanup() — that's when pdf.js
      // drops the decoded image objects.
      rawImages.push(...(await imagesOnPage(page, i, OPS as unknown as Record<string, number>, imageCache)));
      (page as unknown as { cleanup?: () => void }).cleanup?.();
      onProgress?.(((i + 1) / handle.numPages) * 0.9, `Reading page ${i + 1} of ${handle.numPages}`);
    }
    marks = await outlineMarks(handle.doc as never);
  } finally {
    await handle.destroy();
  }

  const { kept, dropped } = capImages(dropRepeatedImages(rawImages, pageItems.length));
  return {
    pageItems,
    marks,
    cover,
    images: kept,
    imagesDropped: dropped,
    numPages: pageItems.length,
    hasText: pageItems.some((p) => p.some((it) => it.s.trim())),
    title,
    author,
    fileName: file.name,
  };
}

export async function pdfToEpub(
  file: File,
  opts: EpubOptions,
  onProgress?: (fraction: number, label: string) => void,
  signal?: AbortSignal,
): Promise<EpubResult> {
  return assembleEpub(await extractForEpub(file, onProgress, signal), opts);
}

/** The pure half: layout model + options → chapters. Instant, so the preview
 *  can update as the reader changes their mind. */
export function planEpub(src: EpubSource, opts: EpubOptions): { chapters: MdChapter[]; splitBy: EpubResult['splitBy'] } {
  const pageItems = opts.cleanUp ? stripRunningHeads(src.pageItems) : src.pageItems;
  const pageMd = pageItems.map((items, pageIndex) => {
    const md = pdfItemsToMarkdown([items], { headings: opts.headings, tables: opts.tables });
    if (!opts.images) return md;
    // Pictures ride along as tokens at the end of the page they were drawn on —
    // that's the only page-accurate anchor left once the text is reflowed.
    const marks = src.images
      .map((im, i) => (im.page === pageIndex ? imageToken(i) : ''))
      .filter(Boolean);
    return marks.length ? `${md}\n\n${marks.join('\n\n')}` : md;
  });

  // Chapters: bookmarks first (a human chose them), then the document's own
  // headings, then a fixed page split so a long book never becomes one huge file.
  let chapters: MdChapter[] | null = null;
  let splitBy: EpubResult['splitBy'] = 'single';
  const wantOutline = opts.chapters === 'auto' || opts.chapters === 'outline';
  const wantHeadings = opts.chapters === 'auto' || opts.chapters === 'headings';

  if (wantOutline) {
    chapters = splitByOutline(pageMd, src.marks);
    if (chapters) splitBy = 'outline';
  }
  if (!chapters && wantHeadings) {
    chapters = splitByHeadings(stitchPages(pageMd), opts.title || 'Start');
    if (chapters) splitBy = 'headings';
  }
  if (!chapters && opts.chapters === 'pages') {
    chapters = splitByPages(pageMd, Math.max(1, opts.pagesPer));
    splitBy = 'pages';
  }
  if (!chapters) {
    const all = stitchPages(pageMd);
    // Even in "single" mode, a very long document is split so e-readers stay
    // responsive — one 300-page XHTML file makes cheap hardware crawl.
    if (opts.chapters !== 'single' && pageMd.length > 40) {
      chapters = splitByPages(pageMd, Math.max(1, opts.pagesPer));
      splitBy = 'pages';
    } else {
      chapters = [{ title: opts.title || 'Document', md: all }];
      splitBy = 'single';
    }
  }

  // De-hyphenate LAST, once the pages are stitched: a word is just as likely to
  // be broken across a page turn as across a line, and only the joined text
  // shows both halves.
  if (opts.cleanUp) chapters = chapters.map((c) => ({ ...c, md: dehyphenate(c.md) }));

  return { chapters, splitBy };
}

/** The packing half: chapters → a real .epub file. */
export async function assembleEpub(src: EpubSource, opts: EpubOptions): Promise<EpubResult> {
  const { chapters, splitBy } = planEpub(src, opts);
  const cover = opts.cover ? src.cover : null;
  const stem = src.fileName.replace(/\.pdf$/i, '');

  // Only the pictures a chapter actually references get packed — a token that
  // fell out with its page must not leave a file behind in the manifest.
  // Keyed by the picture's fingerprint, not its position: the same figure drawn
  // on two pages is packed once and referenced twice.
  const used = new Map<string, EpubImage>();
  const fileFor = (n: number) => {
    const im = src.images[n];
    if (!opts.images || !im) return null;
    const existing = used.get(im.fp);
    if (existing) return existing.file;
    const file = `img-${String(used.size + 1).padStart(3, '0')}.${im.ext}`;
    used.set(im.fp, { file, data: im.data, mime: im.mime });
    return file;
  };
  const epubChapters: EpubChapter[] = chapters.map((c) => ({
    title: c.title,
    html: replaceImageTokens(renderMarkdown(c.md), fileFor),
  }));

  const files = buildEpubFiles(
    {
      title: opts.title || stem,
      author: opts.author || 'Unknown',
      language: opts.language || 'en',
      identifier: `urn:uuid:${newUuid()}`,
      modified: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    },
    epubChapters,
    cover ?? undefined,
    Array.from(used.values()),
  );

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.path, f.data, f.store ? { compression: 'STORE' } : { compression: 'DEFLATE' });
  }
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });

  return {
    blob,
    name: `${stem}.epub`,
    chapters: chapters.map((c) => ({ title: c.title, words: countWords(c.md) })),
    words: chapters.reduce((n, c) => n + countWords(c.md), 0),
    numPages: src.numPages,
    hasText: src.hasText,
    splitBy,
    coverIncluded: !!cover,
    imagesIncluded: used.size,
  };
}

function newUuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c?.getRandomValues?.(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  let hex = '';
  b.forEach((n) => { hex += n.toString(16).padStart(2, '0'); });
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
