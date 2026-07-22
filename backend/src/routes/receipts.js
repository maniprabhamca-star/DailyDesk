// Receipt scanner (Pro) — OCR a receipt photo on the server and pull out the
// merchant, total and date so the user can save it to their Budget in one tap.
// The image is processed and deleted immediately (same honest server tier as
// OCR/conversions). Parsing is heuristic and always editable on the client —
// we present best guesses, never silently commit a wrong number to someone's
// budget.
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
    if (rows[0] && (rows[0].plan === 'pro' || OWNER_EMAILS.includes(email))) return next();
    return res.status(402).json({ error: 'pro-required', message: 'The Receipt Scanner is a Pro feature.' });
  } catch { return res.status(401).json({ error: 'auth', message: 'Please sign in.' }); }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

// ---- receipt-text parsing ---------------------------------------------------
const CATS = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Fun', 'Home', 'Other'];
const NUM = /(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})|\d+\.\d{2})/g;
const toNum = (s) => parseFloat(String(s).replace(/[,\s]/g, ''));

function parseReceipt(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // Merchant: the first line that's mostly letters (store name), skipping obvious
  // address/phone/receipt noise.
  let merchant = '';
  for (const l of lines.slice(0, 6)) {
    const letters = (l.match(/[a-zA-Z]/g) || []).length;
    if (letters >= 3 && letters / l.length > 0.5 && !/receipt|invoice|tax|gst|www\.|tel|phone|\d{4,}/i.test(l)) {
      merchant = l.replace(/[^\w &'.-]/g, '').trim().slice(0, 60);
      break;
    }
  }

  // Total: prefer a line containing "total" (but not "subtotal"); else the
  // largest currency-looking amount in the text.
  let total = null;
  const totalLine = lines.filter((l) => /total/i.test(l) && !/sub[\s-]?total/i.test(l));
  for (const l of totalLine) {
    const m = l.match(NUM);
    if (m) { const v = toNum(m[m.length - 1]); if (Number.isFinite(v)) { total = v; break; } }
  }
  if (total == null) {
    const all = (text.match(NUM) || []).map(toNum).filter((v) => Number.isFinite(v) && v < 1e7);
    if (all.length) total = Math.max(...all);
  }

  // Date: common formats → YYYY-MM-DD.
  let date = null;
  const dm = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) || text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dm) {
    let y, mo, d;
    if (dm[1].length === 4) { [, y, mo, d] = dm; }
    else { [, d, mo, y] = dm; if (y.length === 2) y = '20' + y; }
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(iso))) date = iso;
  }

  // Category guess from keywords.
  let category = 'Other';
  const hints = [
    ['Food', /cafe|coffee|restaurant|food|kitchen|pizza|burger|bakery|grocery|mart|supermarket|hotel/],
    ['Transport', /fuel|petrol|diesel|uber|ola|taxi|cab|metro|parking|toll/],
    ['Health', /pharmacy|medical|clinic|hospital|chemist|apollo/],
    ['Shopping', /store|retail|fashion|apparel|electronics/],
    ['Bills', /electricity|recharge|broadband|utility|bill/],
  ];
  for (const [c, re] of hints) if (re.test(lower)) { category = c; break; }

  return { merchant, total, date, category: CATS.includes(category) ? category : 'Other' };
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
      fs.writeFileSync(img, req.file.buffer);
      await new Promise((resolve, reject) => {
        execFile('tesseract', [img, outBase, '-l', 'eng', 'txt'], { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
          (err) => (err ? reject(err) : resolve()));
      });
      let text = '';
      try { text = fs.readFileSync(`${outBase}.txt`, 'utf8'); } catch { /* none */ }
      clean();
      if (!text.trim()) return res.status(422).json({ error: 'no-text', message: 'Couldn’t read any text — try a clearer, well-lit photo of the whole receipt.' });
      const parsed = parseReceipt(text);
      if (req._userId) trackEvent(req, 'pro_used', { module: '/receipt-scanner', userId: req._userId });
      trackEvent(req, 'receipt_scan', { module: '/receipt-scanner', userId: req._userId });
      return res.json({ ...parsed, text: text.slice(0, 4000) });
    } catch (e) {
      clean();
      console.error('receipt scan:', e.message);
      return res.status(422).json({ error: 'ocr-failed', message: 'Could not scan this receipt — please try again with a clearer photo.' });
    }
  });
});

module.exports = router;
