// Markdown → the block model our PDF and Word writers already speak.
// lib/md-render.ts turns Markdown into HTML for previews; this is the same
// subset going the other way, so one parser's understanding of a document
// drives both exports.

import type { PdfBlock } from './ai-export';
import type { DocxBlock } from './docx';

export type DocBlock = PdfBlock | Extract<DocxBlock, { type: 'table' }>;

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (l: string) => /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/.test(l);
const cellsOf = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** Strip the inline marks — the writers style whole blocks, not runs, so
 *  leaving the asterisks in would print them literally. */
export function stripInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')      // image → its alt text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // link → text (url)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Italics only when the asterisks HUG the words. Without that guard,
    // "2 * 3 * 4" reads as an emphasised " 3 " and the multiplication signs
    // vanish from the document.
    .replace(/(^|\W)\*(\S|\S[^*]*?\S)\*(?=\W|$)/g, '$1$2')
    .replace(/(^|\W)_(\S|\S[^_]*?\S)_(?=\W|$)/g, '$1$2')
    .replace(/^>\s?/, '')
    .trim();
}

export function markdownToBlocks(md: string): DocBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: DocBlock[] = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code: keep the lines, drop the fences.
    if (/^\s*```/.test(line)) { inFence = !inFence; i++; continue; }
    if (inFence) { if (line.trim()) out.push({ type: 'note', text: line }); i++; continue; }

    if (!line.trim()) { i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { out.push({ type: h[1].length === 1 ? 'h1' : 'h2', text: stripInline(h[2]) }); i++; continue; }

    // Setext heading: a line underlined with === or ---
    if (i + 1 < lines.length && /^\s*(={3,}|-{3,})\s*$/.test(lines[i + 1]) && line.trim() && !isTableRow(line)) {
      out.push({ type: lines[i + 1].trim().startsWith('=') ? 'h1' : 'h2', text: stripInline(line) });
      i += 2;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { i++; continue; } // horizontal rule

    if (isTableRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cellsOf(line).map(stripInline);
      i += 2;
      const rows: string[][] = [head];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cellsOf(lines[i]).map(stripInline)); i++; }
      out.push({ type: 'table', rows, header: true });
      continue;
    }

    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        out.push({ type: 'li', text: stripInline(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '')) });
        i++;
      }
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(stripInline(lines[i])); i++; }
      out.push({ type: 'note', text: quote.join(' ') });
      continue;
    }

    // Paragraph: run consecutive plain lines together, the way Markdown does.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim()
      && !/^(#{1,6}\s|\s*([-*+]|\d+[.)])\s|\s*>|\s*```)/.test(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push({ type: 'p', text: stripInline(para.join(' ')) });
  }

  return out;
}

/** The PDF writer has no table block — flatten one to readable lines. */
export function forPdf(blocks: DocBlock[]): PdfBlock[] {
  const out: PdfBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'table') {
      b.rows.forEach((row, i) => out.push({ type: i === 0 && b.header ? 'h2' : 'p', text: row.join(' · ') }));
    } else {
      out.push(b);
    }
  }
  return out;
}

export function forDocx(blocks: DocBlock[]): DocxBlock[] {
  const out: DocxBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'pagebreak') continue; // the Word writer has no page-break block
    out.push(b as DocxBlock);
  }
  return out;
}

export function blocksToPlainText(blocks: DocBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === 'table') { b.rows.forEach((r) => lines.push(r.join('\t'))); lines.push(''); continue; }
    if (b.type === 'pagebreak') { lines.push('', '—'.repeat(10), ''); continue; }
    lines.push(b.type === 'li' ? `  • ${b.text}` : b.text);
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
