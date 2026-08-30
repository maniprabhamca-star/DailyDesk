// Receipt scanner (Pro) — read a receipt photo on the server and pull out the
// merchant, total and date so the user can save it to their Budget in one tap.
// The image is processed and deleted immediately (same honest server tier as
// OCR/conversions). Every field stays editable on the client — we present a best
// guess and never silently commit a number to someone's budget.
//
// ── Two paths, in order of accuracy ─────────────────────────────────────────
// 1. A vision model. Reading a creased thermal receipt photographed at an angle
//    under shop lighting is precisely the job a model does well and OCR plus
//    regular expressions does badly. Budget-guarded through the same aiBudget
//    caps as every other AI call, so it cannot run away on cost.
// 2. Tesseract plus utils/receiptParse. Runs when there is no API key, when AI
//    is switched off, when the budget is spent, or when the model call fails.
//
// The response says which path answered, so a bad result can be diagnosed
// instead of guessed at.
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { guard } = require('../utils/toolFlag');
const { isCanaryReq } = require('../utils/canary');
const { trackEvent } = require('../utils/trackEvent');
const db = require('../db');
const budget = require('../utils/aiBudget');
const { parseReceipt } = require('../utils/receiptParse');

const router = express.Router();

const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 40 * 1000;
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

router.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 40, keyGenerator: clientKey,
  store: makeStore('rl:receipt:'), skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Too many scans — try again in a few minutes.' },
}));
router.use(guard('/receipt-scanner'));

