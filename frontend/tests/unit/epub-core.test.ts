import { describe, it, expect } from 'vitest';
import {
  buildEpubFiles, dehyphenate, splitByHeadings, splitByOutline, splitByPages, stitchPages, stripRunningHeads,
} from '@/lib/epub-core';
import type { MItem } from '@/lib/pdf-markdown-core';

const meta = {
  title: 'A Book', author: 'Jane Tester', language: 'en',
  identifier: 'urn:uuid:1111', modified: '2026-08-06T00:00:00Z',
};

// A page of items: `lines` are [y, text] with y measured pdf.js-style (up).
const page = (lines: Array<[number, string]>): MItem[] =>
  lines.map(([y, s]) => ({ x: 50, y, w: s.length * 5, h: 10, s }));

describe('dehyphenate', () => {
  it('rejoins a word broken across a line', () => {
    expect(dehyphenate('the informa- tion is here')).toBe('the information is here');
  });
  it('leaves a real hyphen between words alone', () => {
    expect(dehyphenate('a well-known case')).toBe('a well-known case');
    expect(dehyphenate('Mid- 2024 report')).toBe('Mid- 2024 report'); // capital + digit: untouched
  });
});

describe('stitchPages', () => {
  it('continues a sentence cut by a page break', () => {
    expect(stitchPages(['the cat sat on the', 'mat and slept.'])).toBe('the cat sat on the mat and slept.');
  });
  it('keeps separate blocks apart when the page ended cleanly', () => {
    expect(stitchPages(['One ends here.', 'Two starts here.'])).toBe('One ends here.\n\nTwo starts here.');
  });
  it('never swallows a heading into the previous paragraph', () => {
    expect(stitchPages(['trailing prose with no full stop', '# chapter two'])).toBe('trailing prose with no full stop\n\n# chapter two');
  });
  it('skips empty pages', () => {
    expect(stitchPages(['A.', '   ', 'B.'])).toBe('A.\n\nB.');
  });
});

describe('stripRunningHeads', () => {
  const build = (n: number) =>
    Array.from({ length: n }, (_, i) => page([
      [800, 'The Annual Report'],   // running header, every page
      [500, `body text ${i}`],
      [40, `${i + 1}`],             // page number
    ]));

  it('drops the repeated header and the page number, keeps the body', () => {
    const out = stripRunningHeads(build(8));
    const texts = out.flat().map((it) => it.s);
    expect(texts).not.toContain('The Annual Report');
    expect(texts).not.toContain('3');
    expect(texts).toContain('body text 2');
  });

  it('leaves short documents alone — too little evidence to be sure', () => {
    const input = build(3);
    expect(stripRunningHeads(input)).toBe(input);
  });

  it('keeps a heading that only appears once', () => {
    const pages = build(8);
    pages[4] = page([[800, 'Chapter Five'], [500, 'body text 4'], [40, '5']]);
    const texts = stripRunningHeads(pages)[4].map((it) => it.s);
    expect(texts).toContain('Chapter Five');
  });
});

describe('chapter splitting', () => {
  it('splits at headings and keeps the text before the first one', () => {
    const md = 'opening words\n\n# One\n\nbody one\n\n# Two\n\nbody two';
    const chs = splitByHeadings(md, 'Start');
    expect(chs?.map((c) => c.title)).toEqual(['Start', 'One', 'Two']);
    expect(chs?.[2].md).toContain('body two');
  });

  it('returns null when there is nothing to split on', () => {
    expect(splitByHeadings('just a paragraph', 'Start')).toBeNull();
  });

  it('splits at bookmarks, with front matter kept', () => {
    const pages = ['cover page', 'intro', 'chapter one text', 'more one', 'chapter two text'];
    const chs = splitByOutline(pages, [{ title: 'One', page: 2 }, { title: 'Two', page: 4 }]);
    expect(chs?.map((c) => c.title)).toEqual(['Front matter', 'One', 'Two']);
    expect(chs?.[1].md).toContain('more one');
  });

  it('ignores bookmarks that point outside the document', () => {
    expect(splitByOutline(['a', 'b'], [{ title: 'X', page: 99 }, { title: 'Y', page: 40 }])).toBeNull();
  });

  it('splits by fixed page blocks', () => {
    const chs = splitByPages(['p1', 'p2', 'p3', 'p4', 'p5'], 2);
    expect(chs.map((c) => c.title)).toEqual(['Pages 1–2', 'Pages 3–4', 'Page 5']);
  });
});

