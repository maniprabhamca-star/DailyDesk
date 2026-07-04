// User feedback ingest. Stores submissions in the `feedback` table (Postgres).
// Anonymous is allowed; if a valid JWT is present we attach the user id.
// View submissions in the DB (TablePlus) or the admin tool:
//   SELECT created_at, category, rating, email, message FROM feedback ORDER BY created_at DESC;
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');

const router = express.Router();

// Cap submissions per client so the form can't be spammed.
router.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: clientKey,
  store: makeStore('rl:feedback:'),
  skip: () => redisDown(),
  message: { error: 'Too many submissions — please try again in a few minutes.' },
}));

const CATEGORIES = new Set(['bug', 'idea', 'praise', 'other']);

function optionalUserId(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return String(jwt.verify(h.slice(7), process.env.JWT_SECRET).userId || '') || null; }
  catch { return null; }
}

router.post('/', async (req, res) => {
  const { message, email, category, rating, page } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length < 3) {
    return res.status(400).json({ error: 'Please share a little more detail.' });
  }
  if (message.length > 5000) return res.status(400).json({ error: 'That message is too long (5000 char max).' });

  const cat = CATEGORIES.has(String(category)) ? String(category) : null;
  const rate = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
  const mail = typeof email === 'string' && email.includes('@') ? email.trim().slice(0, 200) : null;

  try {
    await db.query(
      `INSERT INTO feedback (user_id, email, category, rating, message, page, user_agent, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        optionalUserId(req), mail, cat, rate,
        message.trim().slice(0, 5000),
        (typeof page === 'string' ? page : '').slice(0, 300) || null,
        (req.headers['user-agent'] || '').slice(0, 300),
        clientKey(req),
      ],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('feedback insert error:', err.message);
    res.status(500).json({ error: 'Could not save your feedback — please try again.' });
  }
});

module.exports = router;
