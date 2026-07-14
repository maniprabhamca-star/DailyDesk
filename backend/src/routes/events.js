// Usage analytics for the admin portal — first-party, privacy-respecting (no
// third-party trackers). The frontend fires a beacon when a tool page opens.
//   POST /api/events/track  — public (rate-limited); records 'module_used'.
//   GET  /api/events/stats  — admin only (x-admin-token); usage metrics.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const path = require('path');
const db = require('../db');
const { trackEvent } = require('../utils/trackEvent');

const router = express.Router();

// Beacons are frequent-ish but cheap; cap per-client (POST only).
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: clientKey,
  store: makeStore('rl:events:'),
  skip: () => redisDown(),
  message: { error: 'Too many events' },
});

const MODULE_RE = /^[a-z0-9-]{1,50}$/;
// Ordered file-size buckets recorded when a user selects/drops a file (see
// usage-beacon.tsx). We store the BUCKET ONLY — never the filename or exact bytes
// — so the dashboard shows how large real users' files are, per tool.
const SIZE_BUCKET_ORDER = ['<50MB', '50-100MB', '100MB-1GB', '1-2GB', '>2GB'];
const SIZE_BUCKETS = new Set(SIZE_BUCKET_ORDER);

// First-party client-error store (privacy-first alternative to Sentry). Created
// lazily so no separate migration step is needed on deploy.
let errorTableReady = null;
function ensureErrorTable() {
  if (!errorTableReady) {
    errorTableReady = db.query(`
      CREATE TABLE IF NOT EXISTS client_errors (
        id BIGSERIAL PRIMARY KEY,
        message   TEXT NOT NULL,
        source    TEXT,
        stack     TEXT,
        path      VARCHAR(200),
        visitor_id VARCHAR(64),
        ip_address INET,
        user_agent VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors(created_at DESC);
    `).catch((e) => { errorTableReady = null; throw e; });
  }
  return errorTableReady;
}

// Client errors are rarer but a broken build could burst them; cap hard.
const errorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: clientKey,
  store: makeStore('rl:cerr:'),
  skip: () => redisDown(),
  message: { error: 'Too many reports' },
});

