#!/usr/bin/env node
/**
 * Receipt-breakdown sanitising harness — no server, no database, no network.
 *
 * sanitiseDetail is the only thing standing between a browser's JSON and a
 * JSONB column, so what it refuses matters more than what it keeps. The
 * fixtures below are mostly hostile: oversized arrays, a novel in a field meant
 * for a shop name, a card number where four digits belong, prototype pollution
 * dressed up as a receipt.
 *
 * Run: node scripts/test-budget-detail.js
 */

'use strict';
const { sanitiseDetail } = require('../src/utils/receiptDetail');

let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fails.push(name + (detail ? ' — ' + detail : ''));
};
const eq = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// A breakdown shaped like what the scanner actually produces, used as the base
// for the tampering tests below.
const good = () => ({
  merchantAddress: 'Shop 14, MG Road, Bengaluru 560001',
  time: '18:42',
  currency: 'INR',
  lines: [
    { description: 'Cappuccino', qty: 1, unitPrice: 180, amount: 180 },
    { description: 'Choco Muffin', qty: 2, unitPrice: 120, amount: 240 },
  ],
  subtotal: 420,
  taxes: [{ label: 'CGST 2.5%', amount: 10.5 }, { label: 'SGST 2.5%', amount: 10.5 }],
  discounts: [],
  total: 441,
  payments: [{ method: 'Card', amount: 441, last4: '4021' }],
  identifiers: [{ label: 'Bill No', value: '100234' }],
  verified: { totalAddsUp: true, linesAddUp: true },
  source: 'vision',
});

// ── 1. Nothing to keep means NULL, not an empty husk ────────────────────────
// A hand-typed expense sends no detail at all, and the budget list decides
// whether to offer a "Receipt" toggle by asking whether detail exists. An
// object full of nulls would put a toggle on every row that opens onto nothing.
{
  eq('null in, null out', sanitiseDetail(null), null);
  eq('undefined in, null out', sanitiseDetail(undefined), null);
  eq('a string is not a breakdown', sanitiseDetail('441.00'), null);
  eq('a number is not a breakdown', sanitiseDetail(441), null);
  eq('an array is not a breakdown', sanitiseDetail([{ amount: 1 }]), null);
  eq('an empty object has nothing worth storing', sanitiseDetail({}), null);
  eq('metadata alone is not a breakdown', sanitiseDetail({ currency: 'INR', time: '18:42' }), null);
  check('a bare total IS worth storing', sanitiseDetail({ total: 12 }) !== null);
  check('lines alone are worth storing', sanitiseDetail({ lines: [{ description: 'Tea', amount: 8 }] }) !== null);
}

// ── 2. A real breakdown survives intact ─────────────────────────────────────
// The point of the feature: what the scanner showed before saving is what the
// budget shows afterwards. If sanitising quietly dropped a field, the expense
// would open thinner than the scan and nobody would know why.
{
  const d = sanitiseDetail(good());
  check('a real breakdown is kept', !!d);
  eq('address kept', d.merchantAddress, 'Shop 14, MG Road, Bengaluru 560001');
  eq('currency kept', d.currency, 'INR');
  eq('all lines kept', d.lines.length, 2);
  eq('line description kept', d.lines[0].description, 'Cappuccino');
  eq('line qty kept', d.lines[1].qty, 2);
  eq('subtotal kept', d.subtotal, 420);
  eq('both tax lines kept', d.taxes.length, 2);
  eq('tax label kept', d.taxes[0].label, 'CGST 2.5%');
  eq('total kept', d.total, 441);
  eq('payment method kept', d.payments[0].method, 'Card');
  eq('identifier kept', d.identifiers[0].value, '100234');
  eq('arithmetic verdict kept', d.verified.totalAddsUp, true);
  eq('source kept', d.source, 'vision');
}

// ── 3. Only fields we name get through ──────────────────────────────────────
// The object is rebuilt rather than copied, so an unexpected key has nowhere to
// land. This is what stops a receipt being used as free storage.
{
  const d = sanitiseDetail({ ...good(), nastyBlob: 'x'.repeat(50000), __proto__: { polluted: true } });
  check('unknown key dropped', !('nastyBlob' in d));
  check('no prototype pollution', !('polluted' in {}));
  eq('known keys are exactly these', Object.keys(d).sort().join(','),
    'currency,discounts,identifiers,lines,merchantAddress,payments,source,subtotal,taxes,time,total,verified');
  const line = sanitiseDetail({ lines: [{ description: 'Tea', amount: 8, note: 'y'.repeat(9000) }] }).lines[0];
  eq('unknown key dropped inside a line too', Object.keys(line).sort().join(','), 'amount,description,qty,unitPrice');
}

