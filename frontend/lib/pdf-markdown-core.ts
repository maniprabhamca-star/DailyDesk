// Pure PDF → Markdown reconstruction — NO imports of pdf.js or React, so it runs
// anywhere and is unit-testable headlessly. Given positioned text items per page
// (x/y/size/bold), it rebuilds document structure from the layout:
//   • group items into lines by y
//   • a line larger than the body size (or bold + short + isolated) → a heading
//   • a line starting with a bullet / number → a list item
//   • a page whose layout is genuinely tabular → a GitHub-flavoured Markdown table
//   • everything else → paragraphs, with wrapped lines rejoined and real gaps kept
// The pdf.js IO that feeds this lives in lib/pdf-markdown.ts.

import { itemsToTable, looksTabular } from './table-extract';

export type MItem = { x: number; y: number; w: number; h: number; s: string; bold?: boolean };
export type MdOptions = {
  /** Detect headings by font size / weight (## ###). Off = everything is a paragraph. */
  headings?: boolean;
  /** Emit tabular regions as GFM tables. Off = tables come out as plain lines. */
  tables?: boolean;
};

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

type Line = { y: number; size: number; x0: number; text: string; cells: number; bold: boolean };

// Group one page's items into visual lines (y-grouped), recording each line's font
// size, left edge, cell count (how many gap-separated groups — a table row has ≥2),
// and whether it is mostly bold.
function buildLines(items: MItem[]): Line[] {
  const clean = items.filter((it) => it.s && it.s.trim().length);
  if (!clean.length) return [];
  const mh = median(clean.map((it) => it.h).filter((h) => h > 0)) || 10;
  const rowTol = Math.max(mh * 0.5, 2);
  const colGap = Math.max(mh * 0.9, 3);

  const sorted = [...clean].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: MItem[][] = [];
  for (const it of sorted) {
    const g = groups.find((row) => Math.abs(row[0].y - it.y) <= rowTol);
    if (g) g.push(it);
    else groups.push([it]);
  }
  groups.sort((a, b) => b[0].y - a[0].y);

  return groups.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = '';
    let cells = 1;
    let prevEnd = -Infinity;
    let boldChars = 0;
    let totalChars = 0;
    for (const it of row) {
      const t = it.s.replace(/\s+/g, ' ');
      if (prevEnd !== -Infinity && it.x - prevEnd > colGap) { text += '  '; cells++; }
      else if (text && !text.endsWith(' ') && !t.startsWith(' ')) text += ' ';
      text += t;
      prevEnd = it.x + it.w;
      const n = it.s.trim().length;
      totalChars += n;
      if (it.bold) boldChars += n;
    }
    return {
      y: row[0].y,
      size: median(row.map((it) => it.h).filter((h) => h > 0)) || mh,
      x0: Math.min(...row.map((it) => it.x)),
      text: text.replace(/[ \t]{2,}/g, ' ').trim(),
      cells,
      bold: totalChars > 0 && boldChars / totalChars >= 0.6,
    };
  }).filter((l) => l.text);
}

const LIST_RE = /^\s*([•▪·‣◦►\-–—*]|\d{1,3}[.)]|[a-zA-Z][.)])\s+(.+)$/;

function gfmTable(rows: string[][]): string {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const esc = (c: string) => (c || '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => esc(r[i] || ''));
  const header = pad(rows[0] || []);
  const sep = Array.from({ length: cols }, () => '---');
  const bodyRows = rows.slice(1).map(pad);
  return [header, sep, ...bodyRows].map((r) => `| ${r.join(' | ')} |`).join('\n');
}

export function pdfItemsToMarkdown(pages: MItem[][], opts: MdOptions = {}): string {
  const { headings = true, tables = true } = opts;
  const perPageLines = pages.map(buildLines);

  // Document body size = median line size, weighted by nothing fancy — good enough to
  // separate headings (bigger) from body. Falls back to 10 for empty docs.
  const body = median(perPageLines.flat().map((l) => l.size).filter((s) => s > 0)) || 10;

  const blocks: string[] = [];

  pages.forEach((items, pi) => {
    const lines = perPageLines[pi];
    if (!lines.length) return;

    // Detect a single tabular region on the page. Build the table ONLY from the
    // items inside that y-band — running itemsToTable over the WHOLE page pulls the
    // title and body paragraphs in as junk single-column rows (real bug caught in
    // the integration test). The band = the span of lines that split into ≥2 cells.
    let tableMd = '';
    let tTop = Infinity;
    let tBot = -Infinity;
    if (tables) {
      const trows = lines.filter((l) => l.cells >= 2);
      if (trows.length >= 3) {
        const top = Math.max(...trows.map((l) => l.y));
        const bot = Math.min(...trows.map((l) => l.y));
        const pad = (median(trows.map((l) => l.size)) || 10) * 0.6;
        const bandItems = items.filter((it) => it.y <= top + pad && it.y >= bot - pad);
        const { rows, cols } = itemsToTable(bandItems);
        if (looksTabular(rows, cols)) { tableMd = gfmTable(rows); tTop = top; tBot = bot; }
      }
    }

    let para: string[] = [];
    let listItems: string[] = [];
    let prevY: number | null = null;
    let tableDone = false;
    const flushPara = () => { if (para.length) { blocks.push(para.join(' ')); para = []; } };
    const flushList = () => { if (listItems.length) { blocks.push(listItems.join('\n')); listItems = []; } };
    const flush = () => { flushPara(); flushList(); };

    for (const l of lines) {
      // Table region: emit the GFM table once, skip its constituent lines.
      if (tableMd && l.y <= tTop && l.y >= tBot) {
        flush();
        if (!tableDone) { blocks.push(tableMd); tableDone = true; }
        prevY = l.y;
        continue;
      }

      const bigGap = prevY !== null && prevY - l.y > l.size * 1.8;
      const heading =
        headings &&
        l.cells < 2 &&
        l.text.length <= 120 &&
        !/[.,:;]$/.test(l.text) &&
        (l.size >= body * 1.15 || (l.bold && l.text.length <= 80));
      const list = LIST_RE.exec(l.text);

      if (heading) {
        flush();
        const lvl = l.size >= body * 1.6 ? 1 : l.size >= body * 1.28 ? 2 : 3;
        blocks.push(`${'#'.repeat(lvl)} ${l.text}`);
      } else if (list) {
        flushPara();
        const numbered = /^\d/.test(list[1]);
        listItems.push(`${numbered ? `${list[1].replace(/\)$/, '.')} ` : '- '}${list[2].trim()}`);
      } else {
        flushList();
        if (bigGap) flushPara();
        para.push(l.text);
      }
      prevY = l.y;
    }
    flush();
  });

  return blocks
    .filter((b) => b.trim())
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
