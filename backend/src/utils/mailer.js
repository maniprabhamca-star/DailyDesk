// Generic transactional email (password reset, etc.). Transport preference:
//   1) SMTP (e.g. Hostinger, support@diemdesk.com) when SMTP_* is configured —
//      domain-aligned From with real SPF/DKIM, so it lands in the inbox.
//   2) local sendmail (msmtp → Gmail) — the pre-existing transport.
//   3) Resend (RESEND_API_KEY) — final fallback.
// Each transport uses a From that matches its own sending identity so nothing
// gets rewritten/rejected. One recipient per call — never bulk.
const { spawn } = require('child_process');

const SENDMAIL = process.env.SENDMAIL_PATH || '/usr/sbin/sendmail';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
// Domain identity (SMTP + Resend) vs the Gmail-relay identity (sendmail).
const DOMAIN_FROM = process.env.MAIL_FROM || 'DiemDesk <support@diemdesk.com>';
const RESEND_FROM = process.env.RESEND_FROM || DOMAIN_FROM;
const SENDMAIL_FROM = process.env.SENDMAIL_FROM || process.env.ALERT_FROM || 'DiemDesk <maniprabhamca@gmail.com>';

// SMTP (Hostinger). secure=true for 465 (implicit TLS); false for 587 (STARTTLS).
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;

let transporter = null;
function getSmtp() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null; // inert until configured
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function viaSmtp({ to, subject, text, html }) {
  await getSmtp().sendMail({ from: DOMAIN_FROM, to, subject, text, html });
}

function viaSendmail({ to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    let msg = `From: ${SENDMAIL_FROM}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\n`;
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

/** Send one transactional email. SMTP → sendmail → Resend. Throws if all fail. */
async function sendMail({ to, subject, text, html }) {
  if (getSmtp()) {
    try { await viaSmtp({ to, subject, text, html }); return 'smtp'; }
    catch (e) { console.error(`[mail] smtp failed: ${e.message}`); }
  }
  try { await viaSendmail({ to, subject, text, html }); return 'sendmail'; }
  catch (e) {
    console.error(`[mail] sendmail failed: ${e.message}`);
    if (RESEND_KEY) { await viaResend({ to, subject, text, html }); return 'resend'; }
    throw e;
  }
}

module.exports = { sendMail };
