// OFX and QuickBooks Web Connect (.qbo) export.
//
// ── Why this exists, and why it is not optional ─────────────────────────────
// /pricing sells "Export to Tally, QuickBooks (QBO) & OFX" as a Business
// feature, and the live changelog entry announcing the Business tier says the
// same. The converter exported Excel, CSV and Tally XML and nothing else, while
// lib/statement-workflows.ts told readers QBO/OFX was "on the way". The site
// contradicted itself and the half that takes money was the wrong half. This
// closes that, before anyone can be charged for it.
//
// ── ⚠⚠ THE CONSTRAINT THAT SHAPES THE WHOLE FILE: INTU.BID ──────────────────
// A .qbo file is OFX 1.0.2 SGML plus Intuit's <INTU.BID>, a numeric id for the
// financial institution. QuickBooks matches it against Intuit's own directory
// of participating institutions before it reads a single transaction, and an id
// we are not entitled to use produces either a rejected file or — worse — a
// successful import filed under somebody else's bank.
//
// Converter vendors routinely paper over this by defaulting to a real bank's id
// (3000 is the one that circulates). We do not, and the refusal is structural
// rather than a policy note: `buildQbo` takes `intuBid` and THROWS when it is
// missing or not 1–6 digits. There is no default and no fallback. Writing
// another institution's id into a document that did not come from them is
// misrepresenting where a financial record originated, and it is not ours to
// do on a user's behalf.
//
// The honest route, which the UI implements: the user reads the id out of a
// .qbo their own bank gives them and pastes it in. Most Indian banks are not in
// Intuit's directory at all and will never have one — so for them OFX, Excel or
// Tally is the answer, and the tool says that rather than inventing an id to
// make a button work.
//
// ── ⚠ What is verified here and what is not ─────────────────────────────────
// The tests pin the structure, the signs, the ordering, the escaping and the
// id stability. They CANNOT confirm that QuickBooks or Xero accepts the file —
// only a real import can, which is the same honest limit already recorded on
// the Tally writer. Do not let the green suite talk anyone out of that check.

import type { Txn, Money, Currency } from './balance';
// Deliberately the SAME date parser the Tally writer uses, not a second one.
// Both exports describe the same rows, and the day a statement row lands on is
// not something two files of ours are allowed to disagree about. It already
// returns YYYYMMDD, which is also what OFX wants.
import { toTallyDate } from './tally';

export type OfxFlavour = 'ofx' | 'qbo';

export type OfxOpts = {
  /** The account the statement belongs to. Defaults to the masked value the
   *  parser produced — real enough to file against, and we never had the full
   *  number in the first place (statement.ts masks at parse time). */
  acctId: string;
  /** Routing-style institution id. OFX requires one and has no Indian concept
   *  for it; the IFSC is the closest true thing we hold, so that is what goes
   *  in when we have it. */
  bankId: string;
  /** CHECKING or SAVINGS. Indian statements are overwhelmingly SAVINGS, US
   *  ones CHECKING; the caller decides rather than this file guessing. */
  acctType: 'CHECKING' | 'SAVINGS';
  currency: Currency;
  /** Shown as the institution name in the importing software. */
  org: string;
  /** Institution id within OFX itself. Free-form, unlike INTU.BID. */
  fid: string;
  /** ⚠ QBO only, and required there. Never defaulted. See the header. */
  intuBid?: string;
  /** Fixes "now" so a build is reproducible in tests. */
  now?: Date;
  /** Year to assume for statements that print a date with no year ("5/27"). */
  fallbackYear?: number;
};

export type OfxResult = {
  text: string;
  /** Transactions actually written. */
  count: number;
  /** Rows dropped, and why — surfaced in the UI rather than silently lost. */
  skipped: { row: number; why: string }[];
};

export class OfxError extends Error {}

/** OFX 1.x is SGML, not XML: `&` `<` `>` still have to go, but there are no
 *  numeric entities to rely on, so the safe set is the named three. Control
 *  characters are stripped for the same reason Tally strips them. */
const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** The header declares USASCII/1252, which is the combination QuickBooks
 *  Desktop has always been happiest with. Declaring it and then emitting a
 *  rupee sign or a Devanagari narration would make the file lie about itself,
 *  so anything outside Latin-1 is folded to ASCII here rather than at the edge.
 *  Currency is carried by <CURDEF>, so dropping the symbol loses nothing. */
const ascii = (s: string): string =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[₹]/g, 'Rs.')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clean = (s: string, max: number): string => esc(ascii(s)).slice(0, max);

/** Minor units → OFX's plain signed decimal. */
const amt = (minor: Money): string => (minor / 100).toFixed(2);

