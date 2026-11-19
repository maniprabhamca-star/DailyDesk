// Pulling merchant / total / date out of OCR'd receipt text.
//
// This is the FALLBACK path. The primary one is a vision model, because reading
// a crumpled thermal receipt is exactly the job a model is good at and regex is
// not. But the fallback still runs whenever the key is missing, the budget is
// spent, or the model call fails — so it has to be defensible on its own.
//
// ── What was wrong with the previous version ─────────────────────────────────
// It ended with `total = Math.max(...allNumbersInTheText)`. On a real receipt
// the largest number is almost never the total: it is a phone number, a GSTIN,
// an invoice number, a card number, a loyalty ID or a barcode. That single line
// is why the amount "never matched". Guessing the biggest number is worse than
// returning nothing, because a wrong number gets saved to someone's budget
// while a blank one gets typed in correctly.
//
// The rule now: return a total only when there is a reason to believe it.

const CATS = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Fun', 'Home', 'Other'];

// An amount, with or without decimals, with or without thousands separators.
// Requires either a decimal part or a currency marker nearby, checked by the
// caller — a bare "2" in "Qty 2" is not an amount.
const AMOUNT = /(?:^|[^\d.,])(\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d.,]*\d{5})/g;

const CURRENCY = /[₹$€£¥]|\b(?:rs\.?|inr|usd|eur|gbp|aed|sar)\b/i;

