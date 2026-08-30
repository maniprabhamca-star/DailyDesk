// Who is calling, and what are they allowed to do.
//
// This used to live inside routes/convert.js, which meant the daily free
// allowance protected exactly the routes that happened to hang off that one
// router. OCR is a separate router and a genuinely expensive endpoint
// (20-page batches, 90 MB, a 180 s timeout) and had no meter at all — safe
// only because a coming_soon flag kept it owner-only. The moment that flag
// flipped it would have been free and unlimited to anyone.
//
// So the two decisions live here now and any router can apply them.

const jwt = require('jsonwebtoken');
const db = require('../db');
const redis = require('./redis');
const { redisDown } = require('./rateLimitStore');
const { clientKey } = require('./rateLimitKey');
const { isCanaryReq } = require('./canary');
const mcpTokens = require('../controllers/mcpTokenController');

// Mirrors routes/ai.js so "owner" means the same person everywhere.
const OWNER_EMAILS = (process.env.OWNER_EMAILS || process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Identify the caller from the Bearer token. Never throws. */
async function whoIs(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return { plan: null, email: null, userId: null, isOwner: false };
  const bearer = h.slice(7);

  // An MCP token first. These live in a config file on someone's disk and do
  // not expire, which is the whole point: a login JWT lapsing after 30 days
  // told a paying subscriber "you need a Pro account" — wrong, and with
  // nothing they could do about it.
  const viaMcp = await mcpTokens.resolve(bearer);
  if (viaMcp) {
    const email = String(viaMcp.email || '').toLowerCase();
    return {
      plan: viaMcp.plan,
      email,
      userId: viaMcp.userId,
      isOwner: !!email && OWNER_EMAILS.includes(email),
    };
  }

  try {
    const decoded = jwt.verify(bearer, process.env.JWT_SECRET);
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [decoded.userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : null;
    return {
      plan: rows[0] ? rows[0].plan : null,
      email,
      userId: decoded.userId,
      isOwner: !!email && OWNER_EMAILS.includes(email),
    };
  } catch {
    return { plan: null, email: null, userId: null, isOwner: false };
  }
}

/**
 * Pro-only. Use for a tool that costs us real server time and is not sold on
 * the "a few free a day" plan — 402 is the honest status here: the request was
 * understood and refused for payment, not malformed.
 *
 * The canary is a health probe rather than a customer, so it passes.
 */
function requirePro({ message = 'This is a Pro feature.' } = {}) {
  return async (req, res, next) => {
    if (isCanaryReq(req)) return next();
    let who;
    try {
      who = await whoIs(req);
    } catch {
      // Identity lookup broken (DB hiccup). Fail CLOSED: this middleware exists
      // to stop an expensive endpoint being used for free, and an outage is not
      // a reason to hand it out.
      return res.status(503).json({ error: 'unavailable', message: 'Could not check your account just now — please try again.' });
    }
    if (who.plan === 'pro' || who.isOwner) {
      req.isPro = true;
      req._userId = who.userId;
      return next();
    }
    return res.status(402).json({ error: 'pro-required', message });
  };
}

/**
 * The free daily allowance for server-cost work: N a day free, Pro unlimited.
 * Counted only on SUCCESS — the caller increments `req._convKey` once the work
 * actually produced something, so a failed conversion never costs somebody
 * one of their three.
 *
 * FAILS OPEN on any Redis/DB trouble: infra problems should not block paying
 * and free users alike from using the site.
 */
function dailyQuota({ limit, keyPrefix = 'conv:day', message } = {}) {
  return async (req, res, next) => {
    if (isCanaryReq(req)) return next(); // health probe, never metered
    let who = null;
    try { who = await whoIs(req); } catch { who = null; }
    if (who && (who.plan === 'pro' || who.isOwner)) {
      req.isPro = true;
      req._userId = who.userId;
      return next();
    }
    if (who) req._userId = who.userId;
    if (redisDown()) return next();

    const max = Number(limit) || 3;
    const day = new Date().toISOString().slice(0, 10); // UTC calendar day
    const key = `${keyPrefix}:${clientKey(req)}:${day}`;
    try {
      const used = Number(await redis.get(key)) || 0;
      if (used >= max) {
        return res.status(429).json({
          error: 'daily-limit',
          limit: max,
          message: message || `You've used your ${max} free document conversions for today.`,
        });
      }
      req._convKey = key; // counted only once the work actually succeeds
    } catch { /* fail open */ }
    return next();
  };
}

/** Count one successful use against the caller's allowance. */
function countUse(req) {
  if (!req._convKey) return;
  redis.pipeline().incr(req._convKey).expire(req._convKey, 93600).exec().catch(() => {});
}

module.exports = { whoIs, requirePro, dailyQuota, countUse, OWNER_EMAILS };
