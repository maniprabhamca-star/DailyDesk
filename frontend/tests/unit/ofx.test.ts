import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOfx, buildQbo, fitId, OfxError, type OfxOpts } from '@/lib/banks/ofx';
import type { Txn } from '@/lib/banks/balance';

// The contract for the OFX / QuickBooks Web Connect writer.
//
// Three of these are not style checks:
//
//  1. a .qbo cannot be produced without the user's own INTU.BID;
//  2. FITID is stable across exports, or importing the same statement twice
//     doubles somebody's books;
//  3. the sign convention — money out is negative — because an inverted sign
//     imports cleanly and is wrong in exactly the way nobody notices until
//     reconciliation.
//
// What these tests CANNOT do is prove QuickBooks or Xero accepts the file. Only
// a real import can. Same honest limit as the Tally writer.

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const OPTS: OfxOpts = {
  acctId: '••••6789',
  bankId: 'SBIN0001234',
  acctType: 'SAVINGS',
  currency: 'INR',
  org: 'State Bank of India',
  fid: 'SBIN',
  now: new Date(2026, 10, 24, 12, 0, 0),
};

const txn = (over: Partial<Txn>): Txn => ({
  row: 1,
  date: '04/07/2026',
  narration: 'UPI/DR/527123/PAYEE/BANK',
  ref: '',
  debit: null,
  credit: null,
  balance: null,
  ok: true,
  ...over,
});

const ROWS: Txn[] = [
  txn({ row: 1, date: '04/07/2026', narration: 'Opening purchase', debit: 123_45 }),
  txn({ row: 2, date: '06/07/2026', narration: 'Salary credit', credit: 50_000_00 }),
  txn({ row: 3, date: '05/07/2026', narration: 'ATM withdrawal', debit: 2_000_00 }),
];

