#!/usr/bin/env node
/**
 * Receipt parsing harness — no server, no OCR, no network.
 *
 * The fixtures are real receipt SHAPES, including the ones that made the old
 * parser return a phone number as the total. Run: node scripts/test-receipt-parse.js
 */

'use strict';
const { parseReceipt, findMerchant, findDate, findTotalDetailed } = require('../src/utils/receiptParse');
const { parseModelJson } = require('../src/utils/modelJson');

let pass = 0;
const fails = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; return; }
  fails.push(name + (detail ? ' — ' + detail : ''));
};
const eq = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ── 1. The failure that started this ────────────────────────────────────────
// A GSTIN and a phone number both hold numbers larger than the total. The old
// parser took the maximum anywhere in the text and returned the phone number.
{
  const t = `
CAFE COFFEE DAY
Shop 14, MG Road, Bengaluru 560001
GSTIN: 29AABCU9603R1ZM
Tel: 9845012345
Bill No: 100234
Date: 25/08/2026
------------------------
Cappuccino        1   180.00
Choco Muffin      2   240.00
------------------------
Sub Total             420.00
CGST 2.5%              10.50
SGST 2.5%              10.50
TOTAL                 441.00
Card ************4021
`;
  const r = parseReceipt(t);
  eq('cafe: total is the TOTAL line', r.total, 441);
  eq('cafe: merchant', r.merchant, 'CAFE COFFEE DAY');
  eq('cafe: date is day-first', r.date, '2026-08-25');
  eq('cafe: category', r.category, 'Food');
  check('cafe: NOT the phone number', r.total !== 9845012345, `got ${r.total}`);
  check('cafe: NOT the bill number', r.total !== 100234, `got ${r.total}`);
}

// ── 2. Sub-total must never win ──────────────────────────────────────────────
{
  const t = `BIG BAZAAR
Sub-total 1,250.00
Discount   -50.00
GRAND TOTAL 1,200.00
`;
  const r = parseReceipt(t);
  eq('grand total beats sub-total', r.total, 1200);
}

// ── 3. "TOTAL" alone, amount on the next line (narrow thermal print) ─────────
{
  const t = `RELIANCE FRESH
Milk 1L      58.00
Bread        45.00
TOTAL
103.00
`;
  const r = parseReceipt(t);
  eq('total on the following line', r.total, 103);
}

// ── 4. No decimals, currency marker present ──────────────────────────────────
{
  const t = `UBER INDIA
Trip fare Rs 240
Total Rs 240
14 Aug 2026
`;
  const r = parseReceipt(t);
  eq('no-decimal amount with currency', r.total, 240);
  eq('named month date', r.date, '2026-08-14');
  eq('transport category', r.category, 'Transport');
}

// ── 5. Quantities must not be read as money ──────────────────────────────────
{
  const t = `APOLLO PHARMACY
Qty 2  Paracetamol   30.00
Qty 12 Vitamin C     96.00
Total                126.00
`;
  const r = parseReceipt(t);
  eq('quantity is not an amount', r.total, 126);
  eq('health category', r.category, 'Health');
}

// ── 6. Unambiguous month-first dates ─────────────────────────────────────────
{
  eq('month-first when day > 12', parseReceipt('Store\nTotal 10.00\n08/25/2026').date, '2026-08-25');
  eq('day-first when day > 12', parseReceipt('Store\nTotal 10.00\n25/08/2026').date, '2026-08-25');
  eq('ISO date', parseReceipt('Store\nTotal 10.00\n2026-08-25').date, '2026-08-25');
  eq('rejects month 13', parseReceipt('Store\nTotal 10.00\n25/13/2026').date, null);
}

// ── 7. Returning NOTHING beats returning a guess ─────────────────────────────
// A receipt too damaged to read must not produce a number, because a wrong
// number gets saved to a budget while a blank one gets typed in correctly.
{
  const t = `
||||| |||| ||||||
GSTIN 29AABCU9603R1ZM
Tel 9845012345
Invoice No 100234
`;
  const r = parseReceipt(t);
  eq('unreadable receipt returns no total', r.total, null);
  check('and does not return an ID as the total', ![9845012345, 100234].includes(r.total));
}

// ── 8. Bottom-third fallback, when nothing says "total" ──────────────────────
{
  const t = `LOCAL KIRANA
Rice        120.00
Dal          90.00
Oil         180.00
            390.00
`;
  const r = parseReceipt(t);
  eq('falls back to the last amount at the bottom', r.total, 390);
}

// ── 9. The maximum-anywhere behaviour is gone for good ───────────────────────
{
  const t = `SHOP
Loyalty card 8888888888
Item 12.00
Total 12.00
`;
  const r = parseReceipt(t);
  eq('a big loyalty number never wins', r.total, 12);
}

// ── 10. Merchant selection skips address and tax noise ──────────────────────
{
  const r = parseReceipt(`TAX INVOICE
12 Brigade Road, Floor 3
HEALTHY BITES
Total 55.00
`);
  eq('skips "TAX INVOICE" and the address line', r.merchant, 'HEALTHY BITES');
}

