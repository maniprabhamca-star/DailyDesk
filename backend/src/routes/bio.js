// Link in Bio (Pro) — one shareable page per account at /u/<handle>, with a
// display name, avatar, short bio, and a reorderable list of links. The editor
// is Pro-gated; the public page is served to anyone (no auth) and counts views.
// Everything the visitor sees is stored in `config` (JSONB) and sanitized on
// write so a page can't smuggle scripts or junk URLs.
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');
const { trackEvent } = require('../utils/trackEvent');
const db = require('../db');

const router = express.Router();

const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// Handles that would collide with a real route or read as impersonation.
const RESERVED = new Set([
  'admin', 'api', 'app', 'about', 'account', 'login', 'register', 'help', 'support',
  'u', 'user', 'users', 'bio', 'diemdesk', 'official', 'root', 'system', 'settings',
  'pricing', 'privacy', 'terms', 'security', 'contact', 'www', 'mail', 'ftp',
]);

const MAX = { name: 60, bio: 200, label: 60, url: 400, links: 30, theme: 20, avatar: 300000 };
const THEMES = new Set(['slate', 'ocean', 'sunset', 'forest', 'grape', 'mono', 'rose']);

const slugOk = (s) => typeof s === 'string' && /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(s) && !RESERVED.has(s);

// URLs must be http(s) or mailto/tel — no javascript:, data:, etc.
function cleanUrl(u) {
  const s = String(u || '').trim().slice(0, MAX.url);
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s; // bare domain → https
  return null;
}

function sanitizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const str = (v, n) => String(v == null ? '' : v).replace(/\p{Cc}/gu, '').slice(0, n).trim();
  const links = Array.isArray(c.links) ? c.links.slice(0, MAX.links) : [];
  const avatar = typeof c.avatar === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(c.avatar) && c.avatar.length <= MAX.avatar
    ? c.avatar : null;
  return {
    displayName: str(c.displayName, MAX.name),
    bio: str(c.bio, MAX.bio),
    avatar,
    theme: THEMES.has(c.theme) ? c.theme : 'slate',
    links: links
      .map((l) => ({ label: str(l && l.label, MAX.label), url: cleanUrl(l && l.url) }))
      .filter((l) => l.label && l.url),
  };
}

async function requirePro(req, res, next) {
  try {
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [req.user.userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : '';
    if (rows[0] && (rows[0].plan === 'pro' || OWNER_EMAILS.includes(email))) { req._email = email; return next(); }
    return res.status(402).json({ error: 'pro-required', message: 'Link in Bio is a Pro feature.' });
  } catch (e) { console.error('bio pro check:', e.message); return res.status(500).json({ error: 'server' }); }
}

// ---- public page (no auth) --------------------------------------------------
// A gentle limiter so the view counter can't be hammered.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120, keyGenerator: clientKey,
  store: makeStore('rl:bio-pub:'), skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate' },
});

router.get('/public/:slug', publicLimiter, async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!slugOk(slug)) return res.status(404).json({ error: 'not-found' });
  try {
    const { rows } = await db.query('SELECT slug, config, published FROM bio_pages WHERE slug = $1', [slug]);
    if (!rows[0] || !rows[0].published) return res.status(404).json({ error: 'not-found' });
    // Fire-and-forget view count (never blocks the response).
    db.query('UPDATE bio_pages SET views = views + 1 WHERE slug = $1', [slug]).catch(() => {});
    return res.json({ slug: rows[0].slug, config: rows[0].config });
  } catch (e) { console.error('bio public:', e.message); return res.status(500).json({ error: 'server' }); }
});

