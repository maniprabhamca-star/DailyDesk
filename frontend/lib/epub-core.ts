// Pure EPUB 3 assembly — no DOM, no pdf.js, no zip library. Given chapters of
// XHTML it returns the exact file list an .epub archive contains, so the whole
// format can be unit-tested in Node while the browser side only has to zip it.
//
// We emit EPUB 3 (nav.xhtml) AND an EPUB 2 NCX table of contents: Kindle's
// converter and older Kobo/Sony firmware still read the NCX, and shipping both
// costs a few hundred bytes.

import type { MItem } from './pdf-markdown-core';

export type EpubMeta = {
  title: string;
  author: string;
  language: string; // BCP-47, e.g. "en"
  identifier: string; // urn:uuid:…
  modified: string; // ISO, seconds precision, Z — required by EPUB 3
};

export type EpubChapter = { title: string; html: string };

export type EpubImage = { file: string; data: Uint8Array; mime: string };

/** A picture's place in the text is marked with a token while the book is still
 *  Markdown, so it survives stitching, chapter splitting and rendering. The
 *  token becomes a real <figure> at the very end. */
export const imageToken = (n: number) => `[[dd-img-${n}]]`;
const TOKEN_HTML = /<p>\s*\[\[dd-img-(\d+)\]\]\s*<\/p>/g;

/** Swap the tokens for figures. `src` returns the href to use, or null to drop
 *  the picture (over the size cap, or the reader turned images off) — a token
 *  must never survive into the book as visible text. */
export function replaceImageTokens(html: string, src: (n: number) => string | null): string {
  return html.replace(TOKEN_HTML, (_m, n) => {
    const href = src(Number(n));
    return href ? `<figure><img src="${href}" alt=""/></figure>` : '';
  });
}

export type EpubFile = { path: string; data: string | Uint8Array; store?: boolean };

// Control characters are ILLEGAL in XML 1.0, and PDFs are full of them —
// bookmark titles in particular carry stray bytes from whatever encoded them. A
// single one makes the whole EPUB unopenable, so they're stripped before escaping.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Drop the characters XML forbids, keeping tab, newline and return. */
export const xmlSafe = (s: string): string => s.replace(CONTROL, '');

