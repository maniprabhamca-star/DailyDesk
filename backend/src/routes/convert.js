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
const { dailyQuota, countUse } = require('../utils/entitlement');
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

// The caller check and the daily allowance now live in utils/entitlement.js so
// OTHER routers can use them. They protected only this file before, which is
// how OCR — a separate router and a far more expensive endpoint — ended up
// with no meter at all.

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
router.use(dailyQuota({ limit: FREE_DAILY }));

const OFFICE_RE = /\.(docx?|odt|rtf|txt|html?|xlsx?|ods|csv|pptx?|odp|odg|fodt|fods|fodp)$/i;

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
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
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
          countUse(req);
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
  if (/\.(pptx?|odp|fodp)$/i.test(name)) return '/powerpoint-to-pdf';
  if (/\.(html?|txt)$/i.test(name)) return '/html-to-pdf';
  if (/\.odg$/i.test(name)) return '/odf-to-pdf'; // Draw has no MS-format sibling
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

// PDF -> the three formats people ask for when .docx is the wrong answer.
// All three go through the same Writer PDF import, so a PDF that converts to
// Word converts to these; the difference is only what LibreOffice writes out.
//
// RTF opens in anything, including the old software that will not take a .docx.
// HTML is for putting the contents on a page or into a CMS.
// ODT is the open format — LibreOffice, OpenOffice, and archival requirements
// that specify ODF rather than a Microsoft format.
const PDF_TO = [
  {
    slug: 'pdf-to-rtf',
    filter: 'rtf:Rich Text Format',
    ext: 'rtf',
    fail: 'Could not convert this PDF to RTF. Password-protected or damaged files can’t be converted — unlock it first if it has a password.',
  },
  {
    slug: 'pdf-to-odt',
    filter: 'odt:writer8',
    ext: 'odt',
    fail: 'Could not convert this PDF to ODT. Password-protected or damaged files can’t be converted — unlock it first if it has a password.',
  },
];

for (const { slug, filter, ext, fail } of PDF_TO) {
  router.post(`/${slug}`, convertRoute({
    upload: makeUpload('pdf'),
    sofficeArgs: ['--infilter=writer_pdf_import', '--convert-to', filter],
    outExt: ext,
    slugFor: `/${slug}`,
    failMessage: fail,
  }));
}

// Webpage -> PDF. The only endpoint here that takes a URL instead of a file,
// which makes it the only one with an SSRF surface — see utils/ssrfGuard.js for
// what that means and what is done about it. Chrome runs unprivileged with its
// sandbox on; see utils/renderer.js.
router.post('/webpage-to-pdf', express.json({ limit: '8kb' }), async (req, res) => {
  if (inFlight >= MAX_CONCURRENT) {
    return res.status(503).json({ error: 'busy', message: 'The capture service is busy right now — try again in a moment.' });
  }
  const slug = '/webpage-to-pdf';
  if (!isCanaryReq(req) && (await isDisabled(slug))) {
    return res.status(503).json({ error: 'tool-disabled', message: 'This tool is temporarily unavailable. Please try again later.' });
  }

  const { validateTarget } = require('../utils/ssrfGuard');
  const verdict = await validateTarget(req.body && req.body.url);
  if (!verdict.ok) {
    return res.status(400).json({ error: 'bad-url', message: verdict.reason });
  }

  const opts = {
    landscape: !!(req.body && req.body.landscape),
    background: !(req.body && req.body.background === false),
    format: ['A4', 'Letter', 'Legal', 'A3'].includes(req.body && req.body.format) ? req.body.format : 'A4',
    view: (req.body && req.body.view) === 'mobile' ? 'mobile' : 'desktop',
    singlePage: !!(req.body && req.body.singlePage),
  };

  // Opt-in progress. A capture can take half a minute — a cold Chrome start
  // alone is most of that — and a button that says "Opening the page…" for
  // thirty seconds reads as broken. When the client asks for it we stream one
  // JSON line per stage, then a sentinel, then the PDF bytes on the same
  // response. Single request, so it cannot land on the other cluster instance.
  //
  // Deliberately opt-in: the plain POST still answers with application/pdf, so
  // the health canary and anything else pointed at this endpoint is unaffected.
  const wantsStream = !!(req.body && req.body.stream);
  const sendStage = (stage, detail) => {
    if (!wantsStream || res.writableEnded) return;
    try { res.write(`${JSON.stringify({ stage, ...(detail ? { detail } : {}) })}\n`); } catch { /* client gone */ }
  };
  if (wantsStream) {
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-store');
    // Without this nginx buffers the whole response and the progress arrives
    // all at once at the end, which is worse than not sending it.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    sendStage('checking');
  }

  inFlight++;
  try {
    const { renderUrlToPdf } = require('../utils/renderer');
    const pdf = await renderUrlToPdf(verdict.url.toString(), opts, sendStage);

    countUse(req);
    if (req.isPro) trackEvent(req, 'pro_used', { module: slug, userId: req._userId });

    const base = (verdict.url.hostname || 'webpage').replace(/[^a-z0-9.-]/gi, '') || 'webpage';
    if (wantsStream) {
      // Sentinel line, then the raw bytes. The client reads lines until it sees
      // this one and treats everything after the newline as the PDF.
      res.write(`${JSON.stringify({ stage: 'done', bytes: pdf.length, name: `${base}.pdf` })}\n`);
      return res.end(pdf);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(base)}.pdf"`);
    return res.end(pdf);
  } catch (err) {
    const m = String((err && err.message) || '');
    // Logged for us, never returned: without this a capture failure is a
    // 422 with nothing behind it and no way to tell a blocked page from a
    // browser that would not start.
    console.error('[webpage-to-pdf] render failed:', m);
    // Nothing internal reaches the user — a stack trace here would describe our
    // network to whoever was probing it.
    const message = m.includes('too-large')
      ? 'That page is too big to capture.'
      : /timeout|Navigation/i.test(m)
        ? 'That page took too long to load, so the capture was stopped.'
        : 'That page could not be captured. It may block automated visitors, or need a login.';
    if (wantsStream) {
      // Headers went out as 200 the moment we started narrating, so the status
      // code can no longer carry the failure — it has to travel as a line.
      if (!res.writableEnded) {
        try { res.write(`${JSON.stringify({ stage: 'error', message })}\n`); } catch { /* client gone */ }
        res.end();
      }
      return undefined;
    }
    return res.status(422).json({ error: 'render-failed', message });
  } finally {
    inFlight--;
  }
});

module.exports = router;