// ── 4. Everything is bounded ────────────────────────────────────────────────
// A receipt has a size. A POST body does not, and a row that can be grown
// without limit is a denial-of-service with extra steps.
{
  const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const d = sanitiseDetail({
    merchantAddress: 'a'.repeat(5000),
    currency: 'c'.repeat(5000),
    lines: many(1000, (i) => ({ description: 'd'.repeat(5000), amount: i + 1 })),
    taxes: many(500, (i) => ({ label: 'VAT', amount: i })),
    discounts: many(500, (i) => ({ label: 'Off', amount: i })),
    payments: many(500, (i) => ({ method: 'Cash', amount: i })),
    identifiers: many(500, (i) => ({ label: 'Ref', value: String(i) })),
  });
  eq('address capped at 200', d.merchantAddress.length, 200);
  eq('currency capped at 8', d.currency.length, 8);
  eq('lines capped at 200', d.lines.length, 200);
  eq('line description capped at 200', d.lines[0].description.length, 200);
  eq('taxes capped at 40', d.taxes.length, 40);
  eq('discounts capped at 40', d.discounts.length, 40);
  eq('payments capped at 10', d.payments.length, 10);
  eq('identifiers capped at 20', d.identifiers.length, 20);
}

// ── 5. A card number is not a last4 ─────────────────────────────────────────
// The scanner is told to read the masked tail only, but the scanner is a model
// and the field arrives from a browser either way. Storing a full PAN because
// something upstream sent one would be our fault, not theirs.
{
  const last4 = (v) => sanitiseDetail({ total: 1, payments: [{ method: 'Card', last4: v }] }).payments[0].last4;
  eq('a full card number keeps four digits', last4('4111111111114021'), '4111');
  eq('a masked tail is kept', last4('4021'), '4021');
  eq('a masked string yields its digits', last4('****4021'), null);
  eq('letters are not a last4', last4('abcd'), null);
  eq('missing last4 is null', last4(undefined), null);
}

// ── 6. Numbers are numbers, or they are absent ──────────────────────────────
// A total of "four hundred" must not reach a page that will try to add it up.
{
  const d = sanitiseDetail({
    total: '441.005', subtotal: 'four hundred',
    lines: [{ description: 'Tea', amount: Infinity, qty: NaN, unitPrice: '8.999' }],
  });
  eq('numeric string parsed and rounded to cents', d.total, 441.01);
  eq('unparseable number becomes null', d.subtotal, null);
  eq('Infinity becomes null', d.lines[0].amount, null);
  eq('NaN becomes null', d.lines[0].qty, null);
  eq('unit price rounded to cents', d.lines[0].unitPrice, 9);
  const v = sanitiseDetail({ total: 1, verified: { totalAddsUp: 'yes', linesAddUp: false } }).verified;
  eq('a non-boolean verdict is not a verdict', v.totalAddsUp, null);
  eq('a real false verdict is kept', v.linesAddUp, false);
  eq('an invented source is dropped', sanitiseDetail({ total: 1, source: 'trust-me' }).source, null);
}

// ── 7. Empty rows do not become empty rows on screen ────────────────────────
{
  const d = sanitiseDetail({
    total: 10,
    lines: [{ description: '', amount: null }, { description: 'Tea', amount: 8 }],
    taxes: [{ label: '', amount: null }, { label: 'VAT', amount: 2 }],
    identifiers: [{ label: 'Ref', value: '' }, { label: 'Bill', value: '7' }],
  });
  eq('blank line dropped', d.lines.length, 1);
  eq('blank tax dropped', d.taxes.length, 1);
  eq('half-blank identifier dropped', d.identifiers.length, 1);
  const ctl = sanitiseDetail({ total: 1, identifiers: [{ label: 'Ref', value: 'A BC' }] });
  eq('control characters stripped', ctl.identifiers[0].value, 'ABC');
}

// ── 8. Sanitising twice changes nothing ─────────────────────────────────────
// The row is read back and re-sent by the budget page; a rule that trimmed a
// little more each pass would erode a stored receipt over time.
{
  const once = sanitiseDetail(good());
  const twice = sanitiseDetail(once);
  eq('idempotent', JSON.stringify(twice), JSON.stringify(once));
}

console.log(`\nbudget receipt detail: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('Nothing unbounded, unnamed, or unnumbered reaches the database.\n');