// GET /api/bio/check/:slug — is a handle available? (auth+pro, for the editor)
router.get('/check/:slug', requireAuth, requirePro, async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!slugOk(slug)) return res.json({ available: false, reason: 'Use 3–30 letters, numbers or hyphens.' });
  try {
    const { rows } = await db.query('SELECT user_id FROM bio_pages WHERE slug = $1', [slug]);
    const taken = rows[0] && rows[0].user_id !== req.user.userId;
    return res.json({ available: !taken, reason: taken ? 'That handle is taken.' : null });
  } catch { return res.status(500).json({ error: 'server' }); }
});

// ---- owner editor (auth + pro) ----------------------------------------------
router.get('/', requireAuth, requirePro, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT slug, config, views, published FROM bio_pages WHERE user_id = $1', [req.user.userId]);
    if (!rows[0]) return res.json({ exists: false });
    return res.json({ exists: true, slug: rows[0].slug, config: rows[0].config, views: Number(rows[0].views), published: rows[0].published });
  } catch (e) { console.error('bio get:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/bio — create the page + claim a handle (one per account).
router.post('/', requireAuth, requirePro, async (req, res) => {
  const slug = String(req.body && req.body.slug || '').toLowerCase();
  if (!slugOk(slug)) return res.status(400).json({ error: 'bad-slug', message: 'Handles are 3–30 letters, numbers or hyphens, and can’t start or end with a hyphen.' });
  const config = sanitizeConfig(req.body && req.body.config);
  try {
    const exists = await db.query('SELECT 1 FROM bio_pages WHERE user_id = $1', [req.user.userId]);
    if (exists.rows.length) return res.status(409).json({ error: 'exists', message: 'You already have a Link in Bio page — edit it instead.' });
    const ins = await db.query(
      'INSERT INTO bio_pages (user_id, slug, config) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING RETURNING slug',
      [req.user.userId, slug, config]);
    if (!ins.rows.length) return res.status(409).json({ error: 'slug-taken', message: 'That handle is taken — pick another.' });
    trackEvent(req, 'bio_created', { module: '/link-in-bio', userId: req.user.userId });
    return res.status(201).json({ slug, config });
  } catch (e) { console.error('bio create:', e.message); return res.status(500).json({ error: 'server' }); }
});

// PUT /api/bio — update config (and optionally the handle + published flag).
router.put('/', requireAuth, requirePro, async (req, res) => {
  const config = sanitizeConfig(req.body && req.body.config);
  const wantSlug = req.body && req.body.slug != null ? String(req.body.slug).toLowerCase() : null;
  const published = typeof (req.body && req.body.published) === 'boolean' ? req.body.published : null;
  try {
    const cur = await db.query('SELECT slug FROM bio_pages WHERE user_id = $1', [req.user.userId]);
    if (!cur.rows.length) return res.status(404).json({ error: 'no-page' });
    let slug = cur.rows[0].slug;
    if (wantSlug && wantSlug !== slug) {
      if (!slugOk(wantSlug)) return res.status(400).json({ error: 'bad-slug', message: 'Handles are 3–30 letters, numbers or hyphens.' });
      const clash = await db.query('SELECT 1 FROM bio_pages WHERE slug = $1 AND user_id <> $2', [wantSlug, req.user.userId]);
      if (clash.rows.length) return res.status(409).json({ error: 'slug-taken', message: 'That handle is taken.' });
      slug = wantSlug;
    }
    await db.query(
      `UPDATE bio_pages SET slug = $2, config = $3, published = COALESCE($4, published), updated_at = now() WHERE user_id = $1`,
      [req.user.userId, slug, config, published]);
    return res.json({ slug, config });
  } catch (e) { console.error('bio update:', e.message); return res.status(500).json({ error: 'server' }); }
});

// DELETE /api/bio — remove the page + free the handle.
router.delete('/', requireAuth, requirePro, async (req, res) => {
  try {
    await db.query('DELETE FROM bio_pages WHERE user_id = $1', [req.user.userId]);
    return res.json({ ok: true });
  } catch (e) { console.error('bio delete:', e.message); return res.status(500).json({ error: 'server' }); }
});

module.exports = router;
