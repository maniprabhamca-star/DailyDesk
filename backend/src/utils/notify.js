// Owner alerting with a pluggable transport — used by the monitoring canary to
// tell the owner when a tool auto-disables or recovers.
//
// Zero secrets in code. It picks a transport from env, in order:
//   1. RESEND_API_KEY (+ ALERT_EMAIL, ALERT_FROM) → email via Resend's HTTP API.
//   2. ALERT_WEBHOOK_URL → POST { text, content } (works with Slack / Discord /
//      most webhook receivers; Telegram via a bot webhook proxy).
//   3. neither set → just logs (below). So alerts are never lost, and email/push
//      is opt-in by adding ONE env var later — no code change, no redeploy of logic.
//
// Fail-safe: any transport error is caught and logged; alerting never throws into
// the caller (a broken alert must not break the monitor).

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const ALERT_EMAIL = process.env.ALERT_EMAIL || (process.env.OWNER_EMAILS || '').split(',')[0].trim();
const ALERT_FROM = process.env.ALERT_FROM || 'DiemDesk Alerts <alerts@diemdesk.com>';
const WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';

async function viaResend(subject, text) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_EMAIL], subject, text }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function viaWebhook(subject, text) {
  const body = `*${subject}*\n${text}`;
  const r = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: body, content: body }), // text=Slack, content=Discord
  });
  if (!r.ok) throw new Error(`webhook ${r.status}`);
}

/** Send an owner alert. Never throws. Returns the transport used. */
async function notifyOwner(subject, text) {
  const line = `[alert] ${new Date().toISOString()} — ${subject} — ${text}`;
  console.log(line); // always to the log (fallback + audit trail)
  try {
    if (RESEND_KEY && ALERT_EMAIL) { await viaResend(subject, text); return 'email'; }
    if (WEBHOOK) { await viaWebhook(subject, text); return 'webhook'; }
    return 'log-only';
  } catch (e) {
    console.error(`[alert] transport failed: ${e.message}`);
    return 'log-failed';
  }
}

module.exports = { notifyOwner };
