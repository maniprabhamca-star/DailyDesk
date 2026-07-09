#!/usr/bin/env node
// Stale-heartbeat watcher — the guard against the monitor failing SILENTLY.
// Runs on its OWN cron (separate process from the canary), so if the canary dies
// this still fires and emails the owner. If the whole box/cron is down, the
// existing dd-monitor infra check + morning digest is the outer backstop.
//
// Alerts once when the heartbeat goes stale, then respects a cooldown so a long
// outage doesn't spam. Records the last alert time in a tool_health row.
require('dotenv').config();
const db = require('../src/db');
const { notifyOwner } = require('../src/utils/notify');

const STALE_MIN = 30;     // heartbeat older than this ⇒ canary likely dead
const COOLDOWN_MIN = 180; // don't re-alert within this window

(async () => {
  const { rows } = await db
    .query("SELECT slug, checked_at FROM tool_health WHERE slug IN ('__heartbeat__', '__hb_alert__')")
    .catch(() => ({ rows: [] }));
  const hb = rows.find((r) => r.slug === '__heartbeat__');
  const lastAlert = rows.find((r) => r.slug === '__hb_alert__');
  const now = Date.now();

  if (!hb) { console.log('[hb-watch] no heartbeat row yet — canary has not run'); process.exit(0); }
  const ageMin = (now - new Date(hb.checked_at).getTime()) / 60000;
  if (ageMin <= STALE_MIN) { console.log(`[hb-watch] ok — heartbeat ${ageMin.toFixed(0)}m old`); process.exit(0); }

  const sinceAlert = lastAlert ? (now - new Date(lastAlert.checked_at).getTime()) / 60000 : Infinity;
  if (sinceAlert < COOLDOWN_MIN) { console.log(`[hb-watch] stale but alerted ${sinceAlert.toFixed(0)}m ago (cooldown)`); process.exit(0); }

  await notifyOwner(
    '🔴 Monitoring canary is DOWN',
    `The tool canary hasn't run in ${ageMin.toFixed(0)} minutes (last: ${hb.checked_at}).\n` +
      `Your tools are NOT being auto-monitored right now.\n` +
      `Check: crontab -l | grep canary, and  tail -n 40 /var/log/dd-canary.log`
  );
  await db.query(
    `INSERT INTO tool_health (slug, ok, detail, checked_at) VALUES ('__hb_alert__', false, 'monitor stale alert sent', now())
     ON CONFLICT (slug) DO UPDATE SET checked_at = now(), detail = 'monitor stale alert sent'`
  );
  console.log('[hb-watch] ALERT sent — canary stale');
  process.exit(0);
})().catch((e) => { console.error('[hb-watch] fatal', e); process.exit(1); });