async function requirePro(req, res, next) {
  if (isCanaryReq(req)) return next();
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(402).json({ error: 'pro-required', message: 'The Receipt Scanner is a Pro feature.' });
  try {
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    req._userId = decoded.userId;
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [decoded.userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : '';
    req._isOwner = OWNER_EMAILS.includes(email);
    if (rows[0] && (rows[0].plan === 'pro' || req._isOwner)) return next();
    return res.status(402).json({ error: 'pro-required', message: 'The Receipt Scanner is a Pro feature.' });
  } catch { return res.status(401).json({ error: 'auth', message: 'Please sign in.' }); }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

// The categories the Budget tool accepts. Shared by both read paths so the two
// can never disagree about what a valid category is.
const CATS = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Fun', 'Home', 'Other'];

// ---- the vision path --------------------------------------------------------
const AI_URL = 'https://api.anthropic.com/v1/messages';
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
const AI_ENABLED = process.env.AI_ENABLED === 'true';
const AI_TIMEOUT_MS = 30 * 1000;

const VISION_SYSTEM = [
  'You read photographs of receipts and return every field the receipt actually shows.',
  'Receipts vary enormously by country, chain and terminal. Do not assume a layout — read what is printed.',
  '',
  'Return STRICT JSON only. No prose, no code fence:',
  '{',
  '  "merchant": string|null,',
  '  "merchantAddress": string|null,',
  '  "date": "YYYY-MM-DD"|null,',
  '  "time": "HH:MM"|null,',
  '  "currency": string|null,',
  '  "lines": [{"description": string, "qty": number|null, "unitPrice": number|null, "amount": number|null}],',
  '  "subtotal": number|null,',
  '  "taxes": [{"label": string, "amount": number}],',
  '  "discounts": [{"label": string, "amount": number}],',
  '  "total": number|null,',
  '  "payments": [{"method": string, "amount": number|null, "last4": string|null}],',
  '  "identifiers": [{"label": string, "value": string}],',
  '  "category": string|null,',
  '  "unreadable": boolean',
  '}',
  '',
  'Rules:',
  '- lines: EVERY purchased item, in the order printed. description is the item name as printed; amount is what that line cost. Leave qty or unitPrice null where the receipt does not show them. Do not invent a line and do not merge two into one.',
  '- Do NOT put subtotal, tax, total, tender, change or loyalty rows into lines. Each of those has its own field.',
  '- taxes: one entry per tax line, keeping the printed label (VAT, GST, CGST, SGST, TAX1, Sales Tax).',
  '- total is the FINAL amount the customer paid. Never a subtotal, never a single line, never a tender or change line.',
  '- payments: how it was settled. method is like Visa, Mastercard, Cash, Gift card, UPI. last4 is ONLY the last four digits of a masked card number. NEVER return a full card number — if more than four digits are visible, return only the last four.',
  '- identifiers: anything that uniquely marks this transaction — receipt, invoice, bill or order number, reference number, terminal or till ID, store number, auth or approval code, transaction ID. Keep the printed label. Skip loyalty balances and marketing codes.',
  '- Read the WHOLE receipt for identifiers, including the dense block printed BELOW the total and above the barcode, which is where most of them live. Capture every labelled code there, whatever the abbreviation and whether or not you recognise it: ST#, OP#, TE#, TR#, TC#, REF#, AID, APPR CODE, SEQ#, BATCH, INVOICE, AUTH, MID, POS. Keep the label exactly as printed and the value exactly as printed, digits and all. Different chains use different abbreviations for the same thing — do not restrict yourself to labels you have seen before, and do not drop one because you cannot tell what it means.',
  '- category must be exactly one of: Food, Transport, Bills, Shopping, Health, Fun, Home, Other.',
  '- If a value is genuinely unreadable, use null. Do NOT guess — a wrong number is worse than a missing one, because it gets saved into someone\u2019s records.',
  '- CRITICAL: only report what you can actually SEE in this image. Never fill in items, prices or a store that would be typical for this kind of receipt — a plausible invention is far worse than an empty result, because it looks correct and gets filed.',
  '- If the photograph is too blurred, too dark, cropped, or rotated such that you cannot read the lines with confidence, return every field as null or an empty array and set "unreadable": true. Returning nothing is the correct answer to an unreadable image.',
  '- Numbers must be plain JSON numbers: 35.11, not "$35.11".',
].join('\n');

/** Media type Anthropic will accept, sniffed from the bytes rather than trusted. */
function sniffMedia(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 3 && buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  return null;
}

/** Ask the model. Returns parsed fields, or null to fall through to OCR. */
async function readWithVision(buf, capKey, isOwner) {
  // routes/ai.js lets the owner through while AI_ENABLED is still false, so the
  // feature can be tested on production before it is turned on for everyone.
  // Matching that here matters: on prod today the key is set and AI_ENABLED is
  // not, so without this the vision path never runs at all.
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!AI_ENABLED && !isOwner) return null;
  const media = sniffMedia(buf);
  if (!media) return null;                       // HEIC etc — let OCR try instead
  if (buf.length > 5 * 1024 * 1024) return null; // over the API's image ceiling

  const cap = await budget.check(capKey, 1).catch(() => ({ ok: false }));
  if (!cap.ok) return null;                      // over budget: OCR still answers

  try {
    const r = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        // A ceiling, not a charge — you pay for what is generated, so a small
        // receipt costs the same whether this is 300 or 4000. It was 300, and a
        // Walmart shop with nine lines, two taxes, three tenders and five
        // reference numbers overran it: the JSON came back cut off mid-string,
        // JSON.parse threw, and the whole thing fell back to OCR, which returns
        // no line items at all. That looked exactly like "the feature does not
        // work". 4000 covers a 40-line shop with room to spare.
        max_tokens: 4000,
        system: VISION_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } },
            { type: 'text', text: 'Read this receipt.' },
          ],
        }],
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!r.ok) { console.error('receipt vision', r.status); return null; }
    const data = await r.json();
    // Say WHY when it truncates. Without this a token overrun surfaces as an
    // opaque "Unterminated string in JSON", which is what hid the bug above.
    if (data.stop_reason === 'max_tokens') {
      console.error('receipt vision: hit max_tokens — the receipt is longer than the budget, raise it');
    }
    const usage = data.usage || {};
    await budget.record(capKey, usage.input_tokens || 0, usage.output_tokens || 0).catch(() => {});

    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    const json = text.replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/, '').trim();
    const out = JSON.parse(json);
    // The model told us it could not read the image. Believe it, and let OCR
    // try rather than presenting a guess as a reading.
    if (out && out.unreadable === true) {
      console.warn('receipt vision: image reported unreadable');
      return null;
    }

    const money = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7 ? v : null);
    const str = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

    const lineItems = Array.isArray(out.lines) ? out.lines.slice(0, 200).map((l) => ({
      description: str(l && l.description, 120) || '',
      qty: money(l && l.qty),
      unitPrice: money(l && l.unitPrice),
      amount: money(l && l.amount),
    })).filter((l) => l.description || l.amount != null) : [];

    const pairs = (arr, cap) => (Array.isArray(arr) ? arr.slice(0, cap).map((t) => ({
      label: str(t && t.label, 40) || '',
      amount: money(t && t.amount),
    })).filter((t) => t.label && t.amount != null) : []);

    // last4 ONLY, enforced here rather than trusted to the prompt. A model that
    // returned a full card number must not be able to put one in our response:
    // storing a PAN would drag this tool into PCI scope for no benefit, and four
    // digits is both what the receipt prints and all anyone needs to match a
    // line on their card statement.
    const payments = Array.isArray(out.payments) ? out.payments.slice(0, 6).map((pm) => {
      const digits = (str(pm && pm.last4, 32) || '').replace(/\D/g, '');
      return {
        method: str(pm && pm.method, 40) || '',
        amount: money(pm && pm.amount),
        last4: digits ? digits.slice(-4) : null,
      };
    }).filter((pm) => pm.method || pm.amount != null) : [];

    const identifiers = Array.isArray(out.identifiers) ? out.identifiers.slice(0, 20).map((i) => ({
      label: str(i && i.label, 40) || '',
      // An identifier field is a plausible hiding place for a card number, so
      // any long digit run is masked here too.
      value: (str(i && i.value, 60) || '').replace(/\b\d{13,19}\b/g, (m) => '\u2022\u2022\u2022\u2022 ' + m.slice(-4)),
    })).filter((i) => i.label && i.value) : [];

    const total = money(out.total) != null && out.total > 0 ? out.total : null;
    const subtotal = money(out.subtotal);
    const taxes = pairs(out.taxes, 10);
    const discounts = pairs(out.discounts, 10);
    const date = typeof out.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(out.date) && !Number.isNaN(Date.parse(out.date))
      ? out.date : null;

    // Does the receipt agree with itself? The same move as the bank statement
    // converter's balance check: a figure the document PROVES beats a figure we
    // merely read. Reported to the reader rather than kept to ourselves, so a
    // mismatch is something they can see and fix before saving.
    const taxSum = taxes.reduce((n, t) => n + t.amount, 0);
    const discSum = discounts.reduce((n, d) => n + Math.abs(d.amount), 0);
    const lineSum = lineItems.reduce((n, l) => n + (l.amount || 0), 0);
    const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.02;

    return {
      merchant: str(out.merchant, 60) || '',
      merchantAddress: str(out.merchantAddress, 120),
      date,
      time: typeof out.time === 'string' && /^\d{1,2}:\d{2}/.test(out.time) ? out.time.slice(0, 5) : null,
      currency: str(out.currency, 8),
      lines: lineItems,
      subtotal,
      taxes,
      discounts,
      total,
      payments,
      identifiers,
      verified: {
        totalAddsUp: subtotal != null && total != null ? near(subtotal + taxSum - discSum, total) : null,
        linesAddUp: lineItems.length > 0 && subtotal != null ? near(lineSum, subtotal) : null,
      },
      category: CATS.includes(out.category) ? out.category : 'Other',
    };
  } catch (e) {
    console.error('receipt vision failed:', e.message);
    return null;
  }
}

