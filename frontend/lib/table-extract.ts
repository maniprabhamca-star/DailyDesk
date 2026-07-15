// Pure table-reconstruction algorithm for PDF → Excel — NO imports (no pdf.js, no
// React), so it runs anywhere and is unit-testable headlessly. Given positioned
// text items from one page, it rebuilds rows and columns from the layout: group
// items into lines by y, split lines into cells at horizontal gaps, cluster cell
// x-starts into columns, then place each cell. See lib/pdf-tables.ts for the pdf.js
// IO that feeds this.

export type TItem = { x: number; y: number; w: number; h: number; s: string };

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Turn positioned text items from ONE page into a grid of rows × columns.
export function itemsToTable(items: TItem[]): { rows: string[][]; cols: number } {
  const clean = items.filter((it) => it.s && it.s.trim().length);
  if (clean.length < 2) return { rows: clean.map((it) => [it.s.trim()]), cols: clean.length ? 1 : 0 };

  const mh = median(clean.map((it) => it.h).filter((h) => h > 0)) || 10;
  const rowTol = Math.max(mh * 0.5, 2); // same-line y tolerance
  const colGap = Math.max(mh * 0.9, 4); // gap that separates two cells on a line
  const colTol = Math.max(mh * 1.2, 6); // x spread that still counts as one column

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
  type LCell = { x: number; text: string };
  const lineCells: LCell[][] = lines.map((l) => {
    const cells: LCell[] = [];
    let cur: { x: number; end: number; text: string } | null = null;
    for (const it of l.items) {
      const t = it.s.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (cur && it.x - cur.end <= colGap) {
        cur.text += `${it.s.startsWith(' ') ? '' : ' '}${t}`;
        cur.end = it.x + it.w;
      } else {
        if (cur) cells.push({ x: cur.x, text: cur.text });
        cur = { x: it.x, end: it.x + it.w, text: t };
      }
    }
    if (cur) cells.push({ x: cur.x, text: cur.text });
    return cells;
  });

  // 3) Cluster all cell x-starts into column left-edges.
  const xs = lineCells.flat().map((c) => c.x).sort((a, b) => a - b);
  const edges: number[] = [];
  for (const x of xs) {
    if (!edges.length || x - edges[edges.length - 1] > colTol) edges.push(x);
  }
  const colOf = (x: number): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < edges.length; i++) {
      const d = Math.abs(x - edges[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  // 4) Place each cell into its column to build the grid.
  const cols = edges.length;
  let rows: string[][] = lineCells.map((cells) => {
    const row: string[] = new Array(cols).fill('');
    for (const c of cells) {
      const ci = colOf(c.x);
      row[ci] = row[ci] ? `${row[ci]} ${c.text}` : c.text;
    }
    return row;
  });

  rows = trimGrid(rows);
  return { rows, cols: rows[0]?.length ?? 0 };
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

// A page's grid is "tabular enough" to offer: 2+ columns, 2+ rows, and most rows
// populate 2+ columns (filters out prose pages whose word gaps mimic columns).
export function looksTabular(rows: string[][], cols: number): boolean {
  if (cols < 2 || rows.length < 2) return false;
  const multi = rows.filter((r) => r.filter((c) => c.trim() !== '').length >= 2).length;
  return multi >= Math.max(2, Math.ceil(rows.length * 0.5));
}
