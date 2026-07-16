// Balance validation — the heart of the Statement Converter. Pure (no imports) so
// it's unit-testable headlessly, like lib/table-extract.ts.
//
// THE IDEA: every bank statement obeys one equation —
//
//     balance[i] = balance[i-1] − debit[i] + credit[i]
//
// That isn't just a check we run AFTER extraction; it's a CONSTRAINT we can SOLVE.
// We don't need to know the bank, or have a sample of its layout: we try candidate
// column assignments and keep the one where the arithmetic actually holds down the
// page. The same pass therefore does three jobs at once:
//
//   1. identifies which column is date / debit / credit / balance   (no bank needed)
//   2. PROVES the extraction is right — arithmetically, not by vibes
//   3. gives an automatic accuracy oracle, so AI escalation only fires when it fails
//
// Money is handled in INTEGER PAISE end-to-end. Never floats: 0.1 + 0.2 !== 0.3, and
// a statement that "almost" reconciles is worthless.

export type Money = number; // integer paise (₹1.00 === 100)

export type Mode = 'debit-credit' | 'signed' | 'marker';

export type ColumnRoles = {
  mode: Mode;
  date: number;
  narration: number;
  ref: number | null;
  balance: number;
  debit?: number;   // mode 'debit-credit'
  credit?: number;  // mode 'debit-credit'
  amount?: number;  // modes 'signed' | 'marker'
  marker?: number;  // mode 'marker' — a Dr/Cr text column
  score: number;    // row-pairs that reconciled under this hypothesis
  pairs: number;    // row-pairs tested
};

export type Txn = {
  row: number;
  date: string;
  narration: string;
  ref: string;
  debit: Money | null;
  credit: Money | null;
  balance: Money;
  ok: boolean;            // reconciles against the previous row
  expected?: Money;       // what the balance SHOULD have been, when !ok
};

export type Validation = {
  ok: boolean;                 // every transaction reconciled
  roles: ColumnRoles | null;   // null = we could not find a statement shape at all
  txns: Txn[];
  verified: number;
  total: number;
  failures: number[];          // indexes into txns
  opening: Money | null;
  closing: Money | null;
  totalDebit: Money;
  totalCredit: Money;
};

// ---- parsing ---------------------------------------------------------------

// Stripping commas handles BOTH Indian lakh grouping (1,23,456.78) and Western
// (123,456.78) without caring which is which — the digits are what matter.
export function parseAmount(raw: string): { value: Money; marker?: 'DR' | 'CR' } | null {
  if (raw == null) return null;
  let s = String(raw).trim().toUpperCase();
  if (!s || s === '-' || s === '—' || s === '–' || s === 'NIL' || s === 'N/A') return null;

  let marker: 'DR' | 'CR' | undefined;
  const mk = s.match(/\s*\b(DR|CR)\b\.?$/); // trailing "500.00 Dr"
  if (mk) { marker = mk[1] as 'DR' | 'CR'; s = s.slice(0, mk.index).trim(); }

  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }   // (500.00)
  if (/-$/.test(s)) { neg = true; s = s.slice(0, -1).trim(); }          // 500.00-

  s = s.replace(/INR|RS\.?|₹/g, '').replace(/,/g, '').replace(/\s/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;

  const paise = Math.round(Number(s) * 100);
  if (!Number.isFinite(paise)) return null;
  return { value: neg ? -paise : paise, marker };
}

const DATE_RES = [
  /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/,               // 04/07/2026 · 4-7-26
  /^\d{1,2}[\s\-]?[A-Z]{3}[\s\-]?'?\d{2,4}$/i,          // 04 Jul 2026 · 04-JUL-26
  /^\d{4}-\d{2}-\d{2}$/,                                // 2026-07-04
];
export const looksLikeDate = (s: string): boolean => DATE_RES.some((re) => re.test(String(s || '').trim()));

const isMarkerCell = (s: string) => /^(DR|CR)\.?$/i.test(String(s || '').trim());
const cell = (r: string[], i: number | null | undefined) => (i == null ? '' : (r[i] || '').trim());

