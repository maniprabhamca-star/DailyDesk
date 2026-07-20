// Hard cost controls for DiemDesk's AI features, so AI can NEVER cost more than it
// earns (the promise in the AI-cost-control plan). Three independent ceilings:
//
//   1) Per-user MONTHLY cap    (AI_USER_MONTHLY_MAX actions/month) — fair-use per
//      account, sized well under the price. Monthly (not daily) so we never
//      advertise a per-day number and a burst can't drain a whole allowance in an
//      hour. Each action's OUTPUT is already bounded by max_tokens (~700) → a
//      single action costs ~$0.02, so 100/mo ≈ $2 worst case, far under the ~$5.69
//      blended revenue/user.
//   2) Global MONTHLY budget   (AI_GLOBAL_MONTHLY_USD, optional) — set this to
//      ~20% of the month's Pro revenue at launch. When the month's spend crosses
//      it, AI pauses for everyone until next month. This is the line that makes AI
//      spend *mathematically* unable to exceed revenue (it's a % of it).
//   3) Global DAILY budget     (AI_GLOBAL_DAILY_USD) — a hard money backstop while
//      revenue is still $0 (owner testing / pre-launch), independent of #2.
//
// Money is tracked in integer micro-dollars to avoid float drift. Redis outage →
// the per-user cap fails open (a hiccup shouldn't block a payer), but the bounded
// max_tokens + the two global budgets still cap the blast radius.
const redis = require('./redis');
const { redisDown } = require('./rateLimitStore');

const USER_MONTHLY_MAX = Number(process.env.AI_USER_MONTHLY_MAX || 100);
const GLOBAL_DAILY_USD = Number(process.env.AI_GLOBAL_DAILY_USD || 5);
// 0 = disabled (use the daily backstop only). At Pro launch, set this to ~20% of
// expected monthly Pro revenue so AI can never exceed a fraction of income.
const GLOBAL_MONTHLY_USD = Number(process.env.AI_GLOBAL_MONTHLY_USD || 0);
// Claude Haiku list price (USD per 1M tokens). Override via env if pricing changes.
const PRICE_IN = Number(process.env.AI_PRICE_IN_PER_MTOK || 1.0);
const PRICE_OUT = Number(process.env.AI_PRICE_OUT_PER_MTOK || 5.0);
const DAY_TTL = 93600;          // 26h — covers the UTC day + slack
const MONTH_TTL = 35 * 86400;   // 35d — covers the calendar month + slack

function day() { return new Date().toISOString().slice(0, 10); }   // YYYY-MM-DD
function month() { return new Date().toISOString().slice(0, 7); }  // YYYY-MM
function costUsd(inTok, outTok) { return (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT; }

// Call BEFORE a request. Returns { ok, reason, message, remaining, extra }.
// `weight` = how many actions this request counts as against the user's monthly
// cap (translate = 3: its output is ~the whole document, not a 700-token answer).
async function check(userId, weight = 1) {
  if (redisDown()) return { ok: true, remaining: null }; // degrade to allow (bounded by max_tokens)
  const d = day();
  const m = month();
  try {
    // Global budgets first — they protect the whole business, not one user.
    if (GLOBAL_MONTHLY_USD > 0) {
      const spentMonthMicro = Number(await redis.get(`ai:spend:m:${m}`)) || 0;
      if (spentMonthMicro / 1e6 >= GLOBAL_MONTHLY_USD) {
        return { ok: false, reason: 'ai-budget', message: "The assistant has reached this month's limit — it'll be back next month." };
      }
    }
    const spentDayMicro = Number(await redis.get(`ai:spend:${d}`)) || 0;
    if (spentDayMicro / 1e6 >= GLOBAL_DAILY_USD) {
      return { ok: false, reason: 'ai-budget', message: "The assistant has hit today's limit — it'll be back tomorrow." };
    }
    // Per-user monthly fair-use cap.
    const uKey = `ai:u:${userId}:${m}`;
    const used = Number(await redis.get(uKey)) || 0;
    if (used + weight > USER_MONTHLY_MAX) {
      return { ok: false, reason: 'ai-limit', message: `You've reached this month's limit of ${USER_MONTHLY_MAX} AI actions. It resets next month.`, extra: { limit: USER_MONTHLY_MAX } };
    }
    return { ok: true, remaining: USER_MONTHLY_MAX - used };
  } catch {
    return { ok: true, remaining: null }; // fail-open on a Redis error
  }
}

// Call AFTER a successful AI call to record the user's monthly count + global spend
// (both daily and monthly, so either backstop can enforce and the dashboard can show).
async function record(userId, inTok, outTok, weight = 1) {
  if (redisDown()) return;
  const d = day();
  const m = month();
  const micro = Math.max(0, Math.round(costUsd(inTok, outTok) * 1e6));
  try {
    await redis.pipeline()
      .incrby(`ai:u:${userId}:${m}`, Math.max(1, weight)).expire(`ai:u:${userId}:${m}`, MONTH_TTL)
      .incrby(`ai:spend:${d}`, micro).expire(`ai:spend:${d}`, DAY_TTL)
      .incrby(`ai:spend:m:${m}`, micro).expire(`ai:spend:m:${m}`, MONTH_TTL)
      .exec();
  } catch { /* best-effort; the next check just sees slightly stale spend */ }
}

// For the dashboard/health surface: today's + this month's spend vs the ceilings.
async function status() {
  const d = day();
  const m = month();
  let daySpend = 0;
  let monthSpend = 0;
  try { daySpend = (Number(await redis.get(`ai:spend:${d}`)) || 0) / 1e6; } catch { /* ignore */ }
  try { monthSpend = (Number(await redis.get(`ai:spend:m:${m}`)) || 0) / 1e6; } catch { /* ignore */ }
  return {
    daySpend, monthSpend,
    dailyBudget: GLOBAL_DAILY_USD,
    monthlyBudget: GLOBAL_MONTHLY_USD || null,
    userMonthlyMax: USER_MONTHLY_MAX,
  };
}

module.exports = { check, record, status, costUsd, USER_MONTHLY_MAX, GLOBAL_DAILY_USD, GLOBAL_MONTHLY_USD };
