// Tell the owner, by email, that an unwatched QA run went red.
//
// The gate did its job on 2026-11-14 and again on 2026-11-15: it caught a
// CRITICAL advisory in `next` that was live on production, and failed the
// nightly run both times. Nobody found out until somebody happened to look
// almost three days later, because a scheduled run's conclusion is only ever
// visible to whoever goes and reads it. The detection was never the gap. The
// delivery was.
//
// Email rather than an auto-opened issue, deliberately: this repository is
// PUBLIC, and an open issue reading "nightly QA failed" sits on its front page
// as a signpost for anyone looking for a target that is currently vulnerable.
// The workflow logs are public too, but obscure; an issue advertises.
//
// SMTP settings are the same names the backend's mailer already uses, so there
// is one set of facts about how this project sends mail, not two.

// nodemailer is imported further down, AFTER the configuration check, and on
// purpose: a top-level import makes a missing dependency crash with a module
// resolution error before the script can say the useful thing, which is that
// nobody has been told and here is how to fix that. The unconfigured path must
// need nothing at all to work.

const {
  SMTP_HOST = '',
  SMTP_USER = '',
  SMTP_PASS = '',
  SMTP_PORT = '465',
  MAIL_FROM = 'DiemDesk <support@diemdesk.com>',
  ALERT_TO = 'maniprabhamca@gmail.com',
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_REPOSITORY = '',
  GITHUB_RUN_ID = '',
  GITHUB_SHA = '',
  GITHUB_REF_NAME = '',
  DD_EVENT = '',
  DD_FAILED = '',
  DD_TEST = '',
} = process.env;

// A test send has to be unmistakable in the inbox. An alert that might be real
// and might be a drill teaches people to check before reacting, which is the
// hesitation the whole thing exists to remove.
const isTest = DD_TEST === '1';

const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
// A test is shown as the nightly run, because that is the alert whose arrival
// is actually being proven — a drill that looks unlike the real thing proves
// less than it appears to.
const when = (DD_EVENT === 'schedule' || isTest)
  ? 'The nightly QA run'
  : `QA on ${GITHUB_REF_NAME || 'main'}`;

// `DD_FAILED` is the needs context as JSON. Naming the job that went red is the
// difference between "go and look" and "go and look at this" — and the audit
// gate lives in two of them, so which one failed says what kind of problem it
// is before the link is even opened.
let failed = [];
try {
  const ctx = JSON.parse(DD_FAILED || '{}');
  failed = Object.entries(ctx)
    .filter(([, v]) => v && v.result && v.result !== 'success' && v.result !== 'skipped')
    .map(([k, v]) => `${k}: ${v.result}`);
} catch { /* reported as unknown below */ }

const detail = failed.length ? failed.join('\n  ') : '(could not read which job failed — open the run)';

const subject = isTest ? 'TEST — ignore. Checking the QA failure alert works' : `${when} failed`;
const text = [
  // Spread an array rather than a multi-line string literal: the lines stay
  // readable here and nothing depends on getting an escape right.
  ...(isTest
    ? [
      'This is a TEST. Nothing is broken.',
      '',
      'It was sent on purpose, from Actions > QA > Run workflow, to prove that',
      'a real failure would reach you. If you are reading this, it will.',
      'Everything below is the shape a real one takes.',
      '',
      '--------------------------------------------------------------',
      '',
    ]
    : []),
  `${when} failed.`,
  '',
  'Failed jobs:',
  `  ${detail}`,
  '',
  `Run:    ${runUrl}`,
  `Commit: ${GITHUB_SHA}`,
  '',
  'If the job named "Backend suites + audit" or "Typecheck + unit + build" is in',
  'that list, check the dependency audit step first — that is the step that',
  'catches a HIGH or CRITICAL advisory in something that actually ships, and an',
  'advisory it reports is live on production right now.',
].join('\n');

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  // Loudly, and with a non-zero exit. A notifier that quietly does nothing when
  // it is unconfigured reproduces the exact failure it was built to prevent —
  // the run stays red either way, so there is no cost to being honest about it.
  console.error('✗ The failure alerter is NOT configured, so nobody was told.');
  console.error('  Add these repository secrets: SMTP_HOST, SMTP_USER, SMTP_PASS');
  console.error('  (optional: SMTP_PORT, MAIL_FROM, ALERT_TO)');
  console.error('');
  console.error(text);
  process.exit(1);
}

const { default: nodemailer } = await import('nodemailer');

const port = Number(SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465, // implicit TLS on 465, STARTTLS on 587
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

await transporter.sendMail({ from: MAIL_FROM, to: ALERT_TO, subject, text });
console.log(`✓ Told ${ALERT_TO}: ${subject}`);