describe('OFX — document shape', () => {
  it('writes an OFX 1.0.2 SGML header', () => {
    const { text } = buildOfx(ROWS, 'ofx', OPTS);
    expect(text.startsWith('OFXHEADER:100\n')).toBe(true);
    expect(text).toContain('DATA:OFXSGML');
    expect(text).toContain('VERSION:102');
    // A blank line separates the header block from <OFX>. Without it the file
    // is not parseable as OFX 1.x at all.
    expect(text).toMatch(/NEWFILEUID:NONE\n\n<OFX>/);
  });

  it('carries the account, institution and currency it was given', () => {
    const { text } = buildOfx(ROWS, 'ofx', OPTS);
    expect(text).toContain('<CURDEF>INR');
    expect(text).toContain('<BANKID>SBIN0001234');
    expect(text).toContain('<ACCTTYPE>SAVINGS');
    // The parser masks the account at read time and we never held the full
    // number; the export does not quietly invent one.
    expect(text).toContain('<ACCTID>');
    expect(text).not.toMatch(/<ACCTID>\s*\n/);
  });

  it('every aggregate it opens, it closes', () => {
    const { text } = buildOfx(ROWS, 'ofx', OPTS);
    for (const tag of ['OFX', 'SIGNONMSGSRSV1', 'SONRS', 'STATUS', 'FI', 'BANKMSGSRSV1',
      'STMTTRNRS', 'STMTRS', 'BANKACCTFROM', 'BANKTRANLIST', 'STMTTRN']) {
      const open = (text.match(new RegExp(`<${tag}>`, 'g')) ?? []).length;
      const close = (text.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
      expect(close, `${tag}: ${open} opened, ${close} closed`).toBe(open);
    }
  });

  it('spans the real date range, not the order rows happened to arrive in', () => {
    const { text } = buildOfx(ROWS, 'ofx', OPTS);
    expect(text).toContain('<DTSTART>20260704');
    expect(text).toContain('<DTEND>20260706');
  });
});

describe('OFX — ⚠ the sign convention', () => {
  it('money out is negative and money in is positive', () => {
    const { text } = buildOfx(ROWS, 'ofx', OPTS);
    expect(text).toContain('<TRNTYPE>DEBIT\n<DTPOSTED>20260704\n<TRNAMT>-123.45');
    expect(text).toContain('<TRNTYPE>CREDIT\n<DTPOSTED>20260706\n<TRNAMT>50000.00');
  });

  it('writes one transaction per row that moved money', () => {
    const { text, count } = buildOfx(ROWS, 'ofx', OPTS);
    expect(count).toBe(3);
    expect((text.match(/<STMTTRN>/g) ?? []).length).toBe(3);
  });
});

describe('OFX — ⚠ FITID is stable', () => {
  // Importing software dedupes on FITID. An id that moved between two exports
  // of the same PDF would double every transaction in somebody's books, and
  // nothing in our own product would look wrong.
  it('the same statement exported twice produces the same ids', () => {
    const a = buildOfx(ROWS, 'ofx', { ...OPTS, now: new Date(2026, 0, 1) });
    const b = buildOfx(ROWS, 'ofx', { ...OPTS, now: new Date(2027, 5, 9) });
    const ids = (s: string) => s.match(/<FITID>[^\n]+/g) ?? [];
    expect(ids(a.text)).toEqual(ids(b.text));
    expect(ids(a.text).length).toBe(3);
  });

  it('two rows never share an id, even when identical in every other way', () => {
    const same = [txn({ row: 1, debit: 100_00 }), txn({ row: 2, debit: 100_00 })];
    const { text } = buildOfx(same, 'ofx', OPTS);
    const ids = text.match(/<FITID>([^\n]+)/g) ?? [];
    expect(new Set(ids).size).toBe(2);
  });

  it('a different amount is a different id', () => {
    expect(fitId('20260704', -100, 'x', 0)).not.toBe(fitId('20260704', -101, 'x', 0));
  });

  // ⚠ The test above does NOT catch this on its own, which I found by trying:
  // sabotaging fitId with Date.now() left all three green, because two builds
  // in one test run land in the same millisecond. Comparing two outputs can
  // only prove determinism across whatever varied between them, and in-process
  // almost nothing does. So the real guard reads the function and refuses the
  // ingredients — the only form of it that fails when it should.
  it('nothing non-deterministic can reach the id', () => {
    const lib = src('lib/banks/ofx.ts');
    const fn = lib.slice(lib.indexOf('export function fitId'));
    const body = fn.slice(0, fn.indexOf('\n}')).replace(/\/\/[^\n]*/g, '');
    for (const bad of ['Date.now', 'Math.random', 'performance.now', 'new Date', 'crypto.randomUUID']) {
      expect(body.includes(bad), `fitId uses ${bad} — ids would move between exports`).toBe(false);
    }
    // And the caller must not quietly feed it one either.
    const caller = lib.slice(lib.indexOf('function transaction'));
    const upTo = caller.slice(0, caller.indexOf('\n}'));
    expect(/fitId\([^)]*(?:Date\.now|Math\.random)/.test(upTo)).toBe(false);
  });
});

describe('OFX — ⚠⚠ a .qbo cannot borrow somebody else’s bank', () => {
  // The whole point. Converter tools commonly default INTU.BID to a real
  // institution's id so the button works; that files a financial record under
  // a bank it did not come from. There is no default here and there must never
  // be one.
  it('refuses to build a .qbo without an institution id', () => {
    expect(() => buildOfx(ROWS, 'qbo', OPTS)).toThrow(OfxError);
    expect(() => buildOfx(ROWS, 'qbo', { ...OPTS, intuBid: '' })).toThrow(OfxError);
    expect(() => buildOfx(ROWS, 'qbo', { ...OPTS, intuBid: '   ' })).toThrow(OfxError);
    expect(() => buildOfx(ROWS, 'qbo', { ...OPTS, intuBid: 'wellsfargo' })).toThrow(OfxError);
  });

  it('builds one when the user supplies their own bank’s id', () => {
    const { text } = buildQbo(ROWS, { ...OPTS, intuBid: '1234' });
    expect(text).toContain('<INTU.BID>1234');
  });

  it('a plain OFX never carries the Intuit tag', () => {
    const { text } = buildOfx(ROWS, 'ofx', { ...OPTS, intuBid: '1234' });
    expect(text).not.toContain('INTU.BID');
  });

  // The guard against the fix somebody reaches for when the throw is annoying.
  it('no hard-coded institution id anywhere in the writer', () => {
    const lib = src('lib/banks/ofx.ts');
    const code = lib.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    // Only a default that supplies DIGITS is the bug. `intuBid ?? ''` is the
    // validation itself coercing undefined before testing it, which is the
    // opposite of a fallback — the first version of this guard flagged it and
    // would have pushed the next person to weaken the check instead.
    expect(code).not.toMatch(/intuBid\s*(?:\?\?|\|\|)\s*['"]\s*\d/);
    expect(code).not.toMatch(/<INTU\.BID>\d/);
  });
});

describe('OFX — escaping and encoding', () => {
  it('escapes the three SGML characters', () => {
    const { text } = buildOfx([txn({ narration: 'A & B <tag> "q"', debit: 1_00 })], 'ofx', OPTS);
    expect(text).toContain('A &amp; B &lt;tag&gt;');
    expect(text).not.toMatch(/<NAME>[^\n]*[<>&](?!amp;|lt;|gt;)/);
  });

  it('folds anything the declared USASCII header cannot hold', () => {
    // The header says USASCII/1252. Emitting a rupee sign or Devanagari after
    // declaring that would make the file lie about itself.
    const { text } = buildOfx([txn({ narration: '₹500 भुगतान café', debit: 500_00 })], 'ofx', OPTS);
    const line = (text.match(/<MEMO>[^\n]*/) ?? [''])[0];
    expect(line).toContain('Rs.500');
    expect(line).toMatch(/^[\x20-\x7E]*$/);
  });

  it('respects the OFX 1.x field lengths', () => {
    const long = 'X'.repeat(400);
    const { text } = buildOfx([txn({ narration: long, debit: 1_00 })], 'ofx', OPTS);
    const name = (text.match(/<NAME>([^\n]*)/) ?? [])[1] ?? '';
    const memo = (text.match(/<MEMO>([^\n]*)/) ?? [])[1] ?? '';
    expect(name.length).toBeLessThanOrEqual(32);
    expect(memo.length).toBeLessThanOrEqual(255);
  });
});

describe('OFX — rows it cannot write are reported, not dropped', () => {
  it('names the row and the reason', () => {
    const bad = [
      txn({ row: 7, date: 'not a date', debit: 1_00 }),
      txn({ row: 8, date: '04/07/2026', debit: null, credit: null }),
      txn({ row: 9, date: '04/07/2026', credit: 5_00 }),
    ];
    const { count, skipped } = buildOfx(bad, 'ofx', OPTS);
    expect(count).toBe(1);
    expect(skipped.map((s) => s.row)).toEqual([7, 8]);
    expect(skipped[0].why).toMatch(/date/);
    expect(skipped[1].why).toMatch(/amount/);
  });
});

describe('OFX — the published claim matches the product', () => {
  // ⚠ This is why the file exists. /pricing sold QBO and OFX as a Business
  // feature while the converter exported neither, and the workflow page said
  // it was "on the way". A claim on the page that takes money has to be a
  // claim the code can meet.
  it('the pricing page only promises QBO/OFX while the writer exists', () => {
    const pricing = src('app/pricing/page.tsx') + src('lib/pricing.ts');
    if (/QBO|OFX/i.test(pricing)) {
      expect(() => buildOfx(ROWS, 'ofx', OPTS)).not.toThrow();
      expect(src('components/tools/statement-converter-tool.tsx')).toContain('buildOfx');
    }
  });

  // Found by exporting a real statement through the UI, not by a test: six rows
  // went in and five came out, because the opening-balance line moves no money.
  // The writer reported it in `skipped` and the component threw that away, so
  // the loss would surface months later at reconciliation.
  it('the UI tells the user about rows the writer could not take', () => {
    const ui = src('components/tools/statement-converter-tool.tsx');
    expect(ui).toMatch(/const \{ text, count, skipped \} = buildOfx/);
    expect(ui).toContain('exportNote');
  });

  it('nothing still tells the reader QBO/OFX is coming later', () => {
    const wf = src('lib/statement-workflows.ts');
    const stale = [/QBO \/ OFX direct export coming next/i, /on the way/i, /are planned/i];
    for (const re of stale) expect(re.test(wf), `statement-workflows.ts still says: ${re}`).toBe(false);
  });
});
