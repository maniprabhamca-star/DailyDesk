// Owner alerting for the monitoring canary (tool auto-disable / recovery).
//
// Reuses the mail transport THIS VPS already has: msmtp is configured (Gmail app
// password in /etc/msmtprc) and exposed as /usr/sbin/sendmail — the same path the
// dd-monitor morning alerts use. So email works with ZERO new setup or secrets.
// Recipients come from the admin-managed `alert_recipients` table (same as
// dd-monitor), falling back to OWNER_EMAILS.
//
// Transport order (first that succeeds wins): local sendmail → webhook
// (ALERT_WEBHOOK_URL) → Resend (RESEND_API_KEY). Always logs. Never throws — a
// broken alert must not break the monitor.

const { spawn } = require('child_process');
const db = require('../db');

const SENDMAIL = process.env.SENDMAIL_PATH || '/usr/sbin/sendmail';
const WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const OWNERS = (process.env.OWNER_EMAILS || 'maniprabhamca@gmail.com').split(',').map((s) => s.trim()).filter(Boolean);
const FROM = process.env.ALERT_FROM || OWNERS[0]; // match the msmtp account so Gmail doesn't rewrite/reject

async function recipients() {
  try {
    const { rows } = await db.query('SELECT email FROM alert_recipients WHERE active = true');
    if (rows.length) return rows.map((r) => r.email);
  } catch { /* table may not exist — fall back */ }
  return OWNERS;
}

function viaSendmail(subject, text, to) {
  return new Promise((resolve, reject) => {
    const msg =
      `From: ${FROM}\r\nTo: ${to.join(', ')}\r\nSubject: [DiemDesk] ${subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n`;
    const p = spawn(SENDMAIL, ['-t'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sendmail exit ${code} ${err}`.trim()))));
    p.stdin.write(msg);
    p.stdin.end();
  });
}

async function viaWebhook(subject, text) {
  const body = `*${subject}*\n${text}`;
  const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body, content: body }) });
  if (!r.ok) throw new Error(`webhook ${r.status}`);
}

async function viaResend(subject, text, to) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.ALERT_FROM || 'DiemDesk Alerts <alerts@diemdesk.com>', to, subject, text }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

/** Send an owner alert. Never throws. Returns the transport used. */
async function notifyOwner(subject, text) {
  console.log(`[alert] ${new Date().toISOString()} — ${subject} — ${text}`); // always logged (audit + fallback)
  const to = await recipients();
  try { await viaSendmail(subject, text, to); return 'email'; } catch (e) { console.error(`[alert] sendmail failed: ${e.message}`); }
  if (WEBHOOK) { try { await viaWebhook(subject, text); return 'webhook'; } catch (e) { console.error(`[alert] webhook failed: ${e.message}`); } }
  if (RESEND_KEY) { try { await viaResend(subject, text, to); return 'email'; } catch (e) { console.error(`[alert] resend failed: ${e.message}`); } }
  return 'log-only';
}

module.exports = { notifyOwner };
