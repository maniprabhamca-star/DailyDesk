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

// Usage metrics for the admin dashboard. Token-guarded; 404 until ADMIN_API_TOKEN
// is set (so it's invisible by default). visitor key = anonymous id, falling back
// to IP for older rows without one.
router.get('/stats', async (req, res) => {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token || req.headers['x-admin-token'] !== token) return res.status(404).json({ error: 'Not found' });

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

module.exports = router;
