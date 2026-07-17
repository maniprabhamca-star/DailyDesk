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
  /** null on statements that only print a periodic "ending daily balance" (US banks)
   *  rather than a running balance on every row. */
  balance: Money | null;
  ok: boolean;            // its balance span reconciles
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
  // US statements print the day WITHOUT a year (the year lives in the statement
  // period header): "5/27", "12/3". A real Wells Fargo statement produced ZERO
  // recognised dates until this existed. Bounded to plausible month/day values so
  // it can't swallow arbitrary "1/2"-style fractions.
  /^(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])$/,       // 5/27 · 12/3
  /^\d{1,2}\s[A-Z]{3}$/i,                               // 27 May
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

  // ⚠ Profile the DATA ROWS ONLY, never the whole grid. A statement's letterhead
  // (bank name, address, IFSC, account number, period) sits in the same columns as
  // the transactions and would drag every ratio below threshold — an HDFC fixture
  // with 5 transactions under a 6-line letterhead scored 45% dates and was rejected
  // outright. So: find the date column by ABSOLUTE count first, use it to isolate
  // the transaction rows, then profile only those.
  const dateCounts = Array.from({ length: nCols }, (_, c) => ({
    c,
    n: grid.filter((r) => looksLikeDate(cell(r, c))).length,
  })).sort((a, b) => b.n - a.n);

  const dateCol = dateCounts[0];
  if (!dateCol || dateCol.n < 3) return null; // need a few real transactions to work with

  // Data rows = the ones that actually start a transaction (they carry a date).
  const rows = grid.filter((r) => looksLikeDate(cell(r, dateCol.c)));
  if (rows.length < 3) return null;

  const prof = Array.from({ length: nCols }, (_, c) => {
    const cells = rows.map((r) => cell(r, c)).filter(Boolean);
    return {
      c,
      num: frac(cells.filter((s) => parseAmount(s) !== null).length, cells.length),
      marker: frac(cells.filter(isMarkerCell).length, cells.length),
      avgLen: frac(cells.reduce((a, s) => a + s.length, 0), cells.length),
      filled: cells.length,
    };
  });

  const numCols = prof.filter((p) => p.c !== dateCol.c && p.num >= 0.5 && p.marker < 0.5).map((p) => p.c);
  if (numCols.length < 2) return null;
  const markerCols = prof.filter((p) => p.marker >= 0.5).map((p) => p.c);

  const amt = (r: string[], c: number): Money | null => { const p = parseAmount(cell(r, c)); return p ? p.value : null; };

  type Hyp = Omit<ColumnRoles, 'date' | 'narration' | 'ref'>;
  let best: Hyp | null = null;
  const keep = (h: Hyp) => { if (!best || h.score > best.score) best = h; };

  // Score a hypothesis by walking BALANCE ANCHORS — the rows that actually carry a
  // balance — and summing every amount in between.
  //
  // ⚠ Indian statements print a balance on EVERY row; US ones (Wells Fargo) print an
  // "Ending daily balance" on only SOME rows. Checking bal[i] against bal[i-1] works
  // for the first and silently fails the second. Anchoring generalises both: with a
  // balance on every row the span is one row and this reduces exactly to the per-row
  // check; with sparse balances it verifies per day instead. One rule, both layouts.
  const scoreChain = (balCol: number, split: (r: string[]) => { d: Money; c: Money }) => {
    const anchors: number[] = [];
    for (let i = 0; i < rows.length; i++) if (amt(rows[i], balCol) != null) anchors.push(i);
    if (anchors.length < 3) return { score: 0, pairs: 0 };
    let score = 0;
    for (let k = 1; k < anchors.length; k++) {
      const a = anchors[k - 1];
      const b = anchors[k];
      let d = 0; let c = 0;
      for (let i = a + 1; i <= b; i++) { const x = split(rows[i]); d += x.d; c += x.c; }
      if (amt(rows[b], balCol) === (amt(rows[a], balCol) as Money) - d + c) score++;
    }
    return { score, pairs: anchors.length - 1 };
  };

  // Hypothesis A — separate debit + credit columns (the common case).
  // Ordered triples, so trying (d,c,b) AND (c,d,b) is what identifies which of the
  // two amount columns is debit vs credit. No bank knowledge required.
  for (const b of numCols) {
    for (const d of numCols) {
      if (d === b) continue;
      for (const c of numCols) {
        if (c === b || c === d) continue;
        const { score, pairs } = scoreChain(b, (r) => ({ d: amt(r, d) ?? 0, c: amt(r, c) ?? 0 }));
        keep({ mode: 'debit-credit', balance: b, debit: d, credit: c, score, pairs });
      }
    }
  }

  // Hypothesis B — one signed amount column (+credit / −debit) + balance.
  for (const b of numCols) {
    for (const a of numCols) {
      if (a === b) continue;
      const { score, pairs } = scoreChain(b, (r) => {
        const v = amt(r, a) ?? 0;
        return v < 0 ? { d: -v, c: 0 } : { d: 0, c: v };
      });
      keep({ mode: 'signed', balance: b, amount: a, score, pairs });
    }
  }

  // Hypothesis C — one amount column + a Dr/Cr marker column (several Indian banks).
  for (const b of numCols) {
    for (const a of numCols) {
      if (a === b) continue;
      for (const m of markerCols) {
        const { score, pairs } = scoreChain(b, (r) => {
          const v = amt(r, a);
          if (v == null) return { d: 0, c: 0 };
          return /^DR/i.test(cell(r, m)) ? { d: Math.abs(v), c: 0 } : { d: 0, c: Math.abs(v) };
        });
        keep({ mode: 'marker', balance: b, amount: a, marker: m, score, pairs });
      }
    }
  }

  // Most anchors must obey, not just a lucky few.
  if (!best) return null;
  const win = best as Hyp;
  if (win.score < Math.max(2, Math.ceil(win.pairs * 0.6))) return null;

  // Narration = the widest text column that isn't already spoken for.
  const used = new Set<number>([dateCol.c, win.balance, win.debit, win.credit, win.amount, win.marker].filter((x): x is number => x != null));
  const textCols = prof.filter((p) => !used.has(p.c) && p.num < 0.5 && p.filled > 0).sort((a, b) => b.avgLen - a.avgLen);
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

  // Split a row into debit/credit under the solved layout.
  const split = (r: string[]): { debit: Money | null; credit: Money | null } => {
    if (roles.mode === 'debit-credit') {
      const d = val(r, roles.debit); const c = val(r, roles.credit);
      return { debit: d ? Math.abs(d) : null, credit: c ? Math.abs(c) : null };
    }
    const v = val(r, roles.amount);
    if (v == null) return { debit: null, credit: null };
    if (roles.mode === 'signed') return v < 0 ? { debit: -v, credit: null } : { debit: null, credit: v };
    return /^DR/i.test(cell(r, roles.marker!))
      ? { debit: Math.abs(v), credit: null }
      : { debit: null, credit: Math.abs(v) };
  };

  const txns: Txn[] = rows.map((r, i) => {
    const { debit, credit } = split(r);
    return {
      row: i,
      date: cell(r, roles.date),
      narration: cell(r, roles.narration),
      ref: roles.ref != null ? cell(r, roles.ref) : '',
      debit, credit,
      balance: val(r, roles.balance),   // may be null — sparse "ending daily balance"
      ok: true,                          // decided by the anchor walk below
    };
  });
  if (!txns.length) return { ...empty, roles };

  const totalDebit = txns.reduce((s, t) => s + (t.debit ?? 0), 0);
  const totalCredit = txns.reduce((s, t) => s + (t.credit ?? 0), 0);

  // Walk the balance anchors. Every row between two anchors belongs to that span:
  // if the span reconciles, those rows are verified together; if not, they're all
  // flagged (we can't tell WHICH row inside the span is wrong — saying so is honest).
  const anchors = txns.map((t, i) => (t.balance != null ? i : -1)).filter((i) => i >= 0);
  for (let k = 1; k < anchors.length; k++) {
    const a = anchors[k - 1];
    const b = anchors[k];
    let d = 0; let c = 0;
    for (let i = a + 1; i <= b; i++) { d += txns[i].debit ?? 0; c += txns[i].credit ?? 0; }
    const expected = (txns[a].balance as Money) - d + c;
    if (expected !== txns[b].balance) {
      txns[b].expected = expected;
      for (let i = a + 1; i <= b; i++) txns[i].ok = false;
    }
  }

  const failures = txns.map((t, i) => (t.ok ? -1 : i)).filter((i) => i >= 0);
  const firstAnchor = anchors[0];
  // The balance BEFORE the first transaction: unwind the first anchor's span.
  let opening: Money | null = null;
  if (firstAnchor != null) {
    let d = 0; let c = 0;
    for (let i = 0; i <= firstAnchor; i++) { d += txns[i].debit ?? 0; c += txns[i].credit ?? 0; }
    opening = (txns[firstAnchor].balance as Money) + d - c;
  }

  return {
    ok: failures.length === 0,
    roles,
    txns,
    verified: txns.length - failures.length,
    total: txns.length,
    failures,
    opening,
    closing: anchors.length ? (txns[anchors[anchors.length - 1]].balance as Money) : null,
    totalDebit,
    totalCredit,
  };
}

