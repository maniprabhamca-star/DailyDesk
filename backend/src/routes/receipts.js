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
  'You read photographs of retail receipts and return structured data.',
  'Return STRICT JSON only, no prose, no code fence:',
  '{"merchant": string|null, "total": number|null, "date": "YYYY-MM-DD"|null, "category": string|null, "currency": string|null}',
  '',
  'Rules:',
  '- total is the FINAL amount the customer paid: the grand total, amount payable or balance due. Never the subtotal, never a single line item, never a tax line.',
  '- If the total is genuinely unreadable, return null. Do NOT guess. A wrong number is worse than no number, because it gets saved to a budget.',
  '- Never return a phone number, GSTIN, VAT number, invoice number, card number or loyalty ID as the total.',
  '- merchant is the trading name only, without the address or the legal suffix.',
  '- date is the transaction date in YYYY-MM-DD. If the receipt shows an ambiguous numeric date, prefer the reading that is a valid date; if both are valid, assume day-first.',
  '- category must be exactly one of: Food, Transport, Bills, Shopping, Health, Fun, Home, Other.',
  '- currency is the symbol or ISO code printed on the receipt, or null.',
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
        max_tokens: 300,
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
    const usage = data.usage || {};
    await budget.record(capKey, usage.input_tokens || 0, usage.output_tokens || 0).catch(() => {});

    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    const json = text.replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/, '').trim();
    const out = JSON.parse(json);

    const total = typeof out.total === 'number' && Number.isFinite(out.total) && out.total > 0 && out.total < 1e7
      ? out.total : null;
    const date = typeof out.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(out.date) && !Number.isNaN(Date.parse(out.date))
      ? out.date : null;
    return {
      merchant: typeof out.merchant === 'string' ? out.merchant.slice(0, 60) : '',
      total,
      date,
      category: CATS.includes(out.category) ? out.category : 'Other',
      currency: typeof out.currency === 'string' ? out.currency.slice(0, 8) : null,
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
      const seen = await readWithVision(req.file.buffer, capKey, req._isOwner);
      if (seen && (seen.total != null || seen.merchant)) {
        clean();
        if (req._userId) trackEvent(req, 'pro_used', { module: '/receipt-scanner', userId: req._userId });
        trackEvent(req, 'receipt_scan', { module: '/receipt-scanner', userId: req._userId, source: 'vision' });
        return res.json({ ...seen, source: 'vision', text: '' });
      }

      // Fallback. --psm 6 treats the image as one uniform block, which is what a
      // receipt is; the default page-segmentation mode assumes a multi-column
      // page and shuffles a narrow receipt's lines out of order.
      fs.writeFileSync(img, req.file.buffer);
      // A till roll is long and thin, so people photograph it sideways. OCR of a
      // sideways receipt is not merely worse, it is noise — the owner's Walmart
      // slip came back with a merchant of "Aeqg AJeAFq 1SnN4" and no amount at
      // all. Ask tesseract which way is up, then rotate before reading.
      await autoRotate(img);
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
      return res.json({ ...parsed, currency: null, source: 'ocr', text: text.slice(0, 4000) });
    } catch (e) {
      clean();
      console.error('receipt scan:', e.message);
      return res.status(422).json({ error: 'ocr-failed', message: 'Could not scan this receipt — please try again with a clearer photo.' });
    }
  });
});

module.exports = router;
