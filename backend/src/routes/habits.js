// Habit tracker (Tier-2, free) — account-based daily habits with a check-off log
// and streaks. Free by design; the Pro lever is SCALE: free accounts keep up to
// FREE_HABIT_CAP habits, Pro is unlimited. Logs are one row per (habit, day),
// so toggling today's check-in is an insert/delete on a UNIQUE(habit_id, date).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');
const db = require('../db');

const router = express.Router();

const FREE_HABIT_CAP = Number(process.env.FREE_HABIT_CAP || 5);
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

router.use(requireAuth);
router.use(rateLimit({
  windowMs: 60 * 1000, max: 180, keyGenerator: clientKey,
  store: makeStore('rl:habits:'), skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Slow down a moment and try again.' },
}));

async function isPro(userId) {
  try {
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : '';
    return !!rows[0] && (rows[0].plan === 'pro' || OWNER_EMAILS.includes(email));
  } catch { return false; }
}

const clean = (v, n) => String(v == null ? '' : v).replace(/\p{Cc}/gu, '').slice(0, n).trim();
const hexOk = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));

// GET /api/habits — habits + the last 30 days of check-ins (for the grid) +
// current streak per habit, computed from the logs.
router.get('/', async (req, res) => {
  try {
    const habits = await db.query(
      `SELECT id, name, color, frequency, created_at AS "createdAt" FROM habits WHERE user_id = $1 ORDER BY created_at`,
      [req.user.userId]);
    const logs = await db.query(
      `SELECT habit_id AS "habitId", to_char(logged_date, 'YYYY-MM-DD') AS date
       FROM habit_logs WHERE user_id = $1 AND logged_date >= CURRENT_DATE - INTERVAL '30 days'`,
      [req.user.userId]);
    const byHabit = {};
    for (const l of logs.rows) (byHabit[l.habitId] ||= new Set()).add(l.date);
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const withMeta = habits.rows.map((h) => {
      const days = byHabit[h.id] || new Set();
      // streak: count back from today (or yesterday if today not done yet).
      let streak = 0;
      const d = new Date(today);
      if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
      while (days.has(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
      return { ...h, days: [...days], doneToday: days.has(iso(today)), streak };
    });
    const pro = await isPro(req.user.userId);
    return res.json({ habits: withMeta, cap: pro ? null : FREE_HABIT_CAP });
  } catch (e) { console.error('habits list:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/habits — create (free cap enforced).
router.post('/', async (req, res) => {
  const name = clean(req.body && req.body.name, 80);
  if (!name) return res.status(400).json({ error: 'empty', message: 'Give the habit a name.' });
  const color = hexOk(req.body && req.body.color) ? req.body.color : '#6366f1';
  const frequency = (req.body && req.body.frequency) === 'weekly' ? 'weekly' : 'daily';
  try {
    if (!(await isPro(req.user.userId))) {
      const { rows } = await db.query('SELECT count(*)::int AS n FROM habits WHERE user_id = $1', [req.user.userId]);
      if (rows[0].n >= FREE_HABIT_CAP) return res.status(402).json({ error: 'habit-cap', limit: FREE_HABIT_CAP, message: `Free accounts track up to ${FREE_HABIT_CAP} habits. Upgrade to Pro for unlimited.` });
    }
    const { rows } = await db.query(
      `INSERT INTO habits (user_id, name, color, frequency) VALUES ($1, $2, $3, $4)
       RETURNING id, name, color, frequency, created_at AS "createdAt"`,
      [req.user.userId, name, color, frequency]);
    return res.status(201).json({ habit: { ...rows[0], days: [], doneToday: false, streak: 0 } });
  } catch (e) { console.error('habits create:', e.message); return res.status(500).json({ error: 'server' }); }
});

// PUT /api/habits/:id — rename / recolor.
router.put('/:id', async (req, res) => {
  const name = clean(req.body && req.body.name, 80);
  const color = hexOk(req.body && req.body.color) ? req.body.color : null;
  if (!name) return res.status(400).json({ error: 'empty' });
  try {
    const { rows } = await db.query(
      `UPDATE habits SET name = $3, color = COALESCE($4, color) WHERE id = $1 AND user_id = $2
       RETURNING id, name, color, frequency`,
      [req.params.id, req.user.userId, name, color]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    return res.json({ habit: rows[0] });
  } catch (e) { console.error('habits update:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/habits/:id/toggle — check/uncheck a given day (default today).
router.post('/:id/toggle', async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body && req.body.date) ? req.body.date : null;
  try {
    const own = await db.query('SELECT 1 FROM habits WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
    if (!own.rows.length) return res.status(404).json({ error: 'not-found' });
    const del = await db.query(
      `DELETE FROM habit_logs WHERE habit_id = $1 AND user_id = $2 AND logged_date = COALESCE($3::date, CURRENT_DATE) RETURNING id`,
      [req.params.id, req.user.userId, date]);
    if (del.rows.length) return res.json({ done: false });
    await db.query(
      `INSERT INTO habit_logs (habit_id, user_id, logged_date) VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE))
       ON CONFLICT (habit_id, logged_date) DO NOTHING`,
      [req.params.id, req.user.userId, date]);
    return res.json({ done: true });
  } catch (e) { console.error('habits toggle:', e.message); return res.status(500).json({ error: 'server' }); }
});

// DELETE /api/habits/:id — logs cascade via FK.
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.userId]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    return res.json({ ok: true });
  } catch (e) { console.error('habits delete:', e.message); return res.status(500).json({ error: 'server' }); }
});

module.exports = router;
