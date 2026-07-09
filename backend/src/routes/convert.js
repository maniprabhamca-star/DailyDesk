// Server-side document conversion via LibreOffice headless:
//   POST /api/convert/pdf-to-word    PDF  -> editable .docx
//   POST /api/convert/office-to-pdf  Word/Excel/PowerPoint (+ODF) -> PDF
// These are DailyDesk's server-processed tools: the file is converted and
// IMMEDIATELY deleted — no storage, no logging of contents (the honest
// "processed on our servers, then deleted" tier from /security).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { isDisabled } = require('../utils/toolFlag');

const router = express.Router();

const MAX_BYTES = 50 * 1024 * 1024; // conversion cap (LibreOffice memory)
const TIMEOUT_MS = 120 * 1000;

// Stricter than the global limiter: conversions cost real CPU.
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: clientKey,
  store: makeStore('rl:convert:'),
  skip: () => redisDown(),
  message: { error: 'Too many conversions — please try again in a few minutes.' },
}));

const OFFICE_RE = /\.(docx?|odt|rtf|txt|html?|xlsx?|ods|csv|pptx?|odp)$/i;

// Shared secret so the monitoring canary can probe a disabled tool to detect
// recovery. Set in the backend .env; empty = no bypass (canary just sees 503s).
const CANARY_TOKEN = process.env.CANARY_TOKEN || '';

function makeUpload(kind) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, os.tmpdir()),
      filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname || '') || (kind === 'pdf' ? '.pdf' : '.bin')).toLowerCase();
        cb(null, `ddconv-${crypto.randomBytes(8).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      const name = file.originalname || '';
      const ok = kind === 'pdf'
        ? file.mimetype === 'application/pdf' || /\.pdf$/i.test(name)
        : OFFICE_RE.test(name);
      cb(ok ? null : new Error('bad-type'), ok);
    },
  });
}

// LibreOffice mangles shared profiles under concurrency — give each run its
// own profile dir and keep at most 2 conversions in flight.
let inFlight = 0;
const MAX_CONCURRENT = 2;

function cleanup(paths) {
  for (const p of paths) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

function convertRoute({ upload, sofficeArgs, outExt, failMessage, slugFor }) {
  return (req, res) => {
    if (inFlight >= MAX_CONCURRENT) {
      res.status(503).json({ error: 'busy', message: 'The converter is busy right now — try again in a moment.' });
      return;
    }
    upload.single('file')(req, res, async (upErr) => {
      if (upErr) {
        const tooBig = upErr.code === 'LIMIT_FILE_SIZE';
        res.status(tooBig ? 413 : 400).json({
          error: tooBig ? 'too-large' : 'bad-upload',
          message: tooBig ? 'File is over the 50 MB conversion limit.' : 'That file type isn’t supported here.',
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'no-file', message: 'Please upload a file.' });
        return;
      }
      // Server-side kill switch: if an admin has disabled this tool, refuse here
      // too (so a direct API call can't bypass the hidden front-end button).
      // The canary sends x-canary so it can still test a disabled tool and learn
      // when it recovers (then it auto-re-enables it).
      const slug = typeof slugFor === 'function' ? slugFor(req.file) : slugFor;
      const isCanary = CANARY_TOKEN && req.headers['x-canary'] === CANARY_TOKEN;
      if (slug && !isCanary && (await isDisabled(slug))) {
        cleanup([req.file.path]);
        res.status(503).json({ error: 'tool-disabled', message: 'This tool is temporarily unavailable. Please try again later.' });
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
          ...sofficeArgs,
          '--outdir', outDir,
          input,
        ],
        { timeout: TIMEOUT_MS },
        (err) => {
          inFlight--;
          const produced = fs.existsSync(outDir) ? fs.readdirSync(outDir).find((f) => f.endsWith(`.${outExt}`)) : null;
          if (err || !produced) {
            cleanup(toClean);
            res.status(422).json({ error: 'convert-failed', message: failMessage });
            return;
          }
          const outPath = path.join(outDir, produced);
          const base = (req.file.originalname || `document.${outExt}`).replace(/\.[^.]+$/, '');
          res.setHeader('Content-Type', MIME[outExt] || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(base)}.${outExt}"`);
          const stream = fs.createReadStream(outPath);
          stream.pipe(res);
          stream.on('close', () => cleanup(toClean)); // delete IMMEDIATELY after send
          stream.on('error', () => { cleanup(toClean); res.destroy(); });
        },
      );
    });
  };
}

// office-to-pdf serves three front-end tools from one endpoint — pick the slug
// from the actual file so the kill switch can target each one independently.
function officeSlug(file) {
  const name = (file && file.originalname || '').toLowerCase();
  if (/\.(xlsx?|ods|csv)$/i.test(name)) return '/excel-to-pdf';
  if (/\.(pptx?|odp)$/i.test(name)) return '/powerpoint-to-pdf';
  if (/\.(html?|txt)$/i.test(name)) return '/html-to-pdf';
  return '/word-to-pdf'; // docx/doc/odt/rtf and default
}

router.post('/pdf-to-word', convertRoute({
  upload: makeUpload('pdf'),
  sofficeArgs: ['--infilter=writer_pdf_import', '--convert-to', 'docx:MS Word 2007 XML'],
  outExt: 'docx',
  slugFor: '/pdf-to-word',
  failMessage: 'Could not convert this PDF. Password-protected or damaged files can’t be converted — unlock it first if it has a password.',
}));

router.post('/office-to-pdf', convertRoute({
  upload: makeUpload('office'),
  sofficeArgs: ['--convert-to', 'pdf'],
  outExt: 'pdf',
  slugFor: officeSlug,
  failMessage: 'Could not convert this document. Password-protected or damaged files can’t be converted.',
}));

module.exports = router;
