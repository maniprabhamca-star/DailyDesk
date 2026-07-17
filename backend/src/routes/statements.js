// Statement Converter page-quota meter — the monetization gate for the flagship.
//
// PRIVACY: the statement itself is NEVER sent here. The browser converts the file
// entirely on-device; it sends only a PAGE COUNT (a number) so we can enforce the
// free allowance and know when to show the upgrade prompt. We store a per-user (or
// per-IP for anonymous) monthly page tally in Redis — nothing about the document.
//
// Enforcement is behind STATEMENT_QUOTA_ENABLED (default off) so the meter can ship
// and record usage without blocking anyone until the Statements tier goes live.
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');
const redis = require('../utils/redis');
const db = require('../db');

const router = express.Router();

const FREE_PAGES = Number(process.env.STATEMENT_FREE_PAGES || 5);
const ENABLED = process.env.STATEMENT_QUOTA_ENABLED === 'true'; // block over-limit only when true
const TTL = 35 * 86400; // ~a month + slack, then the key self-cleans
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const month = () => new Date().toISOString().slice(0, 10).slice(0, 7); // YYYY-MM

async function whoIs(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return { plan: null, userId: null, isOwner: false };
  try {
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [decoded.userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : null;
    return { plan: rows[0] ? rows[0].plan : null, userId: decoded.userId, isOwner: !!email && OWNER_EMAILS.includes(email) };
  } catch { return { plan: null, userId: null, isOwner: false }; }
}

const keyFor = (who, req) => `stmt:pages:${who.userId || clientKey(req)}:${month()}`;

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: clientKey,
  store: makeStore('rl:stmt:'),
  skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Too many requests — try again in a moment.' },
}));

// Current usage — used by the tool to show "N of 5 free pages used this month".
router.get('/quota', async (req, res) => {
  const who = await whoIs(req);
  if (who.plan === 'pro' || who.isOwner) return res.json({ pro: true, unlimited: true, limit: null, used: 0, remaining: null });
  if (redisDown()) return res.json({ pro: false, unlimited: false, limit: FREE_PAGES, used: 0, remaining: FREE_PAGES });
  let used = 0;
  try { used = Number(await redis.get(keyFor(who, req))) || 0; } catch { /* fail-open */ }
  return res.json({ pro: false, unlimited: false, limit: FREE_PAGES, used, remaining: Math.max(0, FREE_PAGES - used), enforced: ENABLED });
});

// Consume `pages` before an export. Returns whether it's allowed; the tool only
// downloads the file locally when allowed. Never receives the statement itself.
router.post('/consume', express.json({ limit: '4kb' }), async (req, res) => {
  const pages = Math.max(0, Math.min(5000, Math.floor(Number(req.body && req.body.pages) || 0)));
  const who = await whoIs(req);
  if (who.plan === 'pro' || who.isOwner) return res.json({ allowed: true, pro: true, remaining: null });
  if (redisDown()) return res.json({ allowed: true, unlimited: false, limit: FREE_PAGES, remaining: FREE_PAGES }); // never block on infra trouble

  const key = keyFor(who, req);
  let used = 0;
  try { used = Number(await redis.get(key)) || 0; } catch { /* fail-open */ }

  // Block only when enforcement is on AND the allowance is already spent.
  if (ENABLED && used >= FREE_PAGES) {
    return res.status(402).json({
      allowed: false, reason: 'quota', limit: FREE_PAGES, used, remaining: 0,
      message: `You've used your ${FREE_PAGES} free statement pages this month. Upgrade to keep converting.`,
    });
  }

  try { await redis.pipeline().incrby(key, pages).expire(key, TTL).exec(); } catch { /* best effort */ }
  const nowUsed = used + pages;
  return res.json({ allowed: true, unlimited: false, limit: FREE_PAGES, used: nowUsed, remaining: Math.max(0, FREE_PAGES - nowUsed) });
});

module.exports = router;
