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
const { isCanaryReq } = require('../utils/canary');
const { trackEvent } = require('../utils/trackEvent');
const jwt = require('jsonwebtoken');
const db = require('../db');
const redis = require('../utils/redis');

const router = express.Router();

const MAX_BYTES = 50 * 1024 * 1024; // conversion cap (LibreOffice memory)
const TIMEOUT_MS = 120 * 1000;

// Free tier gets a small DAILY allowance of server conversions (they cost real
// CPU); Pro is unlimited. Keyed by client IP so it works for anonymous free users
// too (the free tier needs no signup). Pro is read from an optional Bearer token.
const FREE_DAILY = Number(process.env.FREE_DAILY_CONVERSIONS || 3);

// The canary (x-canary token, see utils/canary.js) is a health probe, not a user,
// so it bypasses BOTH rate limiters below AND the daily quota — otherwise it meters
// itself, hits 429, and false-alarms the tool. See docs/canary-and-rate-limits.md.

async function planOf(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null; // anonymous → free path
  try {
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    req._userId = decoded.userId; // captured for pro_used logging on success
    const { rows } = await db.query('SELECT plan FROM users WHERE id = $1', [decoded.userId]);
    return rows[0] ? rows[0].plan : null;
  } catch { return null; }
}

// Enforce the free daily cap (Pro bypasses). Runs after the burst limiter and
// FAILS OPEN on any Redis/DB hiccup so infra trouble never blocks conversions.
async function dailyQuota(req, res, next) {
  if (isCanaryReq(req)) return next(); // health probe, not a user — never metered
  let plan = null;
  try { plan = await planOf(req); } catch { plan = null; }
  if (plan === 'pro') { req.isPro = true; return next(); }
  if (redisDown()) return next();
  const day = new Date().toISOString().slice(0, 10); // UTC calendar day
  const key = `conv:day:${clientKey(req)}:${day}`;
  try {
    const used = Number(await redis.get(key)) || 0;
    if (used >= FREE_DAILY) {
      return res.status(429).json({
        error: 'daily-limit',
        limit: FREE_DAILY,
        message: `You've used your ${FREE_DAILY} free document conversions for today.`,
      });
    }
    req._convKey = key; // counted only once the conversion actually succeeds
  } catch { /* fail open */ }
  return next();
}

// Stricter than the global limiter: conversions cost real CPU.
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: clientKey,
  store: makeStore('rl:convert:'),
  skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'Too many conversions — please try again in a few minutes.' },
}));
// Free daily quota (Pro unlimited) — after the burst limiter, before the routes.
router.use(dailyQuota);

const OFFICE_RE = /\.(docx?|odt|rtf|txt|html?|xlsx?|ods|csv|pptx?|odp)$/i;

// (CANARY_TOKEN / isCanaryReq are defined at the top — the canary bypasses the
// kill-switch as well as the rate limits so it never meters itself.)

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
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
};

// A run recipe: either LibreOffice (sofficeArgs) or a custom engine (buildCmd,
// e.g. Ghostscript for PDF/A). buildCmd({input, outDir, profile, outName})
// returns { cmd, args } and MUST write its output into outDir as *.<outExt>.
function convertRoute({ upload, sofficeArgs, buildCmd, outExt, failMessage, slugFor }) {
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
      const isCanary = isCanaryReq(req);
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
      const run = buildCmd
        ? buildCmd({ input, outDir, profile, outName: `out.${outExt}` })
        : {
            cmd: 'soffice',
            args: ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${profile}`, ...sofficeArgs, '--outdir', outDir, input],
          };
      execFile(
        run.cmd,
        run.args,
        { timeout: TIMEOUT_MS },
        (err) => {
          inFlight--;
          const produced = fs.existsSync(outDir) ? fs.readdirSync(outDir).find((f) => f.endsWith(`.${outExt}`)) : null;
          if (err || !produced) {
            cleanup(toClean);
            res.status(422).json({ error: 'convert-failed', message: failMessage });
            return;
          }
          // Count this SUCCESSFUL conversion against the free daily quota (Pro
          // requests have no _convKey). TTL 26h cleans up the per-day key.
          if (req._convKey) redis.pipeline().incr(req._convKey).expire(req._convKey, 93600).exec().catch(() => {});
          // A Pro subscriber running a server conversion = a Pro feature actually
          // used (they'd be capped at 3/day otherwise) — mark it for refund checks.
          if (req.isPro) trackEvent(req, 'pro_used', { module: slug, userId: req._userId });
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

// PDF -> editable PowerPoint. LibreOffice imports each PDF page as a slide via
// the Impress PDF filter (text/vectors kept as editable objects where it can).
router.post('/pdf-to-powerpoint', convertRoute({
  upload: makeUpload('pdf'),
  sofficeArgs: ['--infilter=impress_pdf_import', '--convert-to', 'pptx:Impress MS PowerPoint 2007 XML'],
  outExt: 'pptx',
  slugFor: '/pdf-to-powerpoint',
  failMessage: 'Could not convert this PDF to PowerPoint. Password-protected or damaged files can’t be converted.',
}));

// PDF -> PDF/A-2b (archival). Ghostscript is the correct engine; it rewrites the
// file to the ISO 19005-2 profile so it opens identically for decades. The
// output lands in outDir as out.pdf so the shared success path picks it up.
router.post('/pdf-to-pdfa', convertRoute({
  upload: makeUpload('pdf'),
  buildCmd: ({ input, outDir, outName }) => ({
    cmd: 'gs',
    args: [
      '-dPDFA=2', '-dBATCH', '-dNOPAUSE', '-dSAFER', '-dQUIET',
      '-sColorConversionStrategy=RGB', '-sDEVICE=pdfwrite',
      '-dPDFACompatibilityPolicy=1',
      `-sOutputFile=${path.join(outDir, outName)}`, input,
    ],
  }),
  outExt: 'pdf',
  slugFor: '/pdf-to-pdfa',
  failMessage: 'Could not convert this PDF to PDF/A. Encrypted files must be unlocked first.',
}));

module.exports = router;
