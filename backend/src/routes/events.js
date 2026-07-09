// Usage analytics for the admin portal — first-party, privacy-respecting (no
// third-party trackers). The frontend fires a beacon when a tool page opens.
//   POST /api/events/track  — public (rate-limited); records 'module_used'.
//   GET  /api/events/stats  — admin only (x-admin-token); usage metrics.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const jwt = require('jsonwebtoken');
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
  const { module, action, visitorId } = req.body || {};
  // Ignore malformed input silently — this endpoint must never disrupt the app.
  if (!module || !MODULE_RE.test(module)) return res.status(204).end();

  let userId = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try { userId = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET).userId; }
    catch { /* anonymous usage — leave userId null */ }
  }

  trackEvent(req, 'module_used', {
    module,
    metadata: action ? { action: String(action).slice(0, 50) } : {},
    userId,
    visitorId,
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
  const rows = (sql) => db.query(sql).then((r) => r.rows);
  try {
    const [users, uniq, active, ret, tops, uses] = await Promise.all([
      rows(`SELECT (SELECT count(*) FROM users)::int AS registered,
                   (SELECT count(*) FROM users WHERE created_at > now() - interval '24 hours')::int AS signups_24h,
                   (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS signups_7d`),
      rows(`SELECT count(DISTINCT ${V})::int AS unique_visitors FROM user_events`),
      rows(`SELECT count(DISTINCT ${V}) FILTER (WHERE created_at > now() - interval '1 day')::int  AS dau,
                   count(DISTINCT ${V}) FILTER (WHERE created_at > now() - interval '7 days')::int  AS wau,
                   count(DISTINCT ${V}) FILTER (WHERE created_at > now() - interval '30 days')::int AS mau
              FROM user_events`),
      rows(`SELECT count(*)::int AS returning_visitors FROM (
              SELECT ${V} AS v FROM user_events GROUP BY v
              HAVING count(DISTINCT date_trunc('day', created_at)) >= 2) t`),
      rows(`SELECT module, count(*)::int AS uses FROM user_events
              WHERE event_type='module_used' AND module IS NOT NULL
              GROUP BY module ORDER BY uses DESC LIMIT 10`),
      rows(`SELECT count(*)::int AS total_tool_uses FROM user_events WHERE event_type='module_used'`),
    ]);
    res.json({
      registered_users: users[0].registered,
      signups_24h: users[0].signups_24h,
      signups_7d: users[0].signups_7d,
      unique_visitors: uniq[0].unique_visitors,
      dau: active[0].dau, wau: active[0].wau, mau: active[0].mau,
      returning_visitors: ret[0].returning_visitors,
      total_tool_uses: uses[0].total_tool_uses,
      top_tools: tops,
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
    const tools = rows.filter((r) => r.slug !== '__heartbeat__');
    res.json({ tools, heartbeat, now: new Date().toISOString() });
  } catch (err) {
    console.error('tool health failed:', err.message);
    res.status(500).json({ error: 'Could not load health' });
  }
});

module.exports = router;
