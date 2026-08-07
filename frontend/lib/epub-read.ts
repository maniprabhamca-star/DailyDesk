'use client';

// EPUB → readable blocks. The reverse trip of lib/epub-core.ts.
//
// An EPUB is a zip of XHTML in a reading order the book itself declares, so the
// job is: find the package file the container points at, follow the spine (NOT
// the file names — a book's chapters are rarely in alphabetical order), and turn
// each chapter's markup into headings, paragraphs and list items. From there the
// existing writers make a PDF, a Word file or plain text.

import type { PdfBlock } from './ai-export';

export type EpubDoc = {
  title: string;
  author: string;
  language: string;
  chapters: { title: string; blocks: PdfBlock[] }[];
  words: number;
};

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Walk the rendered markup in document order and emit our block model. */
function blocksFrom(doc: Document): PdfBlock[] {
  const body = doc.body || doc.documentElement;
  if (!body) return [];
  body.querySelectorAll('script,style,nav[epub\\:type="toc"],svg').forEach((el) => el.remove());

  const out: PdfBlock[] = [];
  const seen = new Set<Element>();
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (seen.has(child)) continue;
      const tag = child.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = clean(child.textContent || '');
        if (text) { out.push({ type: tag === 'h1' ? 'h1' : 'h2', text }); seen.add(child); }
        continue;
      }
      if (tag === 'p' || tag === 'blockquote') {
        const text = clean(child.textContent || '');
        if (text) { out.push({ type: tag === 'blockquote' ? 'note' : 'p', text }); seen.add(child); }
        continue;
      }
      if (tag === 'li') {
        const text = clean(child.textContent || '');
        if (text) { out.push({ type: 'li', text }); seen.add(child); }
        continue;
      }
      if (tag === 'table') {
        // A table in a reflowable book is usually small; each row reads as a line.
        for (const row of Array.from(child.querySelectorAll('tr'))) {
          const cells = Array.from(row.children).map((c) => clean(c.textContent || '')).filter(Boolean);
          if (cells.length) out.push({ type: 'p', text: cells.join(' · ') });
        }
        seen.add(child);
        continue;
      }
      walk(child);
    }
  };
  walk(body);

  // A chapter that is one big <div> of bare text still has to come through.
  if (!out.length) {
    const text = clean(body.textContent || '');
    if (text) out.push({ type: 'p', text });
  }
  return out;
}

const countWords = (blocks: PdfBlock[]) =>
  blocks.reduce((n, b) => n + ('text' in b ? (b.text.match(/\S+/g) || []).length : 0), 0);

export async function readEpub(file: File | Blob): Promise<EpubDoc> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();

  const text = async (path: string) => {
    const f = zip.file(path.replace(/^\//, ''));
    return f ? f.async('string') : null;
  };

  // 1. The container names the package document; its location is not fixed.
  const containerXml = await text('META-INF/container.xml');
  if (!containerXml) throw new Error('That doesn’t look like an EPUB — there’s no META-INF/container.xml inside it.');
  const container = parser.parseFromString(containerXml, 'application/xml');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('This EPUB doesn’t say where its package file is, so there’s no reading order to follow.');

  const opfXml = await text(opfPath);
  if (!opfXml) throw new Error('This EPUB’s package file is missing.');
  const opf = parser.parseFromString(opfXml, 'application/xml');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const metaText = (tag: string) => clean(opf.getElementsByTagName(`dc:${tag}`)[0]?.textContent
    || Array.from(opf.getElementsByTagName('*')).find((e) => e.localName === tag)?.textContent || '');

  // 2. id → href, then the spine gives the ORDER a reader would follow.
  const hrefById = new Map<string, string>();
  for (const item of Array.from(opf.getElementsByTagName('item'))) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const type = item.getAttribute('media-type') || '';
    if (id && href && /xhtml|html/.test(type)) hrefById.set(id, href);
  }
  const spine = Array.from(opf.getElementsByTagName('itemref'))
    .map((r) => hrefById.get(r.getAttribute('idref') || ''))
    .filter((h): h is string => !!h);

  const hrefs = spine.length
    ? spine
    : Object.keys(zip.files).filter((p) => /\.x?html?$/i.test(p)).sort().map((p) => p.replace(base, ''));

  const chapters: EpubDoc['chapters'] = [];
  for (const href of hrefs) {
    const path = decodeURIComponent(base + href.split('#')[0]);
    const raw = (await text(path)) ?? (await text(href.split('#')[0]));
    if (!raw) continue;
    const doc = parser.parseFromString(raw, 'application/xhtml+xml');
    // A book with one malformed chapter shouldn't fail entirely — retry as HTML.
    const usable = doc.querySelector('parsererror') ? parser.parseFromString(raw, 'text/html') : doc;
    const blocks = blocksFrom(usable);
    if (!blocks.length) continue;
    const heading = blocks.find((b) => b.type === 'h1' || b.type === 'h2');
    const title = heading && 'text' in heading ? heading.text.slice(0, 80) : `Section ${chapters.length + 1}`;
    chapters.push({ title, blocks });
  }

  if (!chapters.length) throw new Error('No readable text in that EPUB. If it’s a comic or a fixed-layout book, the pages are images rather than text.');

  return {
    title: metaText('title') || 'Untitled',
    author: metaText('creator'),
    language: metaText('language') || 'en',
    chapters,
    words: chapters.reduce((n, c) => n + countWords(c.blocks), 0),
  };
}

/** Flatten to one block list, with a page break between chapters for the PDF. */
export function flattenChapters(doc: EpubDoc, pageBreaks = true): PdfBlock[] {
  const out: PdfBlock[] = [];
  doc.chapters.forEach((c, i) => {
    if (i && pageBreaks) out.push({ type: 'pagebreak' });
    out.push(...c.blocks);
  });
  return out;
}

/** Plain text, with blank lines where the structure was. */
export function blocksToText(blocks: PdfBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === 'pagebreak') { lines.push('', '—'.repeat(10), ''); continue; }
    if (b.type === 'li') lines.push(`  • ${b.text}`);
    else lines.push(b.text);
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
