# DiemDesk Alerts — Email & SMS Setup

`dd-monitor` pushes **phone alerts (ntfy)** the moment a threshold is crossed, and
now *also* sends **email** (✅ live) and optionally **SMS** on the same alerts.

**Status:** Email is configured — alerts send via Gmail SMTP (from
`mcamanigandan@gmail.com`). SMS is ready but dormant until Twilio credentials are added.

**Managing the email list:** add/remove recipients in the **admin tool → Monitoring →
Alert email recipients** (no server access or redeploy needed — `dd-monitor` reads the
list live from the database). The `ALERT_EMAILS` config value is only a fallback.

## How alerts fan out
When a threshold is breached, `notify()` sends to **all configured channels** at once,
sharing one 6-hour per-signal cooldown (so no spam):

| Channel | Fires on | Cost | Notes |
|---------|----------|------|-------|
| 📱 **ntfy push** | every alert | free | already live |
| ✉️ **Email** | every alert (warn + critical + daily digest) | free/cheap | to your recipient list |
| 💬 **SMS** | **CRITICAL only** by default | ~$0.008/text | for the "wake me up" events |

**Why SMS on critical-only:** you don't want a 3 a.m. text for a minor warning. SMS is
reserved for genuine "server on fire" events (CPU/RAM/disk critical, Redis down, DB
connections critical). Set `SMS_ON_CRIT_ONLY=0` if you want SMS for warnings too.

---

## What to provide

### Email (pick ONE method)

**Option A — Gmail (fastest, no new signup):**
1. Turn on 2-Step Verification on your Google account
2. Google Account → Security → **App passwords** → generate one (16 characters)
3. Give me: that app password + the **recipient email list**

**Option B — Professional sender `alerts@diemdesk.com` (better deliverability):**
Use a provider (Mailgun / SendGrid / Amazon SES / Resend). Verify `diemdesk.com`
(a few DNS records on Cloudflare — I can guide), then give me the SMTP host/port/
user/pass it provides + the recipient list.

> Either way it plugs into the same settings. Start with Gmail; upgrade later if you want.

### SMS (optional, via Twilio)
1. Sign up at twilio.com, buy a phone number (~$1/mo)
2. From the console, copy **Account SID**, **Auth Token**, and your **Twilio number**
3. Give me those + the **phone number(s)** to alert (in +1XXXXXXXXXX format)

---

## Where it's configured (`/etc/dd-monitor.conf`)
```bash
# Email
SMTP_HOST="smtp.gmail.com"; SMTP_PORT=465
SMTP_USER="you@gmail.com";  SMTP_PASS="xxxx xxxx xxxx xxxx"
EMAIL_FROM="you@gmail.com"
ALERT_EMAILS="you@x.com,ops@y.com"          # the email list

# SMS (Twilio) — critical only
TWILIO_SID="ACxxxx…"; TWILIO_TOKEN="xxxx"; TWILIO_FROM="+1555…"
ALERT_SMS="+1555…,+1444…"
SMS_ON_CRIT_ONLY=1
```

## Test it
After the config is set:
```
dd-monitor test      # sends a test to ntfy + email + SMS, prints what it attempted
```

## Suggestions
- **Keep ntfy** as the primary phone alert — it's free and instant. Email + SMS are
  belt-and-suspenders (and email gives you a searchable record + the daily digest).
- Alerts arrive within ~5 min (the cron cycle). If you want criticals detected faster,
  we can run `dd-monitor infra` every 1–2 minutes — it's lightweight.
- Optional nice-to-have: an **"all-clear" email** when a critical resolves. Say the word
  and I'll add it.
