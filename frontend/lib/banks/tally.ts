// Tally XML export — THE differentiator. Nearly every Indian CA runs Tally Prime,
// and not one competitor (DocuClipper, CapyParse, BankStatementLab) exports to it.
// Pure (no imports) so it's unit-testable headlessly.
//
// Shape of a Tally import file:
//   <ENVELOPE> → <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
//              → <BODY><IMPORTDATA><REQUESTDESC>… <REQUESTDATA><TALLYMESSAGE>…
// Each transaction becomes ONE voucher with TWO ledger entries that must sum to
// zero (double-entry):
//   money OUT of the bank → PAYMENT  : bank ledger credited, contra ledger debited
//   money INTO the bank   → RECEIPT  : bank ledger debited, contra ledger credited
//
// Tally's sign convention is the thing to get right: in <ALLLEDGERENTRIES.LIST>,
// AMOUNT is NEGATIVE for a debit and POSITIVE for a credit.
//
// ⚠ Structure is verified by our tests, but only a real Tally Prime import can
// confirm it loads — that's an owner check before launch (see the spec's risks).

import type { Txn, Money, Currency } from './balance';

export type TallyOpts = {
  company: string;        // must match the company name in Tally
  bankLedger: string;     // e.g. "SBI A/c 6789" — must already exist in Tally
  contraLedger: string;   // e.g. "Suspense" — where the other leg lands
  currency?: Currency;
};

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // Tally chokes on raw control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** Tally wants YYYYMMDD. Statements give DD/MM/YYYY, DD-MM-YY, "04 Jul 2026",
 *  or (US) "5/27" with no year at all — hence the fallback year. */
export function toTallyDate(raw: string, fallbackYear?: number): string | null {
  const s = String(raw || '').trim();
  const MONTHS: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  const yr = (y: number) => (y < 100 ? (y > 70 ? 1900 + y : 2000 + y) : y);
  const out = (y: number, m: number, d: number) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}${pad(m)}${pad(d)}` : null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);                      // 2026-07-04
  if (m) return out(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);           // DD/MM/YYYY
  if (m) return out(yr(+m[3]), +m[2], +m[1]);

  m = s.match(/^(\d{1,2})[\s\-]?([A-Za-z]{3})[\s\-]?'?(\d{2,4})$/);   // 04 Jul 2026
  if (m) { const mm = MONTHS[m[2].toUpperCase()]; return mm ? out(yr(+m[3]), mm, +m[1]) : null; }

  m = s.match(/^(\d{1,2})[/-](\d{1,2})$/);                           // 5/27 (US, M/D)
  if (m && fallbackYear) return out(fallbackYear, +m[1], +m[2]);

  m = s.match(/^(\d{1,2})\s([A-Za-z]{3})$/);                          // 27 May
  if (m && fallbackYear) { const mm = MONTHS[m[2].toUpperCase()]; return mm ? out(fallbackYear, mm, +m[1]) : null; }

  return null;
}

/** Minor units → Tally's plain decimal string (no grouping, no symbol). */
const amt = (minor: Money): string => (minor / 100).toFixed(2);

function ledgerEntry(name: string, minor: Money, isDebit: boolean): string {
  // Tally: NEGATIVE amount = debit, POSITIVE = credit.
  const signed = isDebit ? -Math.abs(minor) : Math.abs(minor);
  return `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${amt(signed)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
}

function voucher(t: Txn, o: TallyOpts, date: string, idx: number): string | null {
  const isPayment = (t.debit ?? 0) > 0;
  const value = isPayment ? (t.debit as Money) : (t.credit as Money);
  if (!value) return null; // nothing moved — not a voucher

  const type = isPayment ? 'Payment' : 'Receipt';
  const narration = [t.narration, t.ref].filter(Boolean).join(' | ');
  // Payment: money leaves the bank → bank CREDITED, contra DEBITED.
  // Receipt: money enters the bank → bank DEBITED, contra CREDITED.
  const entries = isPayment
    ? [ledgerEntry(o.contraLedger, value, true), ledgerEntry(o.bankLedger, value, false)]
    : [ledgerEntry(o.bankLedger, value, true), ledgerEntry(o.contraLedger, value, false)];

  return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${type}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${date}</DATE>
          <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${idx}</VOUCHERNUMBER>
          <NARRATION>${esc(narration)}</NARRATION>
          <PARTYLEDGERNAME>${esc(o.contraLedger)}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
${entries.join('\n')}
        </VOUCHER>
      </TALLYMESSAGE>`;
}

export type TallyResult = { xml: string; vouchers: number; skipped: number };

/** Build a Tally Prime–importable XML file from verified transactions. */
export function buildTallyXml(txns: Txn[], opts: TallyOpts): TallyResult {
  // A US statement's "5/27" has no year; take one from any fully-dated row.
  let fallbackYear: number | undefined;
  for (const t of txns) {
    const d = toTallyDate(t.date);
    if (d) { fallbackYear = +d.slice(0, 4); break; }
  }

  const messages: string[] = [];
  let skipped = 0;
  let n = 1;
  for (const t of txns) {
    const date = toTallyDate(t.date, fallbackYear);
    if (!date) { skipped++; continue; }
    const v = voucher(t, opts, date, n);
    if (!v) { skipped++; continue; }
    messages.push(v);
    n++;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(opts.company)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${messages.join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return { xml, vouchers: messages.length, skipped };
}
