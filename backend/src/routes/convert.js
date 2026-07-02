// Server-side document conversion (PDF -> Word) via LibreOffice headless.
// This is DailyDesk's first server-processed tool: the file is converted and
// IMMEDIATELY deleted — no storage, no logging of contents (the honest
// "processed on our servers, then deleted" tier from /security).
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const router = express.Router();

const MAX_BYTES = 50 * 1024 * 1024; // conversion cap (LibreOffice memory)
const TIMEOUT_MS = 120 * 1000;

// Stricter than the global limiter: conversions cost real CPU.
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many conversions — please try again in a few minutes.' },
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `ddconv-${crypto.randomBytes(8).toString('hex')}.pdf`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    cb(ok ? null : new Error('not-a-pdf'), ok);
  },
});

// LibreOffice mangles shared profiles under concurrency — give each run its
// own profile dir and keep at most 2 conversions in flight.
let inFlight = 0;
const MAX_CONCURRENT = 2;

function cleanup(paths) {
  for (const p of paths) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

router.post('/pdf-to-word', (req, res) => {
  if (inFlight >= MAX_CONCURRENT) {
    res.status(503).json({ error: 'busy', message: 'The converter is busy right now — try again in a moment.' });
    return;
  }
  upload.single('file')(req, res, (upErr) => {
    if (upErr) {
      const tooBig = upErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'too-large' : 'bad-upload', message: tooBig ? 'PDF is over the 50 MB conversion limit.' : 'Please upload a PDF file.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'no-file', message: 'Please upload a PDF file.' });
      return;
    }
    const input = req.file.path;
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddout-'));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddlo-'));
    const toClean = [input, outDir, profile];
    inFlight++;
    execFile(
      'soffice',
      [
        '--headless', '--norestore', '--nolockcheck',
        `-env:UserInstallation=file://${profile}`,
        '--infilter=writer_pdf_import',
        '--convert-to', 'docx:MS Word 2007 XML',
        '--outdir', outDir,
        input,
      ],
      { timeout: TIMEOUT_MS },
      (err) => {
        inFlight--;
        const produced = fs.existsSync(outDir) ? fs.readdirSync(outDir).find((f) => f.endsWith('.docx')) : null;
        if (err || !produced) {
          cleanup(toClean);
          res.status(422).json({ error: 'convert-failed', message: 'Could not convert this PDF. Password-protected or damaged files can’t be converted — unlock it first if it has a password.' });
          return;
        }
        const outPath = path.join(outDir, produced);
        const base = (req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(base)}.docx"`);
        const stream = fs.createReadStream(outPath);
        stream.pipe(res);
        stream.on('close', () => cleanup(toClean)); // delete IMMEDIATELY after send
        stream.on('error', () => { cleanup(toClean); res.destroy(); });
      },
    );
  });
});

module.exports = router;
