// Per-tool enable/disable control for the admin dashboard.
//   GET  /api/tools/flags      — public: map of non-default tool statuses (the site reads this)
//   GET  /api/tools/flags/all  — admin: every stored flag (for the admin UI)
//   PUT  /api/tools/flags       — admin: set a tool's status  { slug, status }
// Missing row = 'enabled' (default), so only non-enabled tools are stored.
// Fail-open: any read error returns an empty map so the site never breaks.
const express = require('express');
const db = require('../db');

const router = express.Router();
const STATUSES = new Set(['enabled', 'coming_soon', 'pro', 'disabled']);

router.get('/flags', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT slug, status FROM tool_flags WHERE status <> 'enabled'");
    const flags = {};
    for (const r of rows) flags[r.slug] = r.status;
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ flags });
  } catch (err) {
    console.error('tool flags read error:', err.message);
    res.json({ flags: {} }); // fail-open
  }
});

function requireAdmin(req, res) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token || req.headers['x-admin-token'] !== token) { res.status(404).json({ error: 'Not found' }); return false; }
  return true;
}

router.get('/flags/all', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { rows } = await db.query('SELECT slug, status, updated_at FROM tool_flags ORDER BY slug');
    res.json({ flags: rows });
  } catch (err) {
    console.error('tool flags list error:', err.message);
    res.status(500).json({ error: 'Could not load' });
  }
});

router.put('/flags', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { slug, status } = req.body || {};
  if (!slug || typeof slug !== 'string' || !STATUSES.has(status)) {
    return res.status(400).json({ error: 'slug + valid status (enabled|coming_soon|pro|disabled) required' });
  }
  try {
    await db.query(
      `INSERT INTO tool_flags (slug, status, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (slug) DO UPDATE SET status = $2, updated_at = now()`,
      [slug.slice(0, 100), status],
    );
    res.json({ ok: true, slug, status });
  } catch (err) {
    console.error('tool flags write error:', err.message);
    res.status(500).json({ error: 'Could not update' });
  }
});

module.exports = router;