// Lines that are identifiers, not money. Each of these has been seen sitting on
// a receipt holding a number bigger than the total.
const ID_LINE = /\b(gst(in)?|vat|tin|pan|cin|tel|phone|mob(ile)?|contact|invoice\s*(no|#)|bill\s*(no|#)|order\s*(no|#)|receipt\s*(no|#)|card|acct|account|ref(erence)?|txn|terminal|batch|auth|rrn|barcode|serial)\b/i;

const toNum = (s) => {
  const n = parseFloat(String(s).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Every plausible money value on a line, ignoring identifier lines. */
function amountsOn(line) {
  if (ID_LINE.test(line)) return [];
  const out = [];
  const hasCurrency = CURRENCY.test(line);
  for (const m of line.matchAll(AMOUNT)) {
    const raw = m[1];
    const v = toNum(raw);
    if (v == null || v <= 0) continue;
    // A number with no decimal part and no currency marker is usually a
    // quantity, a line number or a date fragment.
    if (!raw.includes('.') && !hasCurrency) continue;
    // Receipts do not total in the millions. This also drops phone numbers and
    // long IDs that survived the line filter.
    if (v >= 1e7) continue;
    out.push(v);
  }
  return out;
}

/** SUBTOTAL and the tax lines, when the receipt prints them. */
function findSubtotalAndTax(lines) {
  let subtotal = null;
  let tax = 0;
  let sawTax = false;
  for (const l of lines) {
    if (subtotal == null && /\bsub[\s-]?total\b/i.test(l)) {
      const v = amountsOn(l);
      if (v.length) subtotal = v[v.length - 1];
      continue;
    }
    // "TAX2 2.0000 % 0.69" — the rate is not the amount, so take the last value.
    if (/\b(tax|vat|gst|cgst|sgst|igst)\b/i.test(l) && !/\btotal\b/i.test(l)) {
      const v = amountsOn(l).filter((n) => n < 1e5);
      if (v.length) { tax += v[v.length - 1]; sawTax = true; }
    }
  }
  return { subtotal, tax: sawTax ? tax : null };
}

/**
 * The total.
 *
 * Order of belief:
 *   0. subtotal + tax, when the receipt shows both AND a printed line agrees.
 *      This is the same idea as the bank statement converter's balance check:
 *      a figure the document proves is worth more than a figure we picked.
 *   1. a line that says GRAND TOTAL / AMOUNT PAYABLE / NET AMOUNT etc.
 *   2. a line that says TOTAL, ignoring SUB-TOTAL and the card-machine block
 *   3. the last money-looking value in the bottom third — totals sit at the end
 * and nothing at all if none of those hold.
 *
 * It also reports WHICH of those held, because they are not equally
 * believable and the caller was treating them as if they were. Step 3 is a
 * guess — "the last money value near the bottom" — and on a receipt OCR could
 * not really read, it happily returns a stray 3 from a $113.77 grocery bill.
 * That number then filled in an amount box with a Save to Budget button next
 * to it. A guess may be offered, but it must not be offered in the same voice
 * as a figure the receipt proves.
 */
function findTotalDetailed(lines) {
  const strong = /\b(grand\s*total|amount\s*(payable|due|paid)|net\s*(amount|payable)|total\s*due|balance\s*due|to\s*pay)\b/i;
  const weak = /\btotal\b/i;
  // Everything below is a line that contains the word "total" or a money value
  // and is NOT what the customer paid. The card-authorisation block at the
  // bottom of a US receipt is the worst offender: a Walmart slip prints
  // "TOTAL PURCHASE" twice, once per tender, and a naive bottom-up search for
  // "total" finds those instead of the real one further up.
  const notTotal = new RegExp([
    '\\bsub[\\s-]?total\\b',
    '\\btotal\\s*(qty|quantity|items?|savings?|discount|purchase)\\b',
    '\\btend(er(ed)?)?\\b',
    '\\bchange\\s*due\\b',
    '\\b(beg|end)\\s*bal\\b',
    '\\btran\\s*amt\\b',
    '\\bappr\\b|\\bterminal\\b|\\baid\\b|\\bref\\s*#',
    '\\bredemption\\b|\\bredeemed\\b|\\brewards?\\b|\\bgift\\s*card\\b',
  ].join('|'), 'i');

  // 0 — arithmetic beats pattern matching where the receipt gives us both.
  const { subtotal, tax } = findSubtotalAndTax(lines);
  if (subtotal != null && tax != null) {
    const computed = Math.round((subtotal + tax) * 100) / 100;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (notTotal.test(lines[i])) continue;
      for (const v of amountsOn(lines[i])) {
        if (Math.abs(v - computed) < 0.02) return { total: v, confidence: 'checked' }; // printed AND adds up
      }
    }
  }

  const pick = (re) => {
    // Search bottom-up: on a receipt with several matching lines the last one
    // is the one that settles the bill.
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (!re.test(l) || notTotal.test(l)) continue;
      const vals = amountsOn(l);
      if (vals.length) return vals[vals.length - 1];
      // "TOTAL" alone on its line, amount on the next — common on narrow prints.
      const next = lines[i + 1];
      if (next) {
        const nv = amountsOn(next);
        if (nv.length === 1) return nv[0];
      }
    }
    return null;
  };

  const labelled = pick(strong) ?? pick(weak);
  if (labelled != null) return { total: labelled, confidence: 'labelled' };

  // Last resort: the final money value in the bottom third of the receipt.
  // NOT the maximum anywhere — that is what produced phone numbers.
  const from = Math.max(0, Math.floor(lines.length * 0.66));
  for (let i = lines.length - 1; i >= from; i--) {
    const vals = amountsOn(lines[i]);
    if (vals.length) return { total: vals[vals.length - 1], confidence: 'guess' };
  }
  return { total: null, confidence: 'none' };
}

/** The number alone, for callers that only want the figure. */
function findTotal(lines) { return findTotalDetailed(lines).total; }

/** The store name: a wordy line near the top that is not an address or an ID. */
function findMerchant(lines) {
  const noise = /receipt|invoice|tax\b|gst|bill\b|www\.|https?:|@|tel|phone|mobile|order|table|cashier|welcome|thank|customer\s*copy|duplicate/i;
  const addressy = /\b(road|rd\.?|street|st\.?|lane|nagar|block|floor|sector|opp\.?|near|pin|zip|suite|ave|avenue)\b|\d{5,}/i;
  for (const l of lines.slice(0, 8)) {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    if (letters < 3) continue;
    if (letters / l.length < 0.5) continue;
    if (noise.test(l) || addressy.test(l)) continue;
    const cleaned = l.replace(/[^\w &'.-]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    // A store name contains at least one WORD. Without this, "BY ae er ae" —
    // what OCR made of a grocery receipt's header — passed every test above
    // (more than three letters, more than half letters, no address words) and
    // was shown to the owner as the shop they had just bought from. Requiring
    // one run of three or more letters costs no real name: "Shivam Grocery",
    // "Lidl", "CVS/pharmacy" all keep theirs, while noise made of one- and
    // two-letter fragments has nothing to offer.
    if (!/[A-Za-z]{3}/.test(cleaned)) continue;
    if (cleaned.length >= 3) return cleaned.slice(0, 60);
  }
  return '';
}

/** A date, only where it is actually a valid one. */
function findDate(text, now = Date.now()) {
  // `now` is injectable so the future check can be tested without waiting.
  const valid = (y, mo, d) => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    if (y < 2000 || y > 2100) return null;
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (Number.isNaN(Date.parse(iso))) return null;
    // You cannot hold a receipt for a purchase that has not happened. A real
    // scan came back dated tomorrow, from digits OCR had invented, and the
    // date box was filled in with it. One day of slack covers a till clock in
    // a timezone ahead of the phone reading it.
    const limit = new Date(now);
    limit.setUTCDate(limit.getUTCDate() + 1);
    if (Date.parse(iso) > limit.getTime()) return null;
    return iso;
  };

  // A date this function REFUSES has to leave the text, or the ambiguous
  // reader below finds the same digits and makes something worse of them:
  // "2026-11-20", rejected for being in the future, was re-read from its own
  // middle as 20-11-20 and returned as 2020-11-26. Cutting the span out keeps
  // the refusal, while any other date in the text still gets its turn.
  let rest = text;
  const without = (m) => rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);

  // Unambiguous first: a four-digit year leading.
  const ymd = rest.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const got = valid(+ymd[1], +ymd[2], +ymd[3]);
    if (got) return got;
    rest = without(ymd);
  }

  // "12 Aug 2026" / "Aug 12, 2026" — no day/month ambiguity at all.
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const named = rest.match(/(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]*(20\d{2})/i)
    || rest.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-]*(\d{1,2})[\s,-]*(20\d{2})/i);
  if (named) {
    const isDayFirst = /^\d/.test(named[1]);
    const d = +(isDayFirst ? named[1] : named[2]);
    const mo = MONTHS.indexOf((isDayFirst ? named[2] : named[1]).toLowerCase()) + 1;
    const got = valid(+named[3], mo, d);
    if (got) return got;
    rest = without(named);
  }

  // Ambiguous numeric. Day-first unless the first number cannot be a day, which
  // is the only evidence the text actually gives us.
  const dmy = rest.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    let [, a, b, y] = dmy;
    if (y.length === 2) y = '20' + y;
    const dayFirst = valid(+y, +b, +a);
    if (dayFirst && +a > 12) return dayFirst;      // 25/08 — can only be day-first
    const monthFirst = valid(+y, +a, +b);
    if (monthFirst && +b > 12) return monthFirst;  // 08/25 — can only be month-first
    return dayFirst || monthFirst;
  }
  return null;
}