// ---- the solver ------------------------------------------------------------

const frac = (n: number, d: number) => (d ? n / d : 0);

/** Find the column roles by testing which assignment makes the balance equation hold. */
export function solveLayout(grid: string[][]): ColumnRoles | null {
  if (!grid.length) return null;
  const nCols = Math.max(...grid.map((r) => r.length));
  if (nCols < 3) return null;

  // profile every column
  const prof = Array.from({ length: nCols }, (_, c) => {
    const cells = grid.map((r) => cell(r, c)).filter(Boolean);
    return {
      c,
      date: frac(cells.filter(looksLikeDate).length, cells.length),
      num: frac(cells.filter((s) => parseAmount(s) !== null).length, cells.length),
      marker: frac(cells.filter(isMarkerCell).length, cells.length),
      avgLen: frac(cells.reduce((a, s) => a + s.length, 0), cells.length),
      filled: cells.length,
    };
  });

  const dateCol = prof.filter((p) => p.date >= 0.5).sort((a, b) => b.date - a.date)[0];
  if (!dateCol) return null;

  // Data rows are the ones that actually start a transaction (they carry a date).
  const rows = grid.filter((r) => looksLikeDate(cell(r, dateCol.c)));
  if (rows.length < 3) return null;

  const numCols = prof.filter((p) => p.c !== dateCol.c && p.num >= 0.5 && p.marker < 0.5).map((p) => p.c);
  if (numCols.length < 2) return null;
  const markerCols = prof.filter((p) => p.marker >= 0.5).map((p) => p.c);

  const amt = (r: string[], c: number): Money | null => { const p = parseAmount(cell(r, c)); return p ? p.value : null; };
  const pairs = rows.length - 1;
  const need = Math.max(2, Math.ceil(pairs * 0.6)); // most rows must obey, not just a lucky few

  type Hyp = Omit<ColumnRoles, 'date' | 'narration' | 'ref'>;
  let best: Hyp | null = null;
  const keep = (h: Hyp) => { if (!best || h.score > best.score) best = h; };

  // Hypothesis A — separate debit + credit columns (the common case).
  // Ordered triples, so trying (d,c,b) AND (c,d,b) is what identifies which of the
  // two amount columns is debit vs credit. No bank knowledge required.
  for (const b of numCols) {
    for (const d of numCols) {
      if (d === b) continue;
      for (const c of numCols) {
        if (c === b || c === d) continue;
        let score = 0;
        for (let i = 1; i < rows.length; i++) {
          const prev = amt(rows[i - 1], b); const bal = amt(rows[i], b);
          if (prev == null || bal == null) continue;
          const deb = amt(rows[i], d) ?? 0; const cr = amt(rows[i], c) ?? 0;
          if (bal === prev - deb + cr) score++;
        }
        keep({ mode: 'debit-credit', balance: b, debit: d, credit: c, score, pairs });
      }
    }
  }

  // Hypothesis B — one signed amount column (+credit / −debit) + balance.
  for (const b of numCols) {
    for (const a of numCols) {
      if (a === b) continue;
      let score = 0;
      for (let i = 1; i < rows.length; i++) {
        const prev = amt(rows[i - 1], b); const bal = amt(rows[i], b); const v = amt(rows[i], a);
        if (prev == null || bal == null || v == null) continue;
        if (bal === prev + v) score++;
      }
      keep({ mode: 'signed', balance: b, amount: a, score, pairs });
    }
  }

  // Hypothesis C — one amount column + a Dr/Cr marker column (several Indian banks).
  for (const b of numCols) {
    for (const a of numCols) {
      if (a === b) continue;
      for (const m of markerCols) {
        let score = 0;
        for (let i = 1; i < rows.length; i++) {
          const prev = amt(rows[i - 1], b); const bal = amt(rows[i], b); const v = amt(rows[i], a);
          if (prev == null || bal == null || v == null) continue;
          const isDr = /^DR/i.test(cell(rows[i], m));
          if (bal === prev + (isDr ? -Math.abs(v) : Math.abs(v))) score++;
        }
        keep({ mode: 'marker', balance: b, amount: a, marker: m, score, pairs });
      }
    }
  }

  if (!best || (best as Hyp).score < need) return null;
  const win = best as Hyp;

  // Narration = the widest text column that isn't already spoken for.
  const used = new Set<number>([dateCol.c, win.balance, win.debit, win.credit, win.amount, win.marker].filter((x): x is number => x != null));
  const textCols = prof.filter((p) => !used.has(p.c) && p.num < 0.5 && p.date < 0.5 && p.filled > 0).sort((a, b) => b.avgLen - a.avgLen);
  const narration = textCols[0]?.c ?? -1;
  const ref = textCols[1]?.c ?? null;

  return { ...win, date: dateCol.c, narration, ref };
}

