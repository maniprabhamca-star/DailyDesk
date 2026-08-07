import { describe, it, expect } from 'vitest';
import { blocksToPlainText, forDocx, forPdf, markdownToBlocks, stripInline } from '@/lib/md-blocks';
import { buildIco } from '@/lib/favicon-pack';
import { readSvgSize, sanitizeSvg, withExplicitSize } from '@/lib/svg-convert';

describe('stripInline', () => {
  it('unwraps the marks the writers cannot style', () => {
    expect(stripInline('**bold** and *italic* and `code`')).toBe('bold and italic and code');
    expect(stripInline('see [the docs](https://example.com)')).toBe('see the docs (https://example.com)');
    expect(stripInline('![a cat](cat.png)')).toBe('a cat');
  });

  it('leaves ordinary punctuation and maths alone', () => {
    expect(stripInline('2 * 3 * 4 = 24')).toBe('2 * 3 * 4 = 24');
    expect(stripInline('snake_case_name stays')).toBe('snake_case_name stays');
  });
});

describe('markdownToBlocks', () => {
  it('reads headings, both styles', () => {
    const b = markdownToBlocks('# One\n\n## Two\n\nTitle\n=====\n\nSub\n-----');
    expect(b.map((x) => x.type)).toEqual(['h1', 'h2', 'h1', 'h2']);
  });

  it('joins a wrapped paragraph the way Markdown does', () => {
    const [p] = markdownToBlocks('one line\nand its continuation');
    expect(p).toEqual({ type: 'p', text: 'one line and its continuation' });
  });

  it('reads both kinds of list', () => {
    const b = markdownToBlocks('- first\n- second\n\n1. third\n2. fourth');
    expect(b.every((x) => x.type === 'li')).toBe(true);
    expect(b).toHaveLength(4);
    expect(b[2]).toMatchObject({ text: 'third' });
  });

  it('reads a GFM table with its header', () => {
    const [t] = markdownToBlocks('| Region | Q1 |\n| --- | --- |\n| India | 1400 |');
    expect(t).toMatchObject({ type: 'table', header: true });
    if (t.type === 'table') expect(t.rows).toEqual([['Region', 'Q1'], ['India', 1400].map(String)]);
  });

  it('keeps code lines and drops the fences', () => {
    const b = markdownToBlocks('```js\nconst x = 1;\n```');
    expect(b).toEqual([{ type: 'note', text: 'const x = 1;' }]);
  });

  it('folds a block quote into one note', () => {
    expect(markdownToBlocks('> first\n> second')).toEqual([{ type: 'note', text: 'first second' }]);
  });

  it('drops horizontal rules without swallowing what follows', () => {
    const b = markdownToBlocks('before\n\n---\n\nafter');
    expect(b.map((x) => 'text' in x && x.text)).toEqual(['before', 'after']);
  });
});

describe('block conversion', () => {
  const blocks = markdownToBlocks('# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\ntail');

  it('flattens tables for the PDF writer, which has no table block', () => {
    const pdf = forPdf(blocks);
    expect(pdf.some((b) => b.type === 'table' as never)).toBe(false);
    expect(pdf.some((b) => 'text' in b && b.text === 'A · B')).toBe(true);
  });

  it('keeps tables for Word and drops page breaks it cannot express', () => {
    const docx = forDocx([...blocks, { type: 'pagebreak' }]);
    expect(docx.some((b) => b.type === 'table')).toBe(true);
    expect(docx.some((b) => (b as { type: string }).type === 'pagebreak')).toBe(false);
  });

  it('writes readable plain text', () => {
    const text = blocksToPlainText(blocks);
    expect(text).toContain('Title');
    expect(text).toContain('A\tB');
    expect(text.endsWith('tail')).toBe(true);
  });
});

describe('svg helpers', () => {
  it('reads the size from width/height, else the viewBox', () => {
    expect(readSvgSize('<svg width="120" height="60"></svg>')).toEqual({ width: 120, height: 60, fromViewBox: false });
    expect(readSvgSize('<svg viewBox="0 0 400 300"></svg>')).toEqual({ width: 400, height: 300, fromViewBox: true });
    expect(readSvgSize('<svg width="10px" height="5px"></svg>')?.width).toBe(10);
  });

  it('returns null when there is nothing to size from', () => {
    expect(readSvgSize('<svg></svg>')).toBeNull();
    expect(readSvgSize('not an svg')).toBeNull();
  });

  it('forces explicit dimensions on — the fix for blank exports', () => {
    const out = withExplicitSize('<svg viewBox="0 0 400 300"><rect/></svg>', 800, 600);
    expect(out).toContain('width="800"');
    expect(out).toContain('height="600"');
    expect(out).toContain('viewBox="0 0 400 300"');
  });

  it('replaces any width/height already there rather than duplicating', () => {
    const out = withExplicitSize('<svg width="1" height="1"></svg>', 64, 64);
    expect(out.match(/width=/g)).toHaveLength(1);
    expect(out).toContain('width="64"');
  });

  it('strips scripts and event handlers', () => {
    const dirty = `<svg onload="steal()"><script>bad()</script><a href="javascript:bad()">x</a><rect/></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<rect/>');
  });
});

describe('buildIco', () => {
  const png = (n: number) => new Uint8Array(n).fill(7);
  const ico = buildIco([{ size: 16, png: png(40) }, { size: 32, png: png(60) }, { size: 48, png: png(80) }]);
  const view = new DataView(ico.buffer);

  it('writes a real multi-image icon header', () => {
    expect(view.getUint16(0, true)).toBe(0);   // reserved
    expect(view.getUint16(2, true)).toBe(1);   // type 1 = icon
    expect(view.getUint16(4, true)).toBe(3);   // three images
  });

  it('records each image size, length and offset', () => {
    expect(ico[6]).toBe(16);
    expect(view.getUint32(6 + 8, true)).toBe(40);
    expect(view.getUint32(6 + 12, true)).toBe(6 + 48); // first image starts after the directory
    expect(ico[6 + 16]).toBe(32);
    expect(view.getUint32(6 + 16 + 12, true)).toBe(6 + 48 + 40);
  });

  it('is exactly header + directory + payloads long', () => {
    expect(ico.length).toBe(6 + 3 * 16 + 40 + 60 + 80);
  });
});
