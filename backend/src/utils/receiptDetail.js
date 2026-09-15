'use strict';

/**
 * Sanitising the receipt breakdown that the budget tracker stores alongside an
 * expense.
 *
 * Lives apart from the route so it can be exercised directly — this is the
 * piece that decides what a browser is allowed to put in our database, and a
 * check that can only be run by standing up a server is a check nobody runs.
 */

// Control characters out, length capped, whitespace trimmed. Same rule the
// route applies to a hand-typed description, applied here to every string that
// came off a receipt.
const clean = (v, n) => String(v == null ? '' : v).replace(/\p{Cc}/gu, '').slice(0, n).trim();

// Money, to the cent, or nothing.
//
// The null/'' guard is not decoration: Number(null) and Number('') are both 0,
// so without it a line the scanner could not price would be stored as 0.00 and
// shown as a real, free item. "No amount" and "no charge" are different facts.
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/**
 * Rebuild the receipt breakdown from scratch, keeping only fields we name.
 *
 * This arrives as JSON from the browser and goes into a JSONB column, so it is
 * never stored as given. Copying an object the client sent would let anyone
 * park arbitrary data of arbitrary size in our database under the guise of a
 * receipt; building a new one field by field means what lands in the row is
 * exactly the shape this code knows about, with every string and array bounded.
 *
 * Returns null for anything that is not a usable breakdown, so a hand-typed
 * expense stores NULL rather than an empty husk.
 */
function sanitiseDetail(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const arr = (v) => (Array.isArray(v) ? v : []);
  const labelled = (v) => arr(v).slice(0, 40)
    .map((t) => ({ label: clean(t && t.label, 80), amount: num(t && t.amount) }))
    .filter((t) => t.label || t.amount != null);

  const detail = {
    merchantAddress: clean(raw.merchantAddress, 200) || null,
    time: clean(raw.time, 20) || null,
    currency: clean(raw.currency, 8) || null,
    lines: arr(raw.lines).slice(0, 200).map((l) => ({
      description: clean(l && l.description, 200),
      qty: num(l && l.qty),
      unitPrice: num(l && l.unitPrice),
      amount: num(l && l.amount),
    })).filter((l) => l.description || l.amount != null),
    subtotal: num(raw.subtotal),
    taxes: labelled(raw.taxes),
    discounts: labelled(raw.discounts),
    total: num(raw.total),
    payments: arr(raw.payments).slice(0, 10).map((p) => ({
      method: clean(p && p.method, 60),
      amount: num(p && p.amount),
      // Four digits, never more, whatever the client sends.
      last4: (clean(p && p.last4, 4).match(/\d{1,4}/) || [null])[0],
    })).filter((p) => p.method || p.amount != null),
    identifiers: arr(raw.identifiers).slice(0, 20).map((i) => ({
      label: clean(i && i.label, 60),
      value: clean(i && i.value, 120),
    })).filter((i) => i.label && i.value),
    verified: {
      totalAddsUp: typeof raw.verified?.totalAddsUp === 'boolean' ? raw.verified.totalAddsUp : null,
      linesAddUp: typeof raw.verified?.linesAddUp === 'boolean' ? raw.verified.linesAddUp : null,
    },
    source: raw.source === 'vision' || raw.source === 'ocr' ? raw.source : null,
  };

  // Nothing worth keeping? Say so, rather than storing an object full of nulls
  // that would make the UI offer a breakdown with nothing in it.
  const empty = !detail.lines.length && !detail.taxes.length && !detail.discounts.length
    && !detail.payments.length && !detail.identifiers.length
    && detail.subtotal == null && detail.total == null;
  return empty ? null : detail;
}

module.exports = { sanitiseDetail, clean };
