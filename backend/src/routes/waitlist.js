const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendMail } = require('../utils/mailer');
const { waitlistEmail } = require('../utils/email-template');

// Pro launch waitlist — capture interested users during the free-first phase so
// we have a warm list (and founding-member signups) when Pro turns on. Public
// (no auth); the global rate limiter still applies. Stores email + optional
// most-wanted feature, links to a user account if one exists, and sends a
// branded confirmation. Idempotent per email.
const FEATURES = new Set(['batch', 'vault', 'ai', 'ocr']);

router.post('/', async (req, res) => {
  const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();
  const feature = req.body && FEATURES.has(req.body.feature) ? req.body.feature : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  try {
    let userId = null;
    try { const u = await db.query('SELECT id FROM users WHERE email = $1', [email]); userId = (u.rows[0] && u.rows[0].id) || null; } catch { /* users lookup is best-effort */ }
    await db.query(
      `INSERT INTO pro_waitlist (email, user_id, feature) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET feature = COALESCE(EXCLUDED.feature, pro_waitlist.feature), user_id = COALESCE(EXCLUDED.user_id, pro_waitlist.user_id)`,
      [email, userId, feature]
    );
    const { subject, html, text } = waitlistEmail();
    sendMail({ to: email, subject, html, text }).catch((e) => console.error('Waitlist email failed:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('Waitlist error:', err.message);
    res.status(500).json({ error: 'Could not join the waitlist. Please try again.' });
  }
});

module.exports = router;