/**
 * Rotate the image upright in place, if tesseract's orientation detection says
 * it is not. Best-effort: any failure leaves the original alone, because a
 * sideways read is still better than no read.
 */
function autoRotate(imgPath) {
  return new Promise((resolve) => {
    execFile('tesseract', [imgPath, 'stdout', '--psm', '0', '-l', 'osd'], { timeout: 20000 }, (err, stdout) => {
      if (err) return resolve(false);
      const m = /Rotate:\s*(\d+)/i.exec(String(stdout || ''));
      const deg = m ? Number(m[1]) % 360 : 0;
      if (!deg) return resolve(false);
      // ImageMagick rotates clockwise; tesseract reports the clockwise rotation
      // needed to make the page upright, so the number passes straight through.
      execFile('convert', [imgPath, '-rotate', String(deg), imgPath], { timeout: 20000 }, (cErr) => resolve(!cErr));
    });
  });
}

// POST /api/receipts/scan — image in, parsed fields + raw text out.
router.post('/scan', requirePro, (req, res) => {
  upload.single('image')(req, res, async (uErr) => {
    if (uErr) return res.status(uErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'upload', message: uErr.code === 'LIMIT_FILE_SIZE' ? 'Image is over the 12 MB limit.' : 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'no-file', message: 'Please add a receipt image.' });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-rcpt-'));
    const img = path.join(dir, 'r.png');
    const outBase = path.join(dir, 'out');
    const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } };
    try {
      // The model reads the photograph directly — no OCR step to lose detail in.
      const capKey = req._userId || clientKey(req);
      // Straighten it FIRST. Rotation used to happen only on the OCR fallback,
      // so the model was handed the sideways photograph — and a model given a
      // receipt it cannot read does not return nothing, it returns a plausible
      // receipt. A real scan came back with five identical apple juices and a
      // beef roast that were not on the slip at all, and the totals it invented
      // were internally consistent, so the arithmetic check passed and put a
      // green tick on fabricated data. That is the worst failure this tool has.
      fs.writeFileSync(img, req.file.buffer);
      const rotated = await autoRotate(img);
      const upright = rotated ? fs.readFileSync(img) : req.file.buffer;

      const seen = await readWithVision(upright, capKey, req._isOwner);
      if (seen && (seen.total != null || seen.merchant || seen.lines.length)) {
        // Payment details only when they were asked for. The model is told to
        // return at most four digits and that is enforced above, but the
        // stronger guarantee is not reading it back at all unless the person
        // ticked the box on the preview screen — an opt-in nobody set should
        // never produce card data in a response, however well redacted.
        if (String(req.body && req.body.cards) !== 'yes') seen.payments = [];
        clean();
        if (req._userId) trackEvent(req, 'pro_used', { module: '/receipt-scanner', userId: req._userId });
        trackEvent(req, 'receipt_scan', { module: '/receipt-scanner', userId: req._userId, source: 'vision' });
        return res.json({ ...seen, source: 'vision', text: '' });
      }

      // Fallback. The image on disk is already upright — it was straightened
      // above, before the vision attempt. --psm 6 treats it as one uniform block,
      // which is what a receipt is; the default page-segmentation mode assumes a
      // multi-column page and shuffles a narrow receipt's lines out of order.
      await new Promise((resolve, reject) => {
        execFile('tesseract', [img, outBase, '-l', 'eng', '--psm', '6', 'txt'], { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
          (err) => (err ? reject(err) : resolve()));
      });
      let text = '';
      try { text = fs.readFileSync(`${outBase}.txt`, 'utf8'); } catch { /* none */ }
      clean();
      if (!text.trim()) return res.status(422).json({ error: 'no-text', message: 'Couldn’t read any text — try a clearer, well-lit photo of the whole receipt.' });
      const parsed = parseReceipt(text);
      if (req._userId) trackEvent(req, 'pro_used', { module: '/receipt-scanner', userId: req._userId });
      trackEvent(req, 'receipt_scan', { module: '/receipt-scanner', userId: req._userId, source: 'ocr' });
      // Same SHAPE as the vision path so the client never has to branch on which
      // one answered. The empty arrays are the honest answer: reading individual
      // line items off OCR text across every receipt layout in the world is not
      // something regular expressions do, and inventing rows would be worse than
      // showing none.
      return res.json({
        ...parsed,
        merchantAddress: null, time: null, currency: null,
        lines: [], subtotal: null, taxes: [], discounts: [],
        payments: [], identifiers: [],
        verified: { totalAddsUp: null, linesAddUp: null },
        source: 'ocr',
        text: text.slice(0, 4000),
      });
    } catch (e) {
      clean();
      console.error('receipt scan:', e.message);
      return res.status(422).json({ error: 'ocr-failed', message: 'Could not scan this receipt — please try again with a clearer photo.' });
    }
  });
});

module.exports = router;
