// OCR — turn scanned pages into a searchable PDF + extracted text.
// License-clean: Tesseract only (Apache-2.0). Page rasterization is done
// client-side by pdf.js (Apache-2.0), so NO Ghostscript/Poppler (AGPL/GPL).
// The client sends page images; we run one Tesseract pass over all of them
// (`tesseract list.txt out pdf txt`) → a single multipage searchable PDF + text.
// Files are processed then IMMEDIATELY deleted — nothing stored.
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { guard } = require('../utils/toolFlag');

const router = express.Router();

// The client sends the document in BATCHES of pages (it rasterizes + streams so
// any size / page count works). These caps are PER BATCH, not per document.
const MAX_PAGES = 20;                       // pages per batch
const MAX_FILE_BYTES = 20 * 1024 * 1024;    // per page image
const MAX_TOTAL_BYTES = 90 * 1024 * 1024;   // per batch
const TIMEOUT_MS = 180 * 1000;
const MAX_CONCURRENT = 3;
let active = 0;

// Installed Tesseract language packs (keep in sync with the VPS + the frontend
// language list). Combine with '+' for mixed-language docs.
const LANGS = new Set(['eng', 'spa', 'fra', 'deu', 'por', 'ita', 'nld', 'rus', 'chi_sim', 'jpn', 'ara', 'hin']);
function safeLang(raw) {
  const parts = String(raw || 'eng').split('+').map((s) => s.trim()).filter((s) => LANGS.has(s));
  return parts.length ? parts.join('+') : 'eng';
}

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // batched: a large doc = many small requests
  keyGenerator: clientKey,
  store: makeStore('rl:ocr:'),
  skip: () => redisDown(),
  message: { error: 'Too many OCR requests — please try again in a few minutes.' },
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_PAGES },
});

// Server-side kill switch: refuse if an admin has disabled OCR (matches the
// hidden front-end button so a direct API call can't bypass it).
router.use(guard('/ocr-pdf'));

router.post('/', (req, res) => {
  upload.array('pages', MAX_PAGES)(req, res, async (uErr) => {
    if (uErr) return res.status(400).json({ error: uErr.code === 'LIMIT_FILE_SIZE' ? 'A page image is too large.' : 'Upload failed.' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No pages received.' });
    if (active >= MAX_CONCURRENT) return res.status(503).json({ error: 'Server busy — please retry in a moment.' });
    if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'Too much data — try fewer pages.' });

    active++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-ocr-'));
    const outBase = path.join(dir, 'out');
    try {
      const imgPaths = files.map((f, i) => {
        const p = path.join(dir, `p${String(i).padStart(4, '0')}.png`);
        fs.writeFileSync(p, f.buffer);
        return p;
      });
      const listPath = path.join(dir, 'list.txt');
      fs.writeFileSync(listPath, imgPaths.join('\n'));

      const lang = safeLang(req.body && req.body.lang);
      await new Promise((resolve, reject) => {
        execFile('tesseract', [listPath, outBase, '-l', lang, 'pdf', 'txt'],
          { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
          (err) => (err ? reject(err) : resolve()));
      });

      const pdf = fs.readFileSync(`${outBase}.pdf`);
      let text = '';
      try { text = fs.readFileSync(`${outBase}.txt`, 'utf8'); } catch { /* text optional */ }
      res.json({ pdf: pdf.toString('base64'), text, pages: files.length });
    } catch (err) {
      console.error('OCR error:', err.message);
      res.status(500).json({ error: 'OCR failed — please try a clearer scan or fewer pages.' });
    } finally {
      active--;
      fs.rm(dir, { recursive: true, force: true }, () => {});
    }
  });
});

module.exports = router;
