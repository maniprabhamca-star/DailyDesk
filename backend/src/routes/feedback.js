// User feedback ingest + admin read.
//   POST /api/feedback           — public (rate-limited); stores a row.
//   GET  /api/feedback?limit=100 — admin only (x-admin-token: $ADMIN_API_TOKEN).
// Anonymous submit is allowed; a valid JWT attaches the user id.
// Stored in the `feedback` table (Postgres). The admin dashboard reads via GET.
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');

const router = express.Router();

// Cap submissions per client so the form can't be spammed (POST only).
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: clientKey,
  store: makeStore('rl:feedback:'),
  skip: () => redisDown(),
  message: { error: 'Too many submissions — please try again in a few minutes.' },
});

const CATEGORIES = new Set(['bug', 'idea', 'praise', 'other']);

function optionalUserId(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return String(jwt.verify(h.slice(7), process.env.JWT_SECRET).userId || '') || null; }
  catch { return null; }
}

router.post('/', submitLimiter, async (req, res) => {
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

// Admin read for the admin dashboard. Token-guarded; returns 404 if unconfigured
// (so it's invisible until you set ADMIN_API_TOKEN on the server).
router.get('/', async (req, res) => {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token || req.headers['x-admin-token'] !== token) return res.status(404).json({ error: 'Not found' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const { rows } = await db.query(
      `SELECT id, created_at, user_id, email, category, rating, message, page, status
       FROM feedback ORDER BY created_at DESC LIMIT $1`, [limit],
    );
    const counts = await db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last_24h,
              count(*) FILTER (WHERE status = 'new')::int AS unread
       FROM feedback`,
    );
    res.json({ summary: counts.rows[0], feedback: rows });
  } catch (err) {
    console.error('feedback list error:', err.message);
    res.status(500).json({ error: 'Could not load feedback' });
  }
});

module.exports = router;