const esc = (s: string) =>
  xmlSafe(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** PDFs hyphenate at the line edge; once lines are reflowed that leaves
 *  "informa- tion" mid-sentence, which looks broken on a small screen where the
 *  break lands somewhere else entirely. Only lowercase-to-lowercase joins are
 *  touched, so "self- employed" style spacing survives but "Mid- 2024" doesn't
 *  get mangled. */
export function dehyphenate(text: string): string {
  return text.replace(LOWER_HYPHEN_LOWER, '$1$2');
}

// Lowercase letters, Latin-1 range included (the `u` flag and \p{Ll} need a
// newer compile target than this project uses).
const LOWER = 'a-zà-öø-ÿ';
const LOWER_HYPHEN_LOWER = new RegExp(`([${LOWER}])- ([${LOWER}])`, 'g');
const STARTS_LOWER = new RegExp(`^[${LOWER}]`);

/** Drop running headers, footers and page numbers.
 *
 *  A line that appears at the same edge of the page on at least half the pages
 *  is furniture, not content — in a reflowable book it turns into a stray line
 *  every few screens. Bare page numbers in the same bands go too. Documents of
 *  fewer than 4 pages are left alone: there isn't enough evidence, and a false
 *  positive there costs a real heading. */
export function stripRunningHeads(pages: MItem[][]): MItem[][] {
  if (pages.length < 4) return pages;

  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  const isNumberish = (s: string) => /^[\s|·—–-]*(?:page\s*)?\d{1,4}(?:\s*(?:\/|of)\s*\d{1,4})?[\s|·—–-]*$/i.test(s);

  // Page geometry: pdf.js y grows upward, so "top band" = high y.
  const bandsOf = (items: MItem[]) => {
    const ys = items.map((i) => i.y);
    if (!ys.length) return null;
    const top = Math.max(...ys);
    const bot = Math.min(...ys);
    const h = top - bot;
    if (h <= 0) return null;
    return { topEdge: top - h * 0.08, botEdge: bot + h * 0.08 };
  };

  const seen = new Map<string, number>();
  const perPage = pages.map((items) => {
    const b = bandsOf(items);
    if (!b) return new Set<string>();
    const edge = new Set<string>();
    items.forEach((it) => {
      if (it.y >= b.topEdge || it.y <= b.botEdge) {
        const t = norm(it.s);
        if (t) edge.add(t);
      }
    });
    edge.forEach((t) => seen.set(t, (seen.get(t) ?? 0) + 1));
    return edge;
  });

  const repeated = new Set<string>();
  seen.forEach((n, t) => { if (n >= pages.length / 2) repeated.add(t); });

  return pages.map((items, pi) => {
    const b = bandsOf(items);
    if (!b || !perPage[pi].size) return items;
    return items.filter((it) => {
      const inBand = it.y >= b.topEdge || it.y <= b.botEdge;
      if (!inBand) return true;
      const t = norm(it.s);
      if (!t) return true;
      return !(repeated.has(t) || isNumberish(t));
    });
  });
}

/** Stitch per-page Markdown back into one document, healing paragraphs that the
 *  page break cut in half — the single most visible artefact of converting a
 *  paged layout to a reflowable one. */
export function stitchPages(pageMd: string[]): string {
  let out = '';
  for (const raw of pageMd) {
    const md = raw.trim();
    if (!md) continue;
    if (!out) { out = md; continue; }
    const tail = out.slice(-1);
    const head = md[0];
    const lastLine = out.slice(out.lastIndexOf('\n') + 1);
    const firstLine = md.slice(0, md.indexOf('\n') === -1 ? undefined : md.indexOf('\n'));
    // Continue the sentence only when BOTH sides are plain prose: the previous
    // page ended mid-sentence and the next starts lowercase.
    const continues =
      !/[.!?:;”"’')\]]$/.test(tail) &&
      STARTS_LOWER.test(head) &&
      !/^[#\-*|]|^\d+[.)]/.test(firstLine) &&
      !/^#/.test(lastLine);
    out += continues ? ` ${md}` : `\n\n${md}`;
  }
  return out;
}

export type MdChapter = { title: string; md: string };

/** Split a document at its own headings. Uses the shallowest heading level that
 *  actually produces a sensible number of chapters, so a book with `#` parts and
 *  `##` sections breaks at the parts, while a report that only ever uses `##`
 *  still breaks. Text before the first heading is kept as an opening chapter
 *  rather than silently dropped. */
export function splitByHeadings(md: string, fallbackTitle: string, min = 2, max = 200): MdChapter[] | null {
  const lines = md.split('\n');
  for (const level of [1, 2]) {
    const re = new RegExp(`^#{${level}}\\s+(.+)$`);
    const hits = lines.reduce((n, l) => n + (re.test(l) ? 1 : 0), 0);
    if (hits < min || hits > max) continue;

    const chapters: MdChapter[] = [];
    let title = fallbackTitle;
    let buf: string[] = [];
    const flush = () => {
      const body = buf.join('\n').trim();
      if (body) chapters.push({ title, md: body });
      buf = [];
    };
    for (const l of lines) {
      const m = re.exec(l);
      if (m) { flush(); title = m[1].trim() || fallbackTitle; }
      buf.push(l);
    }
    flush();
    if (chapters.length >= min) return chapters;
  }
  return null;
}

/** Fixed-size fallback: one chapter per `every` pages. Keeps a 400-page scan
 *  from becoming a single XHTML file that stalls e-readers. */
export function splitByPages(pageMd: string[], every: number): MdChapter[] {
  const out: MdChapter[] = [];
  for (let i = 0; i < pageMd.length; i += every) {
    const md = stitchPages(pageMd.slice(i, i + every));
    if (!md.trim()) continue;
    const last = Math.min(i + every, pageMd.length);
    out.push({ title: last - 1 === i ? `Page ${i + 1}` : `Pages ${i + 1}–${last}`, md });
  }
  return out;
}

/** Chapters straight from the PDF's own bookmarks — the best source when the
 *  document has them, because a human chose those divisions. */
export function splitByOutline(pageMd: string[], marks: Array<{ title: string; page: number }>): MdChapter[] | null {
  const valid = marks
    .filter((m) => Number.isInteger(m.page) && m.page >= 0 && m.page < pageMd.length && m.title.trim())
    .sort((a, b) => a.page - b.page);
  if (valid.length < 2) return null;

  const out: MdChapter[] = [];
  if (valid[0].page > 0) {
    const md = stitchPages(pageMd.slice(0, valid[0].page));
    if (md.trim()) out.push({ title: 'Front matter', md });
  }
  valid.forEach((m, i) => {
    const end = i + 1 < valid.length ? valid[i + 1].page : pageMd.length;
    const md = stitchPages(pageMd.slice(m.page, end));
    if (md.trim()) out.push({ title: m.title.trim(), md });
  });
  return out.length >= 2 ? out : null;
}

const CSS = `html,body{margin:0;padding:0}
body{font-family:serif;line-height:1.5;padding:0 1em;text-align:justify;hyphens:auto}
h1,h2,h3,h4{line-height:1.25;text-align:left;page-break-after:avoid;margin:1.2em 0 .4em}
h1{font-size:1.6em}h2{font-size:1.3em}h3{font-size:1.12em}
p{margin:0 0 .75em;text-indent:0}
ul,ol{margin:.5em 0 .9em 1.2em}li{margin:.2em 0}
table{border-collapse:collapse;margin:1em 0;font-size:.9em;width:100%}
th,td{border:1px solid #999;padding:.3em .5em;text-align:left;vertical-align:top}
th{background:#eee}
img{max-width:100%;height:auto}
figure{margin:1em 0;text-align:center}
.cover{margin:0;padding:0;text-align:center}
.cover img{max-height:100%}`;

// Right-to-left books need the mirrored versions of everything the sheet above
// pins to the left edge. Appended only for RTL languages so LTR books keep the
// plain, maximally-compatible rules.
const CSS_RTL = `
body{direction:rtl}
h1,h2,h3,h4{text-align:right}
th,td{text-align:right}
ul,ol{margin:.5em 1.2em .9em 0}`;

/** Languages written right-to-left. An EPUB in one of these needs `dir="rtl"`
 *  on the document and `page-progression-direction="rtl"` on the spine, or the
 *  reader lays the text out left-to-right and pages the book the wrong way —
 *  the text is there but the book is unreadable. */
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ku', 'ckb']);
export const isRtl = (lang: string): boolean => RTL.has(String(lang).toLowerCase().split('-')[0]);

const chapterDoc = (lang: string, title: string, body: string) => {
  const dir = isRtl(lang) ? ' dir="rtl"' : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(lang)}" lang="${esc(lang)}"${dir}>
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body${dir}>
${xmlSafe(body)}
</body>
</html>`;
};

const chapterHref = (i: number) => `chapter-${String(i + 1).padStart(3, '0')}.xhtml`;

/** Everything an .epub contains, in archive order. `mimetype` MUST be first and
 *  stored uncompressed — readers sniff it at a fixed byte offset. */
export function buildEpubFiles(
  meta: EpubMeta,
  chapters: EpubChapter[],
  cover?: { data: Uint8Array; mime: string; ext: string },
  images: EpubImage[] = [],
): EpubFile[] {
  const chs = chapters.length ? chapters : [{ title: meta.title, html: '<p></p>' }];
  const files: EpubFile[] = [
    { path: 'mimetype', data: 'application/epub+zip', store: true },
    {
      path: 'META-INF/container.xml',
      data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    },
    { path: 'OEBPS/style.css', data: isRtl(meta.language) ? CSS + CSS_RTL : CSS },
  ];

  if (cover) {
    files.push({ path: `OEBPS/cover.${cover.ext}`, data: cover.data });
    files.push({
      path: 'OEBPS/cover.xhtml',
      data: chapterDoc(meta.language, 'Cover', `<div class="cover"><img src="cover.${cover.ext}" alt="${esc(meta.title)}"/></div>`),
    });
  }

  images.forEach((im) => files.push({ path: `OEBPS/${im.file}`, data: im.data }));

  chs.forEach((c, i) => {
    files.push({ path: `OEBPS/${chapterHref(i)}`, data: chapterDoc(meta.language, c.title, c.html) });
  });

  const manifest = [
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '    <item id="css" href="style.css" media-type="text/css"/>',
    ...(cover
      ? [
          `    <item id="cover-image" href="cover.${cover.ext}" media-type="${cover.mime}" properties="cover-image"/>`,
          '    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
        ]
      : []),
    ...images.map((im, i) => `    <item id="img${i + 1}" href="${esc(im.file)}" media-type="${esc(im.mime)}"/>`),
    ...chs.map((_, i) => `    <item id="ch${i + 1}" href="${chapterHref(i)}" media-type="application/xhtml+xml"/>`),
  ].join('\n');

  const spine = [
    ...(cover ? ['    <itemref idref="cover"/>'] : []),
    ...chs.map((_, i) => `    <itemref idref="ch${i + 1}"/>`),
  ].join('\n');
  const progression = isRtl(meta.language) ? ' page-progression-direction="rtl"' : '';

  files.push({
    path: 'OEBPS/content.opf',
    data: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${esc(meta.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${esc(meta.identifier)}</dc:identifier>
    <dc:title>${esc(meta.title)}</dc:title>
    <dc:language>${esc(meta.language)}</dc:language>
    <dc:creator id="author">${esc(meta.author)}</dc:creator>
    <meta refines="#author" property="role" scheme="marc:relators">aut</meta>
    <meta property="dcterms:modified">${esc(meta.modified)}</meta>
${cover ? '    <meta name="cover" content="cover-image"/>\n' : ''}  </metadata>
  <manifest>
${manifest}
  </manifest>
  <spine toc="ncx"${progression}>
${spine}
  </spine>
</package>`,
  });

  files.push({
    path: 'OEBPS/nav.xhtml',
    data: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(meta.language)}" lang="${esc(meta.language)}">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc"><h1>Contents</h1>
    <ol>
${chs.map((c, i) => `      <li><a href="${chapterHref(i)}">${esc(c.title)}</a></li>`).join('\n')}
    </ol>
  </nav>
</body>
</html>`,
  });

  files.push({
    path: 'OEBPS/toc.ncx',
    data: `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${esc(meta.identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${esc(meta.title)}</text></docTitle>
  <navMap>
${chs
  .map(
    (c, i) => `    <navPoint id="np${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${esc(c.title)}</text></navLabel>
      <content src="${chapterHref(i)}"/>
    </navPoint>`,
  )
  .join('\n')}
  </navMap>
</ncx>`,
  });

  return files;
}