describe('buildEpubFiles', () => {
  const files = buildEpubFiles(meta, [{ title: 'One', html: '<p>hello</p>' }, { title: 'Two', html: '<p>world</p>' }]);
  const at = (p: string) => files.find((f) => f.path === p);

  it('puts an uncompressed mimetype first', () => {
    expect(files[0].path).toBe('mimetype');
    expect(files[0].data).toBe('application/epub+zip');
    expect(files[0].store).toBe(true);
  });

  it('ships the container, package, both tables of contents and every chapter', () => {
    for (const p of ['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/toc.ncx',
      'OEBPS/style.css', 'OEBPS/chapter-001.xhtml', 'OEBPS/chapter-002.xhtml']) {
      expect(at(p), p).toBeTruthy();
    }
  });

  it('declares every chapter in the manifest and the spine', () => {
    const opf = String(at('OEBPS/content.opf')!.data);
    expect(opf).toContain('href="chapter-001.xhtml"');
    expect(opf).toContain('<itemref idref="ch2"/>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-08-06T00:00:00Z</meta>');
  });

  it('escapes metadata that would otherwise break the XML', () => {
    const odd = buildEpubFiles({ ...meta, title: 'Ben & Jerry <draft>' }, [{ title: 'a', html: '<p/>' }]);
    const opf = String(odd.find((f) => f.path === 'OEBPS/content.opf')!.data);
    expect(opf).toContain('Ben &amp; Jerry &lt;draft&gt;');
    expect(opf).not.toContain('<draft>');
  });

  it('adds the cover to the manifest and the front of the spine', () => {
    const withCover = buildEpubFiles(meta, [{ title: 'One', html: '<p>x</p>' }],
      { data: new Uint8Array([1, 2, 3]), mime: 'image/jpeg', ext: 'jpg' });
    const opf = String(withCover.find((f) => f.path === 'OEBPS/content.opf')!.data);
    expect(opf).toContain('properties="cover-image"');
    expect(opf.indexOf('idref="cover"')).toBeLessThan(opf.indexOf('idref="ch1"'));
    expect(withCover.find((f) => f.path === 'OEBPS/cover.jpg')).toBeTruthy();
  });

  it('strips control characters, which XML forbids and PDFs are full of', () => {
    // A real bookmark title decoded from PDFDocEncoding: the em dash arrives as
    // U+0014. Left in, it makes the whole EPUB refuse to open.
    const DC4 = '\u0014';
    const dirty = buildEpubFiles({ ...meta, title: `Report ${DC4} 2026` }, [
      { title: `Chapter ${DC4} One`, html: '<p>text here</p>' },
    ]);
    const all = dirty.map((f) => String(f.data)).join('');
    expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(all)).toBe(false);
    expect(all).toContain('Chapter  One');
  });

  it('never produces an empty book', () => {
    const empty = buildEpubFiles(meta, []);
    expect(empty.find((f) => f.path === 'OEBPS/chapter-001.xhtml')).toBeTruthy();
  });

  it('writes well-formed XML declarations everywhere', () => {
    for (const f of files) {
      if (f.path.endsWith('.xhtml') || f.path.endsWith('.opf') || f.path.endsWith('.ncx') || f.path.endsWith('.xml')) {
        expect(String(f.data).startsWith('<?xml version="1.0" encoding="utf-8"?>'), f.path).toBe(true);
      }
    }
  });
});
