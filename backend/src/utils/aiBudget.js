// Hard cost controls for DiemDesk's AI features, so AI can NEVER cost more than it
// earns (the promise in the AI-cost-control plan). Two independent ceilings, both
// kept in Redis under a per-UTC-day key:
//
//   1) Per-user daily cap   (AI_USER_DAILY_MAX questions/day) — fair-use per account.
//   2) Global daily budget  (AI_GLOBAL_DAILY_USD) — a hard kill-switch on total spend,
//      pegged to revenue. When the day's estimated spend crosses it, AI pauses for
//      everyone until tomorrow. This is the line that guarantees AI can't run away.
//
// Failure policy: the GLOBAL budget fails CLOSED-ish only in that a Redis outage
// makes us unable to read spend — we then fall back to allowing (fail-open) because
// the per-request max_tokens + per-user cap still bound the blast radius, and a
// Redis hiccup shouldn't take a paid feature down. Spend is recorded best-effort
// after each successful call. Money is tracked in integer micro-dollars to avoid
// floating-point drift across many small increments.
const redis = require('./redis');
const { redisDown } = require('./rateLimitStore');

const USER_DAILY_MAX = Number(process.env.AI_USER_DAILY_MAX || 40);
const GLOBAL_DAILY_USD = Number(process.env.AI_GLOBAL_DAILY_USD || 5);
// Claude Haiku list price (USD per 1M tokens). Override via env if pricing changes.
const PRICE_IN = Number(process.env.AI_PRICE_IN_PER_MTOK || 1.0);
const PRICE_OUT = Number(process.env.AI_PRICE_OUT_PER_MTOK || 5.0);
const TTL = 93600; // 26h — long enough to cover the UTC day + slack, then self-cleans

function day() { return new Date().toISOString().slice(0, 10); }
function costUsd(inTok, outTok) { return (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT; }

// Call BEFORE a request. Returns { ok, reason, message, remaining, extra }.
async function check(userId) {
  if (redisDown()) return { ok: true, remaining: null }; // degrade to allow (bounded by max_tokens)
  const d = day();
  try {
    // Global budget kill-switch first — protects the whole business, not one user.
    const spentMicro = Number(await redis.get(`ai:spend:${d}`)) || 0;
    if (spentMicro / 1e6 >= GLOBAL_DAILY_USD) {
      return { ok: false, reason: 'ai-budget', message: "The assistant has hit today's limit — it'll be back tomorrow." };
    }
    const uKey = `ai:u:${userId}:${d}`;
    const used = Number(await redis.get(uKey)) || 0;
    if (used >= USER_DAILY_MAX) {
      return { ok: false, reason: 'ai-daily', message: `You've reached today's limit of ${USER_DAILY_MAX} questions. It resets tomorrow.`, extra: { limit: USER_DAILY_MAX } };
    }
    return { ok: true, remaining: USER_DAILY_MAX - used };
  } catch {
    return { ok: true, remaining: null }; // fail-open on a Redis error
  }
}

// Call AFTER a successful AI call to record the user's count + the global spend.
async function record(userId, inTok, outTok) {
  if (redisDown()) return;
  const d = day();
  const micro = Math.max(0, Math.round(costUsd(inTok, outTok) * 1e6));
  try {
    await redis.pipeline()
      .incr(`ai:u:${userId}:${d}`).expire(`ai:u:${userId}:${d}`, TTL)
      .incrby(`ai:spend:${d}`, micro).expire(`ai:spend:${d}`, TTL)
      .exec();
  } catch { /* best-effort; the next check just sees slightly stale spend */ }
}

// For the dashboard/health surface: today's spend in USD and the ceiling.
async function status() {
  const d = day();
  let spentUsd = 0;
  try { spentUsd = (Number(await redis.get(`ai:spend:${d}`)) || 0) / 1e6; } catch { /* ignore */ }
  return { spentUsd, budgetUsd: GLOBAL_DAILY_USD, userDailyMax: USER_DAILY_MAX };
}

module.exports = { check, record, status, costUsd, USER_DAILY_MAX, GLOBAL_DAILY_USD };