// ── 11. THE REAL ONE — the Walmart slip the owner photographed ──────────────
// Transcribed from the actual receipt that came back with a garbled merchant
// and no amount at all. Two traps in it: the card-authorisation block prints
// "TOTAL PURCHASE" twice near the bottom, so a bottom-up search for "total"
// lands on 13.28 or 20.00 instead of the real 35.11 further up; and every
// tender line is money without being the total.
{
  const t = [
    'Walmart',
    '770-640-7225',
    '3100 JOHNSON FERRY RD',
    'MARIETTA GA 30062',
    'ST# 01766 OP# 009002 TE# 02 TR# 04011',
    'AQUAFINA 012000013110 F 7.47 R',
    'BAG GARLIC 070969002470 F 4.96 R',
    'MUSHROOMS 070475656780 F 3.84 R',
    'BELL PEPPERS 824660200320 F 2.97 R',
    'BULK LEMONS 000000040530 F',
    '3 AT 1 FOR 0.62 1.86 R',
    'CILANTRO 000000048890 F 0.93 R',
    'SL HNY WHEAT 072945601360 F 2.97 R',
    'TOMATO ROMA 000000040870 F',
    '3.37 lb. @ 1.00 lb. / 0.97 3.27 R',
    'RED ONION 000000040820 F',
    '3.46 lb. @ 1.00 lb. / 1.63 5.64 R',
    'SUBTOTAL 34.42',
    'TAX2 2.0000 % 0.69',
    'TOTAL 35.11',
    'GIFTCARD TEND 20.00',
    'REWARDS REDEMPTION 1.83',
    '2500 Citi ThankYou Points Redeemed',
    'MCARD TEND 13.28',
    'CHANGE DUE 0.00',
    'MASTERCARD- 8913 I 2 APPR#02516P',
    '13.28 TOTAL PURCHASE',
    'REF # 623700750200',
    'TERMINAL # 2204505S',
    '08/25/26 18:55:46',
    '20.00 TOTAL PURCHASE',
    '08/25/26 18:56:12',
  ].join('\n');
  const r = parseReceipt(t);
  eq('walmart: total is 35.11', r.total, 35.11);
  check('walmart: not the MCARD tender', r.total !== 13.28, 'got ' + r.total);
  check('walmart: not the giftcard tender', r.total !== 20, 'got ' + r.total);
  check('walmart: not the subtotal', r.total !== 34.42, 'got ' + r.total);
  eq('walmart: merchant', r.merchant, 'Walmart');
  eq('walmart: date', r.date, '2026-08-25');
  eq('walmart: groceries are Food', r.category, 'Food');
}

// ── 12. subtotal + tax verification beats "appears later in the text" ───────
{
  const t = [
    'SHOP',
    'SUBTOTAL 100.00',
    'TAX 5.00',
    'TOTAL 105.00',
    'CASH TEND 200.00',
    'CHANGE DUE 95.00',
  ].join('\n');
  const r = parseReceipt(t);
  eq('adds up beats appears-later', r.total, 105);
  check('cash tendered is not the total', r.total !== 200, 'got ' + r.total);
}

// -- The reply-shape failures that killed every vision read -----------------
// A $113.77 grocery receipt came back to the owner as "Rs 3, Transport, BY ae
// er ae". The model had read it correctly; the server threw the answer away.
// The old code assumed the whole reply was JSON and stripped a fence with
// `.replace(/```$/, '')`, which matches only at the very END of the string.
// Anything written after the closing brace left the fence and the prose
// attached, and JSON.parse died at the character after the object. Each case
// below is a reply shape that used to lose a receipt.
{
  const want = { merchant: 'Shivam Grocery', total: 113.77 };
  const obj = JSON.stringify(want);
  const fence = '```';

  const shapes = {
    'bare object': obj,
    'fenced': fence + 'json\n' + obj + '\n' + fence,
    'fenced with a sign-off AFTER the fence': fence + 'json\n' + obj + '\n' + fence + '\n\nLet me know if you want the line items!',
    'prose first, then the object': 'Here is the receipt:\n\n' + obj,
    'prose on both sides': 'Sure - reading it now.\n' + obj + '\nThat is the whole receipt.',
    'no fence, trailing note': obj + '\nNote: the date was faint.',
    'windows line endings': fence + 'json\r\n' + obj + '\r\n' + fence + '\r\n',
  };
  for (const name of Object.keys(shapes)) {
    let got = null;
    try { got = parseModelJson(shapes[name]); } catch (e) { got = { error: e.message }; }
    eq('reads a reply shaped as ' + name, got && got.total, want.total);
    eq('...and keeps the merchant (' + name + ')', got && got.merchant, want.merchant);
  }
}

