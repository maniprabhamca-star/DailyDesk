// Pure table-reconstruction algorithm for PDF → Excel — NO imports (no pdf.js, no
// React), so it runs anywhere and is unit-testable headlessly. Given positioned
// text items from one page, it rebuilds rows and columns from the layout: group
// items into lines by y, split lines into cells at horizontal gaps, cluster cell
// x-starts into columns, then place each cell. See lib/pdf-tables.ts for the pdf.js
// IO that feeds this.

export type TItem = { x: number; y: number; w: number; h: number; s: string };

export type TableOpts = {
  /** Gap (× median font height) that separates two cells on a line. Lower = split
   *  more eagerly. Bank statements pack columns tightly (a balance and the branch
   *  code can sit 6pt apart), so they need a smaller value than generic documents. */
  colGapMult?: number;
  /** Drop columns too weakly populated to be real, merging their text left.
   *  Essential for free-form documents (a form once produced 19 junk columns), but
   *  WRONG for statements: a Credit column legitimately fills only a few rows and
   *  would be dropped. Statements rely on balance validation as the filter instead. */
  dropPhantom?: boolean;
};

// "Looks like a number" — used only to decide whether a cell may also align on its
// RIGHT edge (amount columns are right-aligned). Deliberately loose; the real
// parsing lives in lib/banks/balance.ts.
const NUMISH = /^[₹$]?\s*[-+(]?\s*[\d,]+(\.\d{1,2})?\s*\)?\s*(DR|CR)?\.?$/i;

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Turn positioned text items from ONE page into a grid of rows × columns.
export function itemsToTable(items: TItem[], opts: TableOpts = {}): { rows: string[][]; cols: number } {
  const { colGapMult = 0.9, dropPhantom = true } = opts;
  const clean = items.filter((it) => it.s && it.s.trim().length);
  if (clean.length < 2) return { rows: clean.map((it) => [it.s.trim()]), cols: clean.length ? 1 : 0 };

  const mh = median(clean.map((it) => it.h).filter((h) => h > 0)) || 10;
  const rowTol = Math.max(mh * 0.5, 2);          // same-line y tolerance
  const colGap = Math.max(mh * colGapMult, 3);   // gap that separates two cells on a line
  const colTol = Math.max(mh * 1.2, 6);          // x spread that still counts as one column

  // 1) Group items into lines by y (PDF y increases upward → sort descending).
  const sorted = [...clean].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; items: TItem[] }> = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= rowTol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);

  // 2) Split each line into cells at horizontal gaps larger than colGap.
  type LCell = { x: number; end: number; text: string; line: number };
  const cells: LCell[] = [];
  lines.forEach((l, li) => {
    let cur: { x: number; end: number; text: string } | null = null;
    for (const it of l.items) {
      const t = it.s.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (cur && it.x - cur.end <= colGap) {
        cur.text += `${it.s.startsWith(' ') ? '' : ' '}${t}`;
        cur.end = it.x + it.w;
      } else {
        if (cur) cells.push({ ...cur, line: li });
        cur = { x: it.x, end: it.x + it.w, text: t };
      }
    }
    if (cur) cells.push({ ...cur, line: li });
  });

  // 3) Group cells into columns.
  //
  // ⚠ Cluster TEXT by its LEFT edge but NUMBERS by either edge. Amount columns are
  // right-aligned: in a real Axis statement a "1.00" debit starts 24pt to the right
  // of a "13,500.00" debit, so left-edge-only clustering split one debit column into
  // several and those rows lost their amount entirely (balance moved, debit+credit
  // both empty). Their RIGHT edges, by contrast, were identical to the decimal
  // (379.2 / 442.0 / 530.9). Numbers therefore join a column if either edge lines
  // up; text joins on the left edge only, so a long narration can't chain itself
  // into the amount column via a coincidental right edge.
  const n = cells.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a: number, b: number) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };

  const link = (idxs: number[], key: (c: LCell) => number) => {
    const sorted2 = [...idxs].sort((i, j) => key(cells[i]) - key(cells[j]));
    for (let k = 1; k < sorted2.length; k++) {
      if (key(cells[sorted2[k]]) - key(cells[sorted2[k - 1]]) <= colTol) union(sorted2[k], sorted2[k - 1]);
    }
  };
  const allIdx = cells.map((_, i) => i);
  link(allIdx, (c) => c.x);                                   // left edges: everything
  const numIdx = allIdx.filter((i) => NUMISH.test(cells[i].text));
  link(numIdx, (c) => c.end);                                 // right edges: numbers only

  const groups = new Map<number, number[]>();
  allIdx.forEach((i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  });
  const ordered = Array.from(groups.values())
    .map((idxs) => ({ idxs, minX: Math.min(...idxs.map((i) => cells[i].x)) }))
    .sort((a, b) => a.minX - b.minX);
  const colOfCell = new Map<number, number>();
  ordered.forEach((g, ci) => g.idxs.forEach((i) => colOfCell.set(i, ci)));

  // 4) Place each cell into its column to build the grid.
  const cols = ordered.length;
  let rows: string[][] = lines.map(() => new Array(cols).fill(''));
  cells.forEach((c, i) => {
    const ci = colOfCell.get(i)!;
    const row = rows[c.line];
    row[ci] = row[ci] ? `${row[ci]} ${c.text}` : c.text;
  });

  if (dropPhantom) rows = dropPhantomColumns(rows);
  rows = trimGrid(rows);
  return { rows, cols: rows[0]?.length ?? 0 };
}

