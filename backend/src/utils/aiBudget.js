// Hard cost controls for DiemDesk's AI features, so AI can NEVER cost more than it
// earns (the promise in the AI-cost-control plan). Three independent ceilings:
//
//   1) Per-user MONTHLY cap    (AI_USER_MONTHLY_MAX actions/month) — fair-use per
//      account, sized well under the price. Monthly (not daily) so we never
//      advertise a per-day number and a burst can't drain a whole allowance in an
//      hour. Each action's OUTPUT is already bounded by max_tokens (~700) → a
//      single action costs ~$0.02, so 50/mo ≈ $1 worst case against ~$5.69
//      blended revenue/user. Receipt scans are cheaper still (~$0.005), so the
//      cap bites on the expensive actions first, which is the right order.
//      Lowered 100 → 50 on 2026-08-29 by the owner. Raise it from the admin
//      console (Redis `ai:cfg:user_monthly_max`) rather than here — that takes
//      effect without a restart, and this default is only the floor beneath it.
//   2) Global MONTHLY budget   (AI_GLOBAL_MONTHLY_USD, optional) — set this to
//      ~20% of the month's Pro revenue at launch. When the month's spend crosses
//      it, AI pauses for everyone until next month. This is the line that makes AI
//      spend *mathematically* unable to exceed revenue (it's a % of it).
//   3) Global DAILY budget     (AI_GLOBAL_DAILY_USD) — a hard money backstop while
//      revenue is still $0 (owner testing / pre-launch), independent of #2.
//
// Each ceiling has an optional RUNTIME OVERRIDE in Redis (`ai:cfg:*`) so the owner
// can tune budgets from the admin console without a backend restart, plus a hard
// manual kill (`ai:kill` = "1") that pauses the whole assistant instantly.
//
// Money is tracked in integer micro-dollars to avoid float drift. Redis outage →
// the per-user cap fails open (a hiccup shouldn't block a payer), but the bounded
// max_tokens + the two global budgets still cap the blast radius.
const redis = require('./redis');
const { redisDown } = require('./rateLimitStore');

const USER_MONTHLY_MAX = Number(process.env.AI_USER_MONTHLY_MAX || 50);
const GLOBAL_DAILY_USD = Number(process.env.AI_GLOBAL_DAILY_USD || 5);
// 0 = disabled (use the daily backstop only). At Pro launch, set this to ~20% of
// expected monthly Pro revenue so AI can never exceed a fraction of income.
const GLOBAL_MONTHLY_USD = Number(process.env.AI_GLOBAL_MONTHLY_USD || 0);
// Claude Haiku list price (USD per 1M tokens). Override via env if pricing changes.
const PRICE_IN = Number(process.env.AI_PRICE_IN_PER_MTOK || 1.0);
const PRICE_OUT = Number(process.env.AI_PRICE_OUT_PER_MTOK || 5.0);
const DAY_TTL = 93600;          // 26h — covers the UTC day + slack
const MONTH_TTL = 35 * 86400;   // 35d — covers the calendar month + slack

// Runtime-override keys (set from the admin console; unset => fall back to env).
const CFG_DAILY = 'ai:cfg:global_daily_usd';
const CFG_MONTHLY = 'ai:cfg:global_monthly_usd';
const CFG_USER = 'ai:cfg:user_monthly_max';
const KILL = 'ai:kill'; // "1" => assistant hard-paused for everyone

