// Lightweight usage-event ingest for the admin portal's analytics.
// The frontend fires a fire-and-forget beacon when a tool page is opened;
// this records a 'module_used' row in user_events (with user_id if logged in).
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { trackEvent } = require('../utils/trackEvent');

const router = express.Router();

// Beacons are frequent-ish but cheap; cap per-IP to avoid abuse.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many events' },
}));

const MODULE_RE = /^[a-z0-9-]{1,50}$/;

router.post('/track', (req, res) => {
  const { module, action } = req.body || {};
  // Ignore malformed input silently — this endpoint must never disrupt the app.
  if (!module || !MODULE_RE.test(module)) return res.status(204).end();

  let userId = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      userId = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET).userId;
    } catch { /* anonymous usage — leave userId null */ }
  }

  trackEvent(req, 'module_used', {
    module,
    metadata: action ? { action: String(action).slice(0, 50) } : {},
    userId,
  });
  res.status(204).end();
});

module.exports = router;
