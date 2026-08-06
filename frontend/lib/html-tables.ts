// Find the real tables in a web page and turn them into spreadsheet rows.
//
// The awkward parts of HTML tables are colspan and rowspan: a cell can occupy
// several columns, and a cell three rows up can still be occupying this row's
// first column. A naive "map every <td> to a cell" reader silently shifts every
// row after the first merged cell — which looks fine on screen and is wrong in
// the spreadsheet. So we lay the cells onto a grid the way a browser does.
//
// Parsing happens with DOMParser, whose documents are inert: no script runs, no
// image or stylesheet is fetched. Only text is read out. That keeps the whole
// tool on-device and safe on hostile markup.

import { coerce, type Cell } from './xlsx';

export type HtmlTable = {
  name: string;
  rows: Cell[][];
  cols: number;
  /** Where the table sat in the page — shown so the user can tell two apart. */
  hint: string;
};

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A table used purely for layout wraps other tables; the innermost ones hold
 *  the data. */
const isLayoutShell = (t: Element) => !!t.querySelector('table');

function gridOf(table: HTMLTableElement): { rows: Cell[][]; cols: number } {
  const grid: (Cell | undefined)[][] = [];
  const rowEls = Array.from(table.querySelectorAll('tr'))
    // A nested table's rows belong to that table, not this one.
    .filter((tr) => tr.closest('table') === table);

  rowEls.forEach((tr, r) => {
    if (!grid[r]) grid[r] = [];
    let c = 0;
    const cells = Array.from(tr.children).filter(
      (el) => (el.tagName === 'TD' || el.tagName === 'TH') && el.closest('table') === table,
    ) as HTMLTableCellElement[];

    for (const cell of cells) {
      while (grid[r][c] !== undefined) c++; // skip columns a rowspan above still owns
      const colSpan = Math.max(1, Math.min(64, cell.colSpan || 1));
      const rowSpan = Math.max(1, Math.min(256, cell.rowSpan || 1));
      const text = coerce(clean(cell.textContent || ''));
      for (let dr = 0; dr < rowSpan; dr++) {
        const rr = r + dr;
        if (!grid[rr]) grid[rr] = [];
        // A merged cell repeats its value across every square it covers. Filling
        // the span with blanks instead would drop the label off every row but
        // the first, which is exactly what people complain about after pasting
        // a table into Excel by hand.
        for (let dc = 0; dc < colSpan; dc++) grid[rr][c + dc] = text;
      }
      c += colSpan;
    }
  });

  const cols = grid.reduce((n, row) => Math.max(n, row.length), 0);
  const rows = grid.map((row) => {
    const out: Cell[] = [];
    for (let i = 0; i < cols; i++) out.push(row[i] ?? '');
    return out;
  });
  return { rows, cols };
}

/** The heading a reader would say the table sits under. */
function nameFor(table: HTMLTableElement, index: number): { name: string; hint: string } {
  const caption = clean(table.querySelector('caption')?.textContent || '');
  if (caption) return { name: caption.slice(0, 60), hint: 'from its caption' };

  let el: Element | null = table;
  for (let hops = 0; el && hops < 40; hops++) {
    el = el.previousElementSibling ?? el.parentElement;
    if (!el) break;
    if (/^H[1-6]$/.test(el.tagName)) {
      const h = clean(el.textContent || '');
      if (h) return { name: h.slice(0, 60), hint: 'under this heading' };
    }
  }
  const id = table.getAttribute('id') || table.getAttribute('aria-label');
  if (id) return { name: clean(id).slice(0, 60), hint: 'named in the page' };
  return { name: `Table ${index + 1}`, hint: `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} table on the page` };
}

export type ParseOptions = {
  /** Ignore one-cell and single-column tables — almost always layout, not data. */
  minCols?: number;
  minRows?: number;
  maxTables?: number;
};

export function tablesFromHtml(html: string, opts: ParseOptions = {}): HtmlTable[] {
  const minCols = opts.minCols ?? 2;
  const minRows = opts.minRows ?? 2;
  const maxTables = opts.maxTables ?? 200;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Script and style text would otherwise land in a cell if either sits inside
  // a table, which happens more often than you would hope.
  doc.querySelectorAll('script,style,noscript,template').forEach((el) => el.remove());

  const out: HtmlTable[] = [];
  const tables = Array.from(doc.querySelectorAll('table')) as HTMLTableElement[];
  tables.forEach((table, i) => {
    if (out.length >= maxTables || isLayoutShell(table)) return;
    const { rows, cols } = gridOf(table);
    const filled = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
    if (cols < minCols || filled.length < minRows) return;
    const { name, hint } = nameFor(table, i);
    out.push({ name, hint, rows: filled, cols });
  });
  return out;
}

// Sheet naming is shared with the rest of the spreadsheet pack — one set of
// Excel's rules, in one place.
export { sheetName } from './sheet-io';