// Report a client-side error. Public + rate-limited; never disrupts the app.
router.post('/error', errorLimiter, async (req, res) => {
  const b = req.body || {};
  const message = typeof b.message === 'string' ? b.message.slice(0, 500).trim() : '';
  if (!message) return res.status(204).end();
  const source = typeof b.source === 'string' ? b.source.slice(0, 300) : null;
  const stack = typeof b.stack === 'string' ? b.stack.slice(0, 2000) : null;
  const path = typeof b.path === 'string' ? b.path.slice(0, 200) : null;
  const vid = b.visitorId ? String(b.visitorId).slice(0, 64) : null;
  const fwd = req.headers['x-forwarded-for'];
  const ip = (fwd ? fwd.split(',')[0].trim() : req.ip) || null;
  const ua = (req.headers['user-agent'] || '').slice(0, 500);
  try {
    await ensureErrorTable();
    await db.query(
      `INSERT INTO client_errors (message, source, stack, path, visitor_id, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [message, source, stack, path, vid, ip, ua]
    );
  } catch (e) { console.error('client error store failed:', e.message); }
  res.status(204).end();
});

router.post('/track', trackLimiter, (req, res) => {
  const { module, action, visitorId, pro } = req.body || {};
  // Ignore malformed input silently — this endpoint must never disrupt the app.
  if (!module || !MODULE_RE.test(module)) return res.status(204).end();

  let userId = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try { userId = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET).userId; }
    catch { /* anonymous usage — leave userId null */ }
  }

  // Acquisition source = the referrer HOST only (never the full URL/path). Our own
  // domain or empty = a direct/in-app visit (null). Lets us see if visitors came
  // from the press sites, search, etc. without storing personal browsing data.
  let referrer = null;
  try {
    const raw = typeof req.body.ref === 'string' ? req.body.ref : '';
    if (raw) {
      const host = new URL(raw).hostname.replace(/^www\./, '');
      if (host && !/(^|\.)diemdesk\.com$/i.test(host)) referrer = host.slice(0, 255);
    }
  } catch { /* malformed referrer → treat as direct */ }

  // A file was selected/dropped — record its size bucket (bucket only, never the
  // filename or bytes). Distinct 'file_size' event; leaves usage counts untouched.
  if (SIZE_BUCKETS.has(req.body && req.body.sizeBucket)) {
    trackEvent(req, 'file_size', { module, metadata: { bucket: req.body.sizeBucket }, userId, visitorId, referrer });
    return res.status(204).end();
  }

  // `pro:true` from a signed-in user marks that a Pro-only feature actually RAN
  // (e.g. on-device batch) — distinct from just opening a tool page. Used for
  // refund decisions ("did this Pro user use Pro since they paid?").
  const eventType = pro === true && userId ? 'pro_used' : 'module_used';
  trackEvent(req, eventType, {
    module,
    metadata: action ? { action: String(action).slice(0, 50) } : {},
    userId,
    visitorId,
    referrer,
  });
  res.status(204).end();
});

// Owner emails allowed to view the web dashboard (in addition to the CLI admin
// token). Mirrors the frontend PRO_EMAILS owner list.
const OWNER_EMAILS = (process.env.OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// True for: the CLI admin token, the owner's ddadmin bypass key (so the owner
// dashboard works WITHOUT app login — same bypass that unlocks owner-only tools),
// OR a logged-in OWNER account (JWT → email in list).
async function isOwnerRequest(req) {
  const token = process.env.ADMIN_API_TOKEN;
  if (token && req.headers['x-admin-token'] === token) return true;
  const bypass = process.env.OWNER_BYPASS_KEY;
  if (bypass && req.headers['x-owner-key'] === bypass) return true;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      const r = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
      const email = r.rows[0] && r.rows[0].email ? r.rows[0].email.toLowerCase() : null;
      return !!email && OWNER_EMAILS.includes(email);
    } catch { /* invalid token → not owner */ }
  }
  return false;
}

// Usage metrics for the owner dashboard. 404 for everyone except the admin token
// or a logged-in owner (so it's invisible by default). visitor key = anonymous
// id, falling back to IP for older rows without one.
router.get('/stats', async (req, res) => {
  if (!(await isOwnerRequest(req))) return res.status(404).json({ error: 'Not found' });

  const V = 'coalesce(visitor_id, ip_address::text)';
  const rows = (sql, params = []) => db.query(sql, params).then((r) => r.rows);

  // Human-only filter: exclude bots, crawlers, and headless automation (incl. our
  // own Playwright health-canary) so counts reflect real people, not scripts.
  const BOT_RE = 'bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|webdriver|python-requests|python-urllib|okhttp|java/|curl/|wget/|go-http|lighthouse|pagespeed|gtmetrix|semrush|ahrefs|dotbot|mj12|facebookexternalhit|whatsapp|telegrambot|discordbot|bingpreview|apis-google';
  const HUMAN = `(user_agent IS NULL OR user_agent !~* '${BOT_RE}')`;

  // Optional date range (YYYY-MM-DD) — applies to the ACTIVITY metrics (visitors,
  // tool uses, top tools, file sizes, returning). Fixed cards (registered total,
  // rolling DAU/WAU/MAU) are unaffected by design. Validated + parameterized.
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const from = DATE.test(String(req.query.from || '')) ? String(req.query.from) : null;
  const to = DATE.test(String(req.query.to || '')) ? String(req.query.to) : null;
  const ranged = !!(from && to);
  const RANGE = ranged ? `created_at >= $1::date AND created_at < ($2::date + 1)` : 'TRUE';
  const rp = ranged ? [from, to] : [];

  try {
    const [users, uniq, active, ret, tops, uses] = await Promise.all([
      rows(`SELECT (SELECT count(*) FROM users)::int AS registered,
                   (SELECT count(*) FROM users WHERE created_at > now() - interval '24 hours')::int AS signups_24h,
                   (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS signups_7d,
                   (SELECT count(*) FROM users WHERE plan='pro')::int AS pro`),
      rows(`SELECT count(DISTINCT ${V})::int AS unique_visitors FROM user_events WHERE ${HUMAN} AND ${RANGE}`, rp),
      rows(`SELECT count(DISTINCT ${V}) FILTER (WHERE created_at > now() - interval '1 day')::int  AS dau,
                   count(DISTINCT ${V}) FILTER (WHERE created_at > now() - interval '7 days')::int  AS wau,
                   count(DISTINCT ${V}) FILTER (WHERE created_at > now() - interval '30 days')::int AS mau
              FROM user_events WHERE ${HUMAN}`),
      rows(`SELECT count(*)::int AS returning_visitors FROM (
              SELECT ${V} AS v FROM user_events WHERE ${HUMAN} AND ${RANGE} GROUP BY v
              HAVING count(DISTINCT date_trunc('day', created_at)) >= 2) t`, rp),
      rows(`SELECT module, count(*)::int AS uses FROM user_events
              WHERE event_type='module_used' AND module IS NOT NULL AND ${HUMAN} AND ${RANGE}
              GROUP BY module ORDER BY uses DESC LIMIT 10`, rp),
      rows(`SELECT count(*)::int AS total_tool_uses FROM user_events WHERE event_type='module_used' AND ${HUMAN} AND ${RANGE}`, rp),
    ]);
    // Pro metrics — isolated so a missing table/column can never break the dashboard.
    let pro_active_30d = 0, pro_waitlist = 0;
    try { pro_active_30d = (await rows(`SELECT count(DISTINCT ue.user_id)::int AS c FROM user_events ue JOIN users u ON u.id = ue.user_id WHERE u.plan='pro' AND ue.created_at > now() - interval '30 days'`))[0].c; }
    catch (e) { console.error('pro_active stat:', e.message); }
    try { pro_waitlist = (await rows(`SELECT count(*)::int AS c FROM pro_waitlist`))[0].c; }
    catch { /* pro_waitlist table may not exist until the first signup */ }

    // File-size distribution (how big are real users' files?) — ordered buckets,
    // isolated so it can never break the dashboard. Also splits by tool for the
    // heavy ones so we can see which tools attract the big files.
    let size_buckets = {}; let size_by_tool = [];
    try {
      const sb = await rows(`SELECT metadata->>'bucket' AS bucket, count(*)::int AS c
                             FROM user_events WHERE event_type='file_size' AND metadata->>'bucket' IS NOT NULL AND ${HUMAN} AND ${RANGE}
                             GROUP BY 1`, rp);
      const m = Object.fromEntries(sb.map((r) => [r.bucket, r.c]));
      size_buckets = Object.fromEntries(SIZE_BUCKET_ORDER.map((b) => [b, m[b] || 0]));
      size_by_tool = await rows(`SELECT module, metadata->>'bucket' AS bucket, count(*)::int AS c
                                FROM user_events
                                WHERE event_type='file_size' AND module IS NOT NULL AND metadata->>'bucket' IN ('100MB-1GB','1-2GB','>2GB') AND ${HUMAN} AND ${RANGE}
                                GROUP BY module, bucket ORDER BY c DESC LIMIT 20`, rp);
    } catch (e) { console.error('size bucket stat:', e.message); }

    // ── Audience & acquisition (human-only, range-scoped; isolated so a failure
    // can never break the core dashboard) ──
    let bots = 0, countries = [], sources = [], devices = [], browsers = [], trend = [], signups_range = null;
    try {
      bots = (await rows(`SELECT count(DISTINCT ${V}) FILTER (WHERE NOT ${HUMAN})::int c FROM user_events WHERE ${RANGE}`, rp))[0].c;
      countries = await rows(`SELECT country, count(DISTINCT ${V})::int visitors FROM user_events WHERE country IS NOT NULL AND ${HUMAN} AND ${RANGE} GROUP BY country ORDER BY visitors DESC LIMIT 8`, rp);
      sources = await rows(`SELECT coalesce(referrer,'direct') AS source, count(DISTINCT ${V})::int visitors FROM user_events WHERE ${HUMAN} AND ${RANGE} GROUP BY 1 ORDER BY visitors DESC LIMIT 8`, rp);
      devices = await rows(`SELECT CASE WHEN user_agent ~* 'iPad|Tablet|PlayBook|Silk' THEN 'Tablet' WHEN user_agent ~* 'Mobi|iPhone|iPod|Android.*Mobile|Windows Phone' THEN 'Mobile' ELSE 'Desktop' END AS device, count(DISTINCT ${V})::int visitors FROM user_events WHERE ${HUMAN} AND ${RANGE} GROUP BY 1 ORDER BY visitors DESC`, rp);
      browsers = await rows(`SELECT CASE WHEN user_agent ~* 'Edg/' THEN 'Edge' WHEN user_agent ~* 'OPR/|Opera' THEN 'Opera' WHEN user_agent ~* 'Firefox/|FxiOS' THEN 'Firefox' WHEN user_agent ~* 'Chrome/|CriOS' THEN 'Chrome' WHEN user_agent ~* 'Safari/' THEN 'Safari' ELSE 'Other' END AS browser, count(DISTINCT ${V})::int visitors FROM user_events WHERE ${HUMAN} AND ${RANGE} GROUP BY 1 ORDER BY visitors DESC LIMIT 6`, rp);
      const trendRange = ranged ? RANGE : `created_at > now() - interval '14 days'`;
      trend = await rows(`SELECT to_char(date_trunc('day',created_at),'YYYY-MM-DD') AS d, count(DISTINCT ${V})::int visitors, count(*) FILTER (WHERE event_type='module_used')::int uses FROM user_events WHERE ${HUMAN} AND ${trendRange} GROUP BY 1 ORDER BY 1`, ranged ? rp : []);
    } catch (e) { console.error('audience stat:', e.message); }
    if (ranged) { try { signups_range = (await rows(`SELECT count(*)::int c FROM users WHERE created_at >= $1::date AND created_at < ($2::date + 1)`, rp))[0].c; } catch { /* ignore */ } }

    // ── Recent feedback (isolated: table may not exist until first submission) ──
    let feedback_recent = [], feedback_summary = null;
    try {
      feedback_recent = await rows(`SELECT to_char(created_at,'Mon DD, HH24:MI') AS at, category, rating, left(message, 240) AS message, page FROM feedback ORDER BY created_at DESC LIMIT 6`);
      feedback_summary = (await rows(`SELECT count(*)::int total, count(*) FILTER (WHERE created_at > now() - interval '7 days')::int last_7d, round(avg(rating) FILTER (WHERE rating IS NOT NULL), 1)::float AS avg_rating FROM feedback`))[0];
    } catch { /* feedback table may not exist yet */ }

    res.json({
      registered_users: users[0].registered,
      signups_24h: users[0].signups_24h,
      signups_7d: users[0].signups_7d,
      unique_visitors: uniq[0].unique_visitors,
      dau: active[0].dau, wau: active[0].wau, mau: active[0].mau,
      returning_visitors: ret[0].returning_visitors,
      total_tool_uses: uses[0].total_tool_uses,
      top_tools: tops,
      pro_subscribers: users[0].pro,
      pro_active_30d,
      pro_waitlist,
      size_buckets,
      size_by_tool,
      range: ranged ? { from, to } : null,
      bots,
      signups_range,
      countries, sources, devices, browsers, trend,
      feedback_recent, feedback_summary,
    });
  } catch (err) {
    console.error('usage stats error:', err.message);
    res.status(500).json({ error: 'Could not load usage stats' });
  }
});

// Recent client errors for the owner dashboard — grouped by message+source,
// most-frequent first. 404 for everyone but the owner (same gate as /stats).
router.get('/errors', async (req, res) => {
  if (!(await isOwnerRequest(req))) return res.status(404).json({ error: 'Not found' });
  try {
    await ensureErrorTable();
    const { rows } = await db.query(`
      SELECT message, source,
             count(*)::int AS count,
             max(created_at) AS last_seen,
             count(DISTINCT coalesce(visitor_id, ip_address::text))::int AS visitors,
             (array_agg(path ORDER BY created_at DESC))[1] AS last_path
      FROM client_errors
      WHERE created_at > now() - interval '30 days'
      GROUP BY message, source
      ORDER BY count DESC, last_seen DESC
      LIMIT 50`);
    const total = await db.query(`SELECT count(*)::int AS c FROM client_errors WHERE created_at > now() - interval '24 hours'`);
    // Per-tool rollup — which tool (route) is throwing the most, last 7 days.
    const byTool = await db.query(`
      SELECT coalesce(nullif(path, ''), '(unknown)') AS tool,
             count(*)::int AS count,
             max(created_at) AS last_seen
      FROM client_errors
      WHERE created_at > now() - interval '7 days'
      GROUP BY tool
      ORDER BY count DESC
      LIMIT 20`);
    res.json({ groups: rows, last_24h: total.rows[0].c, by_tool: byTool.rows });
  } catch (err) {
    console.error('client errors list failed:', err.message);
    res.status(500).json({ error: 'Could not load errors' });
  }
});

// Tool health from the monitoring canary (see backend/scripts/canary.js).
// Owner-only. Returns each monitored tool's last result + a heartbeat so the
// dashboard can flag a dead monitor (staleness) — the guard against the monitor
// itself failing silently.
router.get('/health', async (req, res) => {
  if (!(await isOwnerRequest(req))) return res.status(404).json({ error: 'Not found' });
  try {
    // Table may not exist until the canary has run once — treat that as "no data".
    const { rows } = await db.query(
      `SELECT slug, ok, detail, fail_streak, auto_disabled, checked_at FROM tool_health ORDER BY slug`
    ).catch(() => ({ rows: [] }));
    const heartbeat = rows.find((r) => r.slug === '__heartbeat__') || null;
    const browserHeartbeat = rows.find((r) => r.slug === '__browser_heartbeat__') || null;
    const tools = rows.filter((r) => r.slug !== '__heartbeat__' && r.slug !== '__browser_heartbeat__');
    res.json({ tools, heartbeat, browserHeartbeat, now: new Date().toISOString() });
  } catch (err) {
    console.error('tool health failed:', err.message);
    res.status(500).json({ error: 'Could not load health' });
  }
});

// Owner-only "Run tests now": fires the Node canary + the Playwright browser canary
// in the background (they update tool_health). Debounced so it can't be spammed.
let lastTestRun = 0;
router.post('/run-tests', async (req, res) => {
  if (!(await isOwnerRequest(req))) return res.status(404).json({ error: 'Not found' });
  const now = Date.now();
  if (now - lastTestRun < 45000) return res.json({ started: false, note: 'Tests are already running — give it a minute.' });
  lastTestRun = now;
  const backendRoot = path.join(__dirname, '..', '..');
  try {
    for (const script of ['scripts/canary.js', 'scripts/browser-canary.js']) {
      const child = spawn(process.execPath, [script], { cwd: backendRoot, detached: true, stdio: 'ignore' });
      child.unref();
    }
    res.json({ started: true });
  } catch (err) {
    console.error('run-tests failed:', err.message);
    res.status(500).json({ error: 'Could not start the tests.' });
  }
});

module.exports = router;