const stamp = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
  `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;

/** A transaction id that is stable across re-exports of the same statement.
 *
 *  This is the one field with consequences outside our own file: importing
 *  software dedupes on FITID, so an id that changed between two exports of the
 *  same PDF would silently double every transaction in somebody's books. It is
 *  therefore derived only from facts about the row — never from Date.now(), a
 *  random value, or array position alone.
 *
 *  FNV-1a, because it needs to be deterministic and short, not cryptographic. */
export function fitId(date: string, minor: Money, narration: string, seq: number): string {
  const basis = `${date}|${minor}|${ascii(narration).toUpperCase()}|${seq}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${date}${h.toString(16).padStart(8, '0')}`;
}

function transaction(t: Txn, date: string, seq: number): string {
  // OFX sign convention: money leaving the account is negative. Our rows carry
  // debit and credit in separate fields, so the sign is derived, never copied.
  const isDebit = (t.debit ?? 0) > 0;
  const value = isDebit ? (t.debit as Money) : (t.credit as Money);
  const signed = isDebit ? -Math.abs(value) : Math.abs(value);
  const narration = [t.narration, t.ref].filter(Boolean).join(' ');
  return [
    '<STMTTRN>',
    `<TRNTYPE>${isDebit ? 'DEBIT' : 'CREDIT'}`,
    `<DTPOSTED>${date}`,
    `<TRNAMT>${amt(signed)}`,
    `<FITID>${fitId(date, signed, narration, seq)}`,
    // NAME is capped at 32 in OFX 1.x, so the readable summary goes there and
    // the whole narration goes in MEMO, which holds 255.
    `<NAME>${clean(t.narration || (isDebit ? 'Debit' : 'Credit'), 32)}`,
    `<MEMO>${clean(narration, 255)}`,
    '</STMTTRN>',
  ].join('\n');
}

/**
 * Build an OFX 1.0.2 SGML document, or the QuickBooks Web Connect flavour of it.
 *
 * @throws OfxError when `flavour` is 'qbo' without a usable `intuBid`. That is
 *         deliberate and must not be softened into a default — see the header.
 */
export function buildOfx(txns: Txn[], flavour: OfxFlavour, o: OfxOpts): OfxResult {
  if (flavour === 'qbo' && !/^\d{1,6}$/.test(String(o.intuBid ?? '').trim())) {
    throw new OfxError(
      'A .qbo file carries your bank’s Intuit institution id, and we will not put somebody else’s in it. Take the id from a .qbo your bank gives you, or export OFX instead.',
    );
  }

  const skipped: OfxResult['skipped'] = [];
  const lines: string[] = [];
  const dates: string[] = [];
  let seq = 0;

  for (const t of txns) {
    const date = toTallyDate(t.date, o.fallbackYear);
    if (!date) {
      skipped.push({ row: t.row, why: 'the date on this row could not be read' });
      continue;
    }
    if (!(t.debit ?? 0) && !(t.credit ?? 0)) {
      skipped.push({ row: t.row, why: 'no amount moved on this row' });
      continue;
    }
    lines.push(transaction(t, date, seq++));
    dates.push(date);
  }

  dates.sort();
  const now = o.now ?? new Date();
  const dtStart = dates[0] ?? stamp(now).slice(0, 8);
  const dtEnd = dates[dates.length - 1] ?? dtStart;

  const head = [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    'SECURITY:NONE',
    'ENCODING:USASCII',
    'CHARSET:1252',
    'COMPRESSION:NONE',
    'OLDFILEUID:NONE',
    'NEWFILEUID:NONE',
    '',
  ].join('\n');

  const body = [
    '<OFX>',
    '<SIGNONMSGSRSV1>',
    '<SONRS>',
    '<STATUS>',
    '<CODE>0',
    '<SEVERITY>INFO',
    '</STATUS>',
    `<DTSERVER>${stamp(now)}`,
    '<LANGUAGE>ENG',
    '<FI>',
    `<ORG>${clean(o.org, 32)}`,
    `<FID>${clean(o.fid, 32)}`,
    '</FI>',
    // Intuit's extension, and the only line that differs between the two
    // flavours. Present only when the user supplied their own bank's id.
    ...(flavour === 'qbo' ? [`<INTU.BID>${clean(String(o.intuBid), 6)}`] : []),
    '</SONRS>',
    '</SIGNONMSGSRSV1>',
    '<BANKMSGSRSV1>',
    '<STMTTRNRS>',
    '<TRNUID>1',
    '<STATUS>',
    '<CODE>0',
    '<SEVERITY>INFO',
    '</STATUS>',
    '<STMTRS>',
    `<CURDEF>${clean(o.currency, 3).toUpperCase()}`,
    '<BANKACCTFROM>',
    `<BANKID>${clean(o.bankId, 32)}`,
    `<ACCTID>${clean(o.acctId, 32)}`,
    `<ACCTTYPE>${o.acctType}`,
    '</BANKACCTFROM>',
    '<BANKTRANLIST>',
    `<DTSTART>${dtStart}`,
    `<DTEND>${dtEnd}`,
    ...lines,
    '</BANKTRANLIST>',
    '</STMTRS>',
    '</STMTTRNRS>',
    '</BANKMSGSRSV1>',
    '</OFX>',
  ].join('\n');

  return { text: `${head}\n${body}\n`, count: lines.length, skipped };
}

/** Convenience wrapper so a caller cannot ask for a .qbo and forget the id. */
export function buildQbo(txns: Txn[], o: OfxOpts & { intuBid: string }): OfxResult {
  return buildOfx(txns, 'qbo', o);
}
