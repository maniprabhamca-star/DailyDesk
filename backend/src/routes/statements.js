// Statement Converter page-quota meter — the monetization gate for the flagship.
//
// PRIVACY: the statement itself is NEVER sent here. The browser converts the file
// entirely on-device; it sends only a PAGE COUNT (a number) so we can enforce the
// allowance and know when to show the upgrade prompt. We store a per-user (or
// per-IP for anonymous) monthly page tally in Redis — nothing about the document.
//
// ⚠ This endpoint used to meter the free tier and nobody else:
//
//     if (isPaidPlan(who.plan) || who.isOwner) return res.json({ unlimited: true, limit: null })
//
// One branch for "has paid", and it handed out unlimited. That was defensible
// when there was one paid plan and the statement converter was its own product.
// It stopped being defensible the day /pricing started printing 5 · 20 · 300 and
// /compare started printing $0.063 a page — which is $19 ÷ 300, a number that
// means nothing if 300 is not a real ceiling. Worse, Pro and Business were
// treated identically, so $5.98 bought exactly what $19 bought and the tier we
// had just built had no volume advantage in code at all.
//
// Allowances now come from config/tiers.js, which is pinned against the pricing
// page by frontend/tests/unit/tier-allowances.test.ts. The owner is the only
// caller who still gets `unlimited`.
//
// Enforcement (the 402) stays behind STATEMENT_QUOTA_ENABLED so the meter can
// record real usage before it starts refusing anyone. Metering is unconditional:
// we want the numbers from day one, and a counter that only runs when
// enforcement is on gives you an empty month the day you turn enforcement on.
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');
const redis = require('../utils/redis');
const db = require('../db');
const { statementAllowance } = require('../config/tiers');

const router = express.Router();

const ENABLED = process.env.STATEMENT_QUOTA_ENABLED === 'true'; // block over-limit only when true
const TTL = 35 * 86400; // ~a month + slack, then the key self-cleans
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const month = () => new Date().toISOString().slice(0, 7); // YYYY-MM

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

/** The shape both endpoints answer in, so the client has one thing to read. */
function shape(allow, used, extra = {}) {
  const unlimited = allow.limit === null;
  return {
    // `pro` means "pays us something", kept for the existing client which uses
    // it only to decide whether to show the upgrade prompt.
    pro: allow.tier !== 'free',
    tier: allow.tier,
    unlimited,
    limit: unlimited ? null : allow.limit,
    included: allow.included,
    credits: allow.credits,
    used: unlimited ? 0 : used,
    remaining: unlimited ? null : Math.max(0, allow.limit - used),
    enforced: ENABLED,
    ...extra,
  };
}

router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: clientKey,
  store: makeStore('rl:stmt:'),
  skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Too many requests — try again in a moment.' },
}));

// Current usage — used by the tool to show "N of your 300 pages used this month".
router.get('/quota', async (req, res) => {
  const who = await whoIs(req);
  const allow = statementAllowance(who);
  if (allow.limit === null) return res.json(shape(allow, 0));
  // Redis down: report the full allowance rather than a figure we cannot read.
  // Never report 0 remaining on an infra fault — that reads as "you are out".
  if (redisDown()) return res.json(shape(allow, 0, { metered: false }));
  let used = 0;
  try { used = Number(await redis.get(keyFor(who, req))) || 0; } catch { /* fail-open */ }
  return res.json(shape(allow, used));
});

// Consume `pages` before an export. Returns whether it's allowed; the tool only
// downloads the file locally when allowed. Never receives the statement itself.
router.post('/consume', express.json({ limit: '4kb' }), async (req, res) => {
  const pages = Math.max(0, Math.min(5000, Math.floor(Number(req.body && req.body.pages) || 0)));
  const who = await whoIs(req);
  const allow = statementAllowance(who);

  if (allow.limit === null) return res.json({ allowed: true, ...shape(allow, 0) });
  // Never block on infra trouble — a metering hiccup must not stop a conversion
  // somebody has already paid for, and the statement is already parsed by now.
  if (redisDown()) return res.json({ allowed: true, ...shape(allow, 0, { metered: false }) });

  const key = keyFor(who, req);
  let used = 0;
  try { used = Number(await redis.get(key)) || 0; } catch { /* fail-open */ }

  // Block only when enforcement is on AND the allowance is already spent.
  // Deliberately `used >= limit` rather than `used + pages > limit`: a 40-page
  // statement on a 20-page allowance converts, goes 20 over, and the NEXT one is
  // refused. Refusing the job that would overshoot means a Pro subscriber with a
  // single 40-page statement can never convert anything at all, which is a worse
  // answer than letting one job run long and metering it honestly.
  if (ENABLED && used >= allow.limit) {
    return res.status(402).json({
      allowed: false,
      reason: 'quota',
      ...shape(allow, used),
      message: allow.tier === 'business'
        ? `You've used all ${allow.limit} statement pages on your plan this month. They reset on the 1st.`
        : `You've used your ${allow.limit} statement page${allow.limit === 1 ? '' : 's'} this month. Upgrade to keep converting.`,
      upgradeTo: allow.tier === 'free' ? 'pro' : allow.tier === 'pro' ? 'business' : null,
    });
  }

  try { await redis.pipeline().incrby(key, pages).expire(key, TTL).exec(); } catch { /* best effort */ }
  return res.json({ allowed: true, ...shape(allow, used + pages) });
});

module.exports = router;
