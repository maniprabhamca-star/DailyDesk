// User activity logger for the DailyDesk Admin Portal.
// Writes to the user_events table (created by the admin portal migration).
// Fire-and-forget: never blocks the request and never throws into it.
const db = require('../db');

function trackEvent(req, eventType, { module = null, metadata = {}, userId = null } = {}) {
  const uid = userId || req.user?.userId || req.user?.id || null;
  const fwd = req.headers['x-forwarded-for'];
  const ip = (fwd ? fwd.split(',')[0].trim() : req.ip) || null;
  const userAgent = (req.headers['user-agent'] || '').slice(0, 500);

  db.query(
    `INSERT INTO user_events (user_id, event_type, module, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uid, eventType, module, JSON.stringify(metadata), ip, userAgent]
  ).catch((err) => console.error('trackEvent failed:', err.message));
}

module.exports = { trackEvent };
