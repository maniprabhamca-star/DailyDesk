// Generic transactional email (password reset, etc.). Reuses the VPS sendmail
// (msmtp → Gmail app password) transport the monitoring alerts already use, so
// no new API key is needed. Falls back to Resend if RESEND_API_KEY is set.
// Never used for bulk — one recipient, one message.
const { spawn } = require('child_process');

const SENDMAIL = process.env.SENDMAIL_PATH || '/usr/sbin/sendmail';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
// sendmail envelope must match the authenticated Gmail account or Gmail rewrites
// it — mirror notify.js (ALERT_FROM || owner gmail).
const FROM = process.env.MAIL_FROM || process.env.ALERT_FROM || 'DiemDesk <maniprabhamca@gmail.com>';
const RESEND_FROM = process.env.RESEND_FROM || 'DiemDesk <noreply@diemdesk.com>';

function viaSendmail({ to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    let msg = `From: ${FROM}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\n`;
    if (html) {
      const b = `ddb_${Date.now()}`;
      msg += `Content-Type: multipart/alternative; boundary="${b}"\r\n\r\n` +
        `--${b}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n\r\n` +
        `--${b}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n\r\n--${b}--\r\n`;
    } else {
      msg += `Content-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n`;
    }
    const p = spawn(SENDMAIL, ['-t'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sendmail exit ${code} ${err}`.trim()))));
    p.stdin.write(msg);
    p.stdin.end();
  });
}

async function viaResend({ to, subject, text, html }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

/** Send one transactional email. Tries local sendmail first, then Resend.
 * Throws if every transport fails so callers can log it. */
async function sendMail({ to, subject, text, html }) {
  try { await viaSendmail({ to, subject, text, html }); return 'sendmail'; }
  catch (e) {
    console.error(`[mail] sendmail failed: ${e.message}`);
    if (RESEND_KEY) { await viaResend({ to, subject, text, html }); return 'resend'; }
    throw e;
  }
}

module.exports = { sendMail };