function day() { return new Date().toISOString().slice(0, 10); }   // YYYY-MM-DD
function month() { return new Date().toISOString().slice(0, 7); }  // YYYY-MM
function costUsd(inTok, outTok) { return (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT; }

function toNum(v, def) {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Effective ceilings = Redis override if set, else the env default. One MGET.
async function effLimits() {
  let vals = [null, null, null];
  try { vals = await redis.mget(CFG_DAILY, CFG_MONTHLY, CFG_USER); } catch { /* use env */ }
  return {
    daily: toNum(vals[0], GLOBAL_DAILY_USD),
    monthly: toNum(vals[1], GLOBAL_MONTHLY_USD),
    userMax: toNum(vals[2], USER_MONTHLY_MAX),
    overrides: { daily: toNum(vals[0], null), monthly: toNum(vals[1], null), userMax: toNum(vals[2], null) },
  };
}

async function isKilled() {
  try { return (await redis.get(KILL)) === '1'; } catch { return false; }
}

// Call BEFORE a request. Returns { ok, reason, message, remaining, extra }.
// `weight` = how many actions this request counts as against the user's monthly
// cap (translate = 3: its output is ~the whole document, not a 700-token answer).
async function check(userId, weight = 1) {
  if (redisDown()) return { ok: true, remaining: null }; // degrade to allow (bounded by max_tokens)
  const d = day();
  const m = month();
  try {
    // Hard manual kill — the owner paused the whole assistant from admin.
    if (await isKilled()) {
      return { ok: false, reason: 'ai-paused', message: 'The AI assistant is temporarily paused. Please check back soon.' };
    }
    const lim = await effLimits();
    // Global budgets first — they protect the whole business, not one user.
    if (lim.monthly > 0) {
      const spentMonthMicro = Number(await redis.get(`ai:spend:m:${m}`)) || 0;
      if (spentMonthMicro / 1e6 >= lim.monthly) {
        return { ok: false, reason: 'ai-budget', message: "The assistant has reached this month's limit — it'll be back next month." };
      }
    }
    const spentDayMicro = Number(await redis.get(`ai:spend:${d}`)) || 0;
    if (spentDayMicro / 1e6 >= lim.daily) {
      return { ok: false, reason: 'ai-budget', message: "The assistant has hit today's limit — it'll be back tomorrow." };
    }
    // Per-user monthly fair-use cap.
    const uKey = `ai:u:${userId}:${m}`;
    const used = Number(await redis.get(uKey)) || 0;
    if (used + weight > lim.userMax) {
      return { ok: false, reason: 'ai-limit', message: `You've reached this month's limit of ${lim.userMax} AI actions. It resets next month.`, extra: { limit: lim.userMax } };
    }
    return { ok: true, remaining: lim.userMax - used };
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

// Top AI users this month by action count (scan `ai:u:*:${month}`). Returns
// [{ userId, actions }] sorted desc. Bounded by `limit`. Best-effort — [] if Redis
// is down. userId is a UUID (no colons) so the key splits cleanly.
async function topUsers(limit = 10) {
  const m = month();
  const match = `ai:u:*:${m}`;
  const keys = [];
  try {
    await new Promise((resolve, reject) => {
      const stream = redis.scanStream({ match, count: 200 });
      stream.on('data', (batch) => { for (const k of batch) keys.push(k); });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    if (!keys.length) return [];
    const vals = await redis.mget(...keys);
    const rows = keys.map((k, i) => {
      const parts = k.split(':'); // ['ai','u',userId,YYYY-MM]
      return { userId: parts[2], actions: Number(vals[i]) || 0 };
    }).filter((r) => r.userId && r.actions > 0);
    rows.sort((a, b) => b.actions - a.actions);
    return rows.slice(0, limit);
  } catch {
    return [];
  }
}

// Full admin surface: live spend, EFFECTIVE ceilings (override or env), which are
// overridden, kill state, Redis health, and the top users this month.
async function adminStatus() {
  const d = day();
  const m = month();
  const down = redisDown();
  let daySpend = 0;
  let monthSpend = 0;
  try { daySpend = (Number(await redis.get(`ai:spend:${d}`)) || 0) / 1e6; } catch { /* ignore */ }
  try { monthSpend = (Number(await redis.get(`ai:spend:m:${m}`)) || 0) / 1e6; } catch { /* ignore */ }
  const lim = await effLimits();
  const killed = await isKilled();
  const users = down ? [] : await topUsers(10);
  return {
    redisDown: down,
    killed,
    daySpend,
    monthSpend,
    dailyBudget: lim.daily,
    monthlyBudget: lim.monthly || null,
    userMonthlyMax: lim.userMax,
    envDefaults: { dailyBudget: GLOBAL_DAILY_USD, monthlyBudget: GLOBAL_MONTHLY_USD || null, userMonthlyMax: USER_MONTHLY_MAX },
    overrides: lim.overrides,
    topUsers: users,
  };
}

// Admin write path. Body fields (all optional):
//   kill: boolean                 -> set/clear ai:kill
//   global_daily_usd:  number|null (>=0, null clears the override)
//   global_monthly_usd:number|null (>=0, 0/null clears)
//   user_monthly_max:  number|null (>=1, null clears)
// Returns the fresh adminStatus().
async function setConfig(body = {}) {
  const ops = [];
  const setNum = (key, v, min) => {
    if (v === undefined) return; // not provided → leave as-is
    if (v === null || v === '') { ops.push(['del', key]); return; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < min) throw new Error(`Invalid value for ${key}`);
    ops.push(['set', key, String(n)]);
  };
  setNum(CFG_DAILY, body.global_daily_usd, 0);
  setNum(CFG_MONTHLY, body.global_monthly_usd, 0);
  setNum(CFG_USER, body.user_monthly_max, 1);
  if (body.kill !== undefined) {
    if (body.kill) ops.push(['set', KILL, '1']);
    else ops.push(['del', KILL]);
  }
  for (const op of ops) {
    if (op[0] === 'del') await redis.del(op[1]);
    else await redis.set(op[1], op[2]);
  }
  return adminStatus();
}

module.exports = {
  check, record, status, adminStatus, setConfig, topUsers, costUsd,
  USER_MONTHLY_MAX, GLOBAL_DAILY_USD, GLOBAL_MONTHLY_USD,
};
