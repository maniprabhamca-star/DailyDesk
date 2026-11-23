// Tell the owner, by email, that a government form we publish has changed.
//
// Why this is a different script from notify-failure.mjs, which it otherwise
// resembles: a drifted form is NOT a broken build. Nothing is on fire, nobody
// needs to stop what they are doing, and the site is not down. What has
// happened is that an agency revised a form and a page of ours now states a
// revision that is no longer the current one. That is a content task with a
// deadline measured in days, and an email that reads like an outage would
// train the reader to discount the next one.
//
// Email rather than an auto-opened issue, for the same reason as the QA
// alerter: this repository is PUBLIC, and an issue titled "our tax form pages
// are out of date" sits on its front page.
//
// Reads the verifier's own stdout rather than re-deriving anything. The
// verifier is the single source of truth about what drifted; this script's
// only job is delivery.

const env = process.env;
const SMTP_HOST = env.SMTP_HOST || '';
const SMTP_USER = env.SMTP_USER || '';
const SMTP_PASS = env.SMTP_PASS || '';
const SMTP_PORT = env.SMTP_PORT || '465';
const MAIL_FROM = env.MAIL_FROM || 'DiemDesk <support@diemdesk.com>';
// No default. notify-failure.mjs hardcodes the owner's address as a fallback and
// that file is published — this repository is public, and a personal address in
// it is a scraped address. The ALERT_TO secret is required here instead, and a
// missing one is treated exactly like a missing password: loud, not silent.
const ALERT_TO = env.ALERT_TO || '';

const {
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_REPOSITORY = '',
  GITHUB_RUN_ID = '',
  DD_REPORT = '',
  DD_OUTCOME = '',
  DD_DRIFTED = '',
  DD_TEST = '',
} = env;

const isTest = DD_TEST === '1';
const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

// The verifier prints one line per form and a summary line. Keep only what a
// reader needs: the lines it marked, plus the count.
const lines = DD_REPORT.split('\n');
const marked = lines.filter((l) => l.includes('✗')).map((l) => l.trim());
const unreadable = lines.filter((l) => /UNCHECKED|NOT FOUND/.test(l)).map((l) => l.trim());
const summary = lines.find((l) => l.startsWith('forms=')) || '(no summary line)';

// Two different pieces of news share this alert, and sending the wrong one is
// worse than sending nothing. "An agency revised a form" is a content task with
// a deadline in days. "We could not read a form at all" is a question about
// whether the check itself still works, and one week of it is usually noise.
// The run decides which; this only has to say it plainly.
// A test is always sent in the DRIFT shape. Its whole purpose is to show the
// owner what the alert that matters looks like, and a test run is normally a
// clean week, so taking the run's own verdict would show them the quiet
// variant instead — and prove nothing about the loud one.
const drifted = isTest || DD_DRIFTED !== 'no';

// On a clean test week there is no real drift line to show, so stand one in.
// Clearly fake on purpose: a made-up revision far enough in the future that
// nobody could mistake it for something they have to act on.
if (isTest && !marked.length) {
  marked.push('form-941         Rev.  Mar 2025  fields=140  pages=6  ✗ REVISION: we say "Mar 2025", the form says "Jun 2030"  ← EXAMPLE, not real');
}

const subject = isTest
  ? 'TEST — ignore. Checking the form-drift alert works'
  : drifted
    ? `${marked.length || 'Some'} US form page${marked.length === 1 ? '' : 's'} no longer match the agency`
    : `${unreadable.length || 'Some'} US form${unreadable.length === 1 ? '' : 's'} could not be checked this week`;

const text = [
  ...(isTest
    ? [
      'This is a TEST. No form has drifted.',
      '',
      'It was sent on purpose, from Actions > Forms sync > Run workflow, to',
      'prove that a real drift would reach you. Everything below is the shape',
      'a real one takes.',
      '',
      '--------------------------------------------------------------',
      '',
    ]
    : []),
  'The weekly check read every US form straight from the agency that issues it',
  'and compared the revision, field count and page count against what our pages',
  `currently state. ${drifted ? 'Some of them no longer agree.' : 'Some of them could not be read at all.'}`,
  '',
  ...(drifted
    ? [
      'What changed:',
      ...(marked.length ? marked.map((l) => `  ${l}`) : ['  (see the run — nothing parsed as a drift line)']),
      '',
      `  ${summary}`,
      '',
      'This is not an outage. The site is fine and the forms themselves still come',
      'live from the agency on every click, so nobody is being handed a stale file.',
      'What is stale is what our PAGES SAY about them — a revision we assert and a',
      'field count we claim to have measured. That claim is the whole reason these',
      'pages are better than a hosted copy, so it is worth a day, not a week.',
      '',
      'To fix: update the drifted entries in frontend/lib/us-forms.ts, set',
      'CHECKED_ON to today, then run `npm run verify:us-forms` until it reports',
      'drifts=0, and ship.',
    ]
    : [
      'What could not be read:',
      ...(unreadable.length ? unreadable.map((l) => `  ${l}`) : ['  (see the run)']),
      '',
      `  ${summary}`,
      '',
      'Nothing is known to be wrong. These forms were simply not verified this',
      'week — the agency was slow or unreachable, or printed its version marker',
      'somewhere the script cannot read. One week of that is noise. The SAME form',
      'again next week is not: it means we are asserting a revision nobody has',
      'confirmed, and the fix is to check that one by hand and teach the verifier',
      'how its marker is printed.',
    ]),
  '',
  `Run:      ${runUrl}`,
  `Outcome:  ${DD_OUTCOME || 'unknown'}`,
  '',
  'If a form is listed as UNCHECKED rather than drifted, that is usually the',
  'agency being slow or a marker this script cannot parse — not bad data. Open',
  'the run and read the line before changing anything.',
].join('\n');

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ALERT_TO) {
  // Same reasoning as the QA alerter: a notifier that silently does nothing
  // when unconfigured reproduces the exact failure it exists to prevent. The
  // whole report is printed below so the run's log still carries the news.
  console.error('✗ The form-drift alerter is NOT configured, so nobody was told.');
  console.error('  Add these repository secrets: SMTP_HOST, SMTP_USER, SMTP_PASS, ALERT_TO');
  console.error('  (optional: SMTP_PORT, MAIL_FROM)');
  console.error('');
  console.error(text);
  process.exit(1);
}

const { default: nodemailer } = await import('nodemailer');

const port = Number(SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

await transporter.sendMail({ from: MAIL_FROM, to: ALERT_TO, subject, text });
console.log(`✓ Told ${ALERT_TO}: ${subject}`);
