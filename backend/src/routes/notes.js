// Smart Notes (Tier-2, free) — account-based quick notes. Free by design; the
// only Pro lever is SCALE: free accounts keep up to FREE_NOTE_CAP notes, Pro is
// unlimited (gate scale, not quality). Notes are plain user text stored per
// account — no encryption tier here (that's the File Vault); the honest line in
// the UI is "synced to your account", not "end-to-end encrypted".
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');
const db = require('../db');

const router = express.Router();

const FREE_NOTE_CAP = Number(process.env.FREE_NOTE_CAP || 10);
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const MAX = { title: 255, content: 20000, tags: 12, tag: 40 };

router.use(requireAuth);
router.use(rateLimit({
  windowMs: 60 * 1000, max: 120, keyGenerator: clientKey,
  store: makeStore('rl:notes:'), skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Slow down a moment and try again.' },
}));

async function isPro(userId) {
  try {
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : '';
    return !!rows[0] && (rows[0].plan === 'pro' || OWNER_EMAILS.includes(email));
  } catch { return false; }
}

const clean = (v, n) => String(v == null ? '' : v).replace(/\p{Cc}/gu, (m) => (m === '\n' || m === '\t' ? m : '')).slice(0, n);
function cleanTags(t) {
  if (!Array.isArray(t)) return [];
  return [...new Set(t.map((x) => clean(x, MAX.tag).trim()).filter(Boolean))].slice(0, MAX.tags);
}

// GET /api/notes — all of the user's notes, newest-updated first, + the cap state.
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content, tags, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM notes WHERE user_id = $1 ORDER BY updated_at DESC`, [req.user.userId]);
    const pro = await isPro(req.user.userId);
    return res.json({ notes: rows, cap: pro ? null : FREE_NOTE_CAP, count: rows.length });
  } catch (e) { console.error('notes list:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/notes — create (enforces the free cap).
router.post('/', async (req, res) => {
  const title = clean(req.body && req.body.title, MAX.title).trim();
  const content = clean(req.body && req.body.content, MAX.content);
  const tags = cleanTags(req.body && req.body.tags);
  if (!title && !content.trim()) return res.status(400).json({ error: 'empty', message: 'Add a title or some text first.' });
  try {
    if (!(await isPro(req.user.userId))) {
      const { rows } = await db.query('SELECT count(*)::int AS n FROM notes WHERE user_id = $1', [req.user.userId]);
      if (rows[0].n >= FREE_NOTE_CAP) {
        return res.status(402).json({ error: 'note-cap', limit: FREE_NOTE_CAP, message: `Free accounts keep up to ${FREE_NOTE_CAP} notes. Upgrade to Pro for unlimited notes.` });
      }
    }
    const { rows } = await db.query(
      `INSERT INTO notes (user_id, title, content, tags) VALUES ($1, $2, $3, $4)
       RETURNING id, title, content, tags, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.user.userId, title, content, tags]);
    return res.status(201).json({ note: rows[0] });
  } catch (e) { console.error('notes create:', e.message); return res.status(500).json({ error: 'server' }); }
});

// PUT /api/notes/:id — update.
router.put('/:id', async (req, res) => {
  const title = clean(req.body && req.body.title, MAX.title).trim();
  const content = clean(req.body && req.body.content, MAX.content);
  const tags = cleanTags(req.body && req.body.tags);
  try {
    const { rows } = await db.query(
      `UPDATE notes SET title = $3, content = $4, tags = $5, updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, content, tags, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, req.user.userId, title, content, tags]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    return res.json({ note: rows[0] });
  } catch (e) { console.error('notes update:', e.message); return res.status(500).json({ error: 'server' }); }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.userId]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    return res.json({ ok: true });
  } catch (e) { console.error('notes delete:', e.message); return res.status(500).json({ error: 'server' }); }
});

module.exports = router;