// Braces are counted, not matched by regex, so punctuation inside a string
// cannot move the end of the object. A merchant really can be called this.
{
  const reply = JSON.stringify({ merchant: 'The {Brace} Cafe "Downtown"', total: 9.5, note: 'aisle 3}' }) + '\ndone';
  const got = parseModelJson(reply);
  eq('a brace inside a string does not end the object', got.total, 9.5);
  eq('an escaped quote does not end the string', got.merchant, 'The {Brace} Cafe "Downtown"');
  eq('a closing brace inside a string is ignored', got.note, 'aisle 3}');
}

// Nested objects: the first balanced run must be the WHOLE object, not the
// first inner one to close.
{
  const payload = { merchant: 'A', totals: { sub: 10, tax: 1 }, total: 11 };
  const got = parseModelJson(JSON.stringify(payload) + '\ntrailing');
  eq('nesting does not truncate the object', got.total, 11);
  eq('nested values survive', got.totals.tax, 1);
}

// A stray brace in the prose before the object costs an attempt, not the answer.
{
  const got = parseModelJson('I will use the schema {merchant, total} as asked.\n' + JSON.stringify({ merchant: 'B', total: 4 }));
  eq('a half-brace in prose does not block the real object', got.total, 4);
}

// The three failures must stay distinguishable in the log. Collapsing them is
// how this hid: "the detailed reader could not run" covered a parse bug for as
// long as nobody could tell it from a missing API key.
{
  const codeOf = (reply) => { try { parseModelJson(reply); return 'no-throw'; } catch (e) { return e.code; } };
  eq('a truncated object reports truncated', codeOf('{"merchant":"X","total":1'), 'truncated');
  eq('prose with no object reports absent', codeOf('I cannot read this image.'), 'absent');
  eq('an empty reply reports empty', codeOf('   '), 'empty');
  eq('a malformed object reports malformed', codeOf('{"a": 1,, }'), 'malformed');
  // And the reason must never carry the receipt into the server log.
  let msg = '';
  try { parseModelJson('{"merchant":"Shivam Grocery",,}'); } catch (e) { msg = e.message; }
  check('the log line does not quote the receipt', msg.indexOf('Shivam') < 0, msg);
}

// -- The screenshot: a $113.77 grocery receipt read as "Rs 3, Transport" -----
// Every field on that panel was wrong and every one of them was PRESENTED, in
// a form with a Save to Budget button. These three guards are why each of
// them no longer is. The inputs are what OCR actually produced.
{
  // The store name. OCR turned a header into fragments; the old check asked
  // only for three letters somewhere and half the line being letters, which
  // word-salad satisfies easily.
  eq('word-salad is not a shop name', findMerchant(['BY ae er ae', 'x']), '');
  eq('...nor are two-letter fragments', findMerchant(['ae er', 'oo']), '');
  // And nothing real is lost to the guard.
  eq('a real name still reads', findMerchant(['Shivam Grocery', '1012 Lower Roswell Road']), 'Shivam Grocery');
  eq('a short real name still reads', findMerchant(['Lidl']), 'Lidl');

  // The date. The receipt was from April; OCR produced digits that parsed as
  // tomorrow, and tomorrow was accepted and shown.
  const now = Date.parse('2026-11-18T00:00:00Z');
  eq('a receipt cannot be dated next week', findDate('Date: 25/11/2026', now), null);
  eq('nor tomorrow-plus-one', findDate('Date: 2026-11-20', now), null);
  // One day of slack, for a till clock in a timezone ahead of the phone.
  eq('today is fine', findDate('Date: 2026-11-18', now), '2026-11-18');
  eq('tomorrow is allowed as clock slack', findDate('Date: 2026-11-19', now), '2026-11-19');
  eq('a real past date is untouched', findDate('Date: 17/04/2026', now), '2026-04-17');

  // The total. A number scavenged from the bottom of unreadable text must not
  // arrive looking like a total the receipt proved.
  const guessed = findTotalDetailed(['Shivam Grocery', 'a 1.00', 'b 2.00', 'xx 3']);
  eq('a scavenged number is marked a guess', guessed.confidence, 'guess');
  const labelled = findTotalDetailed(['ITEM 5.00', 'GRAND TOTAL 113.77']);
  eq('a named total is marked labelled', labelled.confidence, 'labelled');
  eq('...and is the right number', labelled.total, 113.77);
  const checked = findTotalDetailed(['SUBTOTAL 111.46', 'Food Tax 2.19', 'Regular Tax 0.12', 'GRAND TOTAL 113.77']);
  eq('a total the receipt proves is marked checked', checked.confidence, 'checked');
  eq('...and is the right number', checked.total, 113.77);
  eq('nothing found says so', findTotalDetailed(['hello']).confidence, 'none');

  // Put together: the whole garbled read must not come back as a confident
  // answer any more.
  const r = parseReceipt(['BY ae er ae', 'oo ae', 'er 3'].join('\n'));
  eq('the garbled scan reports no merchant', r.merchant, '');
  check('the garbled scan does not claim a trustworthy total', r.totalConfidence !== 'checked' && r.totalConfidence !== 'labelled', r.totalConfidence);
}

console.log(`\nreceipt parsing: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('No fixture returns an identifier as the total.\n');