// ---- the public entry point ------------------------------------------------

/** Extract + verify transactions from an extracted grid. */
export function validate(grid: string[][]): Validation {
  const empty: Validation = {
    ok: false, roles: null, txns: [], verified: 0, total: 0,
    failures: [], opening: null, closing: null, totalDebit: 0, totalCredit: 0,
  };
  const roles = solveLayout(grid);
  if (!roles) return empty;

  const rows = grid.filter((r) => looksLikeDate(cell(r, roles.date)));
  const val = (r: string[], c: number | undefined): Money | null => {
    if (c == null) return null;
    const p = parseAmount(cell(r, c));
    return p ? p.value : null;
  };

  const txns: Txn[] = [];
  let prevBal: Money | null = null;
  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const balance = val(r, roles.balance);
    if (balance == null) continue;

    let debit: Money | null = null;
    let credit: Money | null = null;
    if (roles.mode === 'debit-credit') {
      const d = val(r, roles.debit); const c = val(r, roles.credit);
      debit = d ? Math.abs(d) : null;
      credit = c ? Math.abs(c) : null;
    } else if (roles.mode === 'signed') {
      const v = val(r, roles.amount);
      if (v != null) { if (v < 0) debit = -v; else credit = v; }
    } else {
      const v = val(r, roles.amount);
      if (v != null) { if (/^DR/i.test(cell(r, roles.marker!))) debit = Math.abs(v); else credit = Math.abs(v); }
    }

    const expected = prevBal == null ? null : prevBal - (debit ?? 0) + (credit ?? 0);
    // The first transaction has no predecessor, so it anchors the run rather than failing.
    const ok = expected == null ? true : expected === balance;

    txns.push({
      row: i, date: cell(r, roles.date), narration: cell(r, roles.narration),
      ref: roles.ref != null ? cell(r, roles.ref) : '',
      debit, credit, balance, ok, ...(ok ? {} : { expected: expected as Money }),
    });

    totalDebit += debit ?? 0;
    totalCredit += credit ?? 0;
    prevBal = balance;
  }

  if (!txns.length) return { ...empty, roles };

  const failures = txns.map((t, i) => (t.ok ? -1 : i)).filter((i) => i >= 0);
  const first = txns[0];
  // The balance BEFORE the first transaction — reported as the opening balance.
  const opening = first.balance + (first.debit ?? 0) - (first.credit ?? 0);

  return {
    ok: failures.length === 0,
    roles,
    txns,
    verified: txns.length - failures.length,
    total: txns.length,
    failures,
    opening,
    closing: txns[txns.length - 1].balance,
    totalDebit,
    totalCredit,
  };
}

/** Paise → "1,23,456.78" (Indian grouping — the audience is Indian CAs). */
export function formatINR(paise: Money): string {
  const neg = paise < 0;
  const s = Math.abs(paise).toString().padStart(3, '0');
  const rupees = s.slice(0, -2);
  const dec = s.slice(-2);
  // last 3 digits, then groups of 2 (lakh/crore convention)
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${neg ? '-' : ''}${grouped}.${dec}`;
}