// A real table column is used by MANY rows. Free-form documents (forms, letters)
// scatter text at dozens of x-positions, which the clustering above turns into
// "phantom" columns used by only a row or two — the thing that made a 36-row form
// come out as a 19-column mess. Drop any column too weakly supported to be real
// and merge its text LEFT into the nearest surviving column, so nothing is lost.
const COL_SUPPORT = 0.15; // a column must be filled on ≥15% of rows to be real

function dropPhantomColumns(rows: string[][]): string[][] {
  if (rows.length < 4) return rows; // too few rows to judge support
  const nCols = Math.max(0, ...rows.map((r) => r.length));
  if (nCols < 2) return rows;
  const support = Array.from({ length: nCols }, (_, c) => rows.filter((r) => (r[c] || '').trim() !== '').length);
  const min = Math.max(2, Math.ceil(rows.length * COL_SUPPORT));
  const keep = support.map((s) => s >= min);
  if (!keep.some(Boolean)) return rows; // nothing qualifies — leave as-is
  return rows.map((r) => {
    const out: string[] = [];
    let carry = '';
    for (let c = 0; c < nCols; c++) {
      const text = (r[c] || '').trim();
      if (keep[c]) {
        out.push([carry, text].filter(Boolean).join(' '));
        carry = '';
      } else if (text) {
        carry = [carry, text].filter(Boolean).join(' '); // merge into the next kept column
      }
    }
    // anything trailing after the last kept column joins the last cell
    if (carry && out.length) out[out.length - 1] = [out[out.length - 1], carry].filter(Boolean).join(' ');
    return out;
  });
}

// Drop fully-empty rows and fully-empty columns.
export function trimGrid(rows: string[][]): string[][] {
  let out = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!out.length) return out;
  const nCols = Math.max(...out.map((r) => r.length));
  const keep: number[] = [];
  for (let c = 0; c < nCols; c++) {
    if (out.some((r) => (r[c] || '').trim() !== '')) keep.push(c);
  }
  return out.map((r) => keep.map((c) => r[c] || ''));
}

// A page's grid is "tabular enough" to offer as a table. Real tables have SEVERAL
// columns each populated down most of the page. Forms and letters don't — they have
// one column of labels plus scattered text, which must be rejected rather than
// exported as a grid of empty cells (the 36×19 dealer-form bug).
const STRONG_SUPPORT = 0.25; // a "real" column is filled on ≥25% of rows

// ≥50% of rows must repeat the SAME multi-column shape. Measured on real files:
// a bank statement's dominant shape covers ~70% of rows (one shape, over and over),
// while a dealer-application FORM peaks at ~31% spread over 6 different shapes.
// 50% separates them with margin.
const SHAPE_SHARE = 0.5;

export function looksTabular(rows: string[][], cols: number): boolean {
  if (cols < 2 || rows.length < 3) return false;
  // 1) Need at least TWO columns that are genuinely populated down the page.
  const need = Math.max(2, Math.ceil(rows.length * STRONG_SUPPORT));
  const strong = Array.from({ length: cols }, (_, c) => rows.filter((r) => (r[c] || '').trim() !== '').length)
    .filter((s) => s >= need).length;
  if (strong < 2) return false;

  // 2) The decisive test: a real table REPEATS a row shape — most data rows fill the
  // same set of columns (date|desc|amount|balance, over and over). A form or letter
  // fills a different combination on nearly every line, which is exactly how a
  // dealer-application form ended up exported as scrambled cells. So require one
  // multi-column shape to recur across a meaningful share of rows.
  const shapes = new Map<string, number>();
  for (const r of rows) {
    const key = Array.from({ length: cols }, (_, c) => ((r[c] || '').trim() ? '1' : '0')).join('');
    const filled = key.split('').filter((ch) => ch === '1').length;
    if (filled >= 2) shapes.set(key, (shapes.get(key) || 0) + 1);
  }
  const dominant = shapes.size ? Math.max(...Array.from(shapes.values())) : 0;
  return dominant >= Math.max(2, Math.ceil(rows.length * SHAPE_SHARE));
}