export type Currency = 'INR' | 'USD';

/** Minor units → "1,23,456.78" (Indian lakh/crore grouping — the core audience is
 *  Indian CAs). Use formatMoney() when the statement may not be INR. */
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

/** Minor units → "123,456.78" (Western thousands grouping). */
function formatWestern(cents: Money): string {
  const neg = cents < 0;
  const s = Math.abs(cents).toString().padStart(3, '0');
  const whole = s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${whole}.${s.slice(-2)}`;
}

/** Format money in the statement's OWN currency. Showing "₹2,034.57" on a Wells
 *  Fargo statement is simply wrong — and lakh grouping is wrong for USD too. */
export function formatMoney(minor: Money | null, cur: Currency = 'INR'): string {
  if (minor == null) return '—';
  return cur === 'INR' ? formatINR(minor) : formatWestern(minor);
}

export const currencySymbol = (cur: Currency): string => (cur === 'INR' ? '₹' : '$');

/** Guess the statement's currency from its text. Defaults to INR (the core market). */
export function detectCurrency(text: string): Currency {
  const t = (text || '').toUpperCase();
  const inr = (t.match(/₹|\bINR\b|\bRS\.?\b/g) || []).length;
  const usd = (t.match(/\$|\bUSD\b/g) || []).length;
  return usd > inr ? 'USD' : 'INR';
}
