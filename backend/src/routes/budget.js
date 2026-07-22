// Budget tracker (Tier-2, free) — account-based expense logging with monthly
// totals by category. Free by design; the Pro lever is SCALE: free accounts log
// up to FREE_EXPENSE_CAP entries per calendar month, Pro is unlimited. Amounts
// are stored as NUMERIC(10,2); the client picks the display currency (we don't
// convert — an expense is whatever currency the user entered).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');
const db = require('../db');

const router = express.Router();

const FREE_EXPENSE_CAP = Number(process.env.FREE_EXPENSE_CAP || 50); // per month
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

router.use(requireAuth);
router.use(rateLimit({
  windowMs: 60 * 1000, max: 180, keyGenerator: clientKey,
  store: makeStore('rl:budget:'), skip: (req) => redisDown() || isCanaryReq(req),
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
const CATS = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Fun', 'Home', 'Other'];
const monthOf = (d) => String(d || '').slice(0, 7); // YYYY-MM

// GET /api/budget?month=YYYY-MM — expenses for a month + totals by category.
router.get('/', async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  try {
    const { rows } = await db.query(
      `SELECT id, amount::float8 AS amount, category, description, merchant,
              to_char(expense_date, 'YYYY-MM-DD') AS date
       FROM expenses
       WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2
       ORDER BY expense_date DESC, created_at DESC`,
      [req.user.userId, month]);
    const byCat = {};
    let total = 0;
    for (const e of rows) { byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + e.amount; total += e.amount; }
    const pro = await isPro(req.user.userId);
    return res.json({ month, expenses: rows, total, byCategory: byCat, count: rows.length, cap: pro ? null : FREE_EXPENSE_CAP });
  } catch (e) { console.error('budget list:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/budget — add an expense (monthly free cap enforced).
router.post('/', async (req, res) => {
  const amount = Math.round(Number(req.body && req.body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999) return res.status(400).json({ error: 'bad-amount', message: 'Enter an amount greater than zero.' });
  const category = CATS.includes(req.body && req.body.category) ? req.body.category : 'Other';
  const description = clean(req.body && req.body.description, 200);
  const merchant = clean(req.body && req.body.merchant, 120);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body && req.body.date) ? req.body.date : new Date().toISOString().slice(0, 10);
  try {
    if (!(await isPro(req.user.userId))) {
      const { rows } = await db.query(
        `SELECT count(*)::int AS n FROM expenses WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2`,
        [req.user.userId, monthOf(date)]);
      if (rows[0].n >= FREE_EXPENSE_CAP) return res.status(402).json({ error: 'expense-cap', limit: FREE_EXPENSE_CAP, message: `Free accounts log up to ${FREE_EXPENSE_CAP} expenses a month. Upgrade to Pro for unlimited.` });
    }
    const { rows } = await db.query(
      `INSERT INTO expenses (user_id, amount, category, description, merchant, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, amount::float8 AS amount, category, description, merchant, to_char(expense_date, 'YYYY-MM-DD') AS date`,
      [req.user.userId, amount, category, description, merchant, date]);
    return res.status(201).json({ expense: rows[0] });
  } catch (e) { console.error('budget create:', e.message); return res.status(500).json({ error: 'server' }); }
});

// DELETE /api/budget/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.userId]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    return res.json({ ok: true });
  } catch (e) { console.error('budget delete:', e.message); return res.status(500).json({ error: 'server' }); }
});

module.exports = router;