function guessCategory(lower) {
  const hints = [
    // Grocery chains first, then what is actually in the basket. A Walmart slip
    // says nothing about "grocery" anywhere on it — it says AQUAFINA, MUSHROOMS,
    // BELL PEPPERS, CILANTRO, TOMATO, RED ONION. Matching the shop name alone
    // would file it under Shopping, and matching produce alone would miss a
    // receipt that is mostly barcodes.
    ['Food', /cafe|coffee|restaurant|food|kitchen|pizza|burger|bakery|grocery|supermarket|swiggy|zomato|dairy|bar\b|dine|walmart|kroger|aldi|costco|safeway|publix|whole\s*foods|trader\s*joe|tesco|sainsbury|lidl|d\s*mart|dmart|big\s*bazaar|reliance\s*fresh|more\s*megastore|spencer|nature'?s\s*basket|produce|onion|tomato|lemon|mushroom|cilantro|lettuce|banana|potato|garlic|\bmilk\b|\bbread\b|\beggs?\b/],
    ['Transport', /fuel|petrol|diesel|uber|ola|taxi|cab|metro|parking|toll|rapido|indian\s*oil|bharat\s*petroleum|hp\b/],
    ['Health', /pharmac|medical|clinic|hospital|chemist|apollo|diagnost|lab\b|dental/],
    ['Shopping', /store|retail|fashion|apparel|electronics|mall|lifestyle|myntra|amazon|flipkart/],
    ['Bills', /electricity|recharge|broadband|utility|\bbill\b|airtel|jio|vodafone|water\s*board/],
    ['Home', /hardware|furniture|paint|plumb|ikea|home\s*cent/],
    ['Fun', /cinema|movie|pvr|inox|theatre|game|netflix|spotify/],
  ];
  for (const [c, re] of hints) if (re.test(lower)) return c;
  return 'Other';
}

/** OCR text in, best-effort fields out. Any field may be null/''. */
function parseReceipt(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const category = guessCategory(String(text).toLowerCase());
  const { total, confidence } = findTotalDetailed(lines);
  return {
    merchant: findMerchant(lines),
    total,
    // How the total was arrived at: 'checked' (the receipt's own arithmetic
    // agrees), 'labelled' (a line named it), 'guess' (last money value near
    // the bottom) or 'none'. The caller decides what a guess is allowed to do.
    totalConfidence: confidence,
    date: findDate(String(text)),
    category: CATS.includes(category) ? category : 'Other',
  };
}

module.exports = { parseReceipt, findTotal, findTotalDetailed, findMerchant, findDate, guessCategory, amountsOn, CATS };
