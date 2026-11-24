#!/usr/bin/env node
/**
 * The statement page meter, exercised with enforcement ON.
 *
 * Production runs with STATEMENT_QUOTA_ENABLED unset, so the 402 branch — the
 * one that actually refuses a conversion — never executes there and cannot be
 * verified by poking the live endpoint. That is exactly the branch worth
 * testing, because the day it is turned on is the day it either refuses the
 * right people or the wrong ones, and there is no dress rehearsal for that.
 *
 * Redis, Postgres and jsonwebtoken are stubbed through the require cache, so
 * this runs anywhere with no services. What it proves is the decision, not the
 * plumbing: who gets how many pages, who is refused, who is pointed at which
 * plan, and what happens when the meter cannot be read.
 *
 *   node scripts/test-statement-quota.js     (or: npm run test:quota)
 */
process.env.STATEMENT_QUOTA_ENABLED = 'true';
process.env.JWT_SECRET = 'test-secret';
process.env.AI_OWNER_EMAILS = 'owner@example.test';

const path = require('node:path');
const Module = require('node:module');

// ── stubs ──────────────────────────────────────────────────────────────────
const store = new Map();
let redisIsDown = false;
let redisThrows = false;

const resolve = (p) => require.resolve(path.join(__dirname, '..', 'src', p));
function stub(relPath, exports) {
  const id = resolve(relPath);
  require.cache[id] = new Module(id, null);
  require.cache[id].filename = id;
  require.cache[id].loaded = true;
  require.cache[id].exports = exports;
}

stub('utils/redis', {
  async get(k) { if (redisThrows) throw new Error('redis'); return store.has(k) ? String(store.get(k)) : null; },
  pipeline() {
    const ops = [];
    const chain = {
      incrby(k, n) { ops.push(() => store.set(k, (store.get(k) || 0) + n)); return chain; },
      expire() { return chain; },
      async exec() { if (redisThrows) throw new Error('redis'); ops.forEach((f) => f()); },
    };
    return chain;
  },
});
stub('utils/rateLimitStore', { makeStore: () => undefined, redisDown: () => redisIsDown });
stub('utils/rateLimitKey', { clientKey: () => 'anon-ip' });
stub('utils/canary', { isCanaryReq: () => false });

// Users the fake token can resolve to.
const USERS = {
  'u-free': { plan: 'free', email: 'a@example.test' },
  'u-pro': { plan: 'pro', email: 'b@example.test' },
  'u-biz': { plan: 'business', email: 'c@example.test' },
  'u-owner': { plan: 'pro', email: 'owner@example.test' },
};
stub('db', { async query(_sql, [id]) { return { rows: USERS[id] ? [USERS[id]] : [] }; } });

// The token IS the user id, so a test reads as `as('u-pro')`.
const jwtId = require.resolve('jsonwebtoken');
require.cache[jwtId] = new Module(jwtId, null);
require.cache[jwtId].loaded = true;
require.cache[jwtId].exports = {
  verify(token) { if (!USERS[token]) throw new Error('bad token'); return { userId: token }; },
};

// ── harness ────────────────────────────────────────────────────────────────
const express = require('express');
const app = express();
app.use('/api/statements', require('../src/routes/statements'));
const server = app.listen(0);
const base = () => `http://127.0.0.1:${server.address().port}/api/statements`;

const as = (u) => (u ? { Authorization: `Bearer ${u}` } : {});
const getQuota = (u) => fetch(`${base()}/quota`, { headers: as(u) }).then((r) => r.json());
const consume = (u, pages) =>
  fetch(`${base()}/consume`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...as(u) }, body: JSON.stringify({ pages }) })
    .then(async (r) => ({ status: r.status, ...(await r.json()) }));

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`}`);
}

(async () => {
  console.log('\nstatement page meter — enforcement ON\n');

  // 1. Each tier is told its own allowance, and only the owner is unlimited.
  for (const [user, limit, tier] of [[null, 5, 'free'], ['u-free', 5, 'free'], ['u-pro', 20, 'pro'], ['u-biz', 300, 'business']]) {
    const q = await getQuota(user);
    check(`${tier.padEnd(8)} allowance is ${limit}`, [q.tier, q.limit, q.unlimited], [tier, limit, false]);
  }
  const owner = await getQuota('u-owner');
  check('owner    is unlimited', [owner.tier, owner.limit, owner.unlimited], ['owner', null, true]);

  // 2. The meter counts, and the refusal arrives only once the allowance is gone.
  store.clear();
  check('pro: 15 of 20 allowed', (await consume('u-pro', 15)).remaining, 5);
  check('pro: 5 more lands exactly on the limit', (await consume('u-pro', 5)).remaining, 0);
  const refused = await consume('u-pro', 1);
  check('pro: the next page is refused with 402', [refused.status, refused.allowed, refused.reason], [402, false, 'quota']);
  check('pro: refusal points at Business', refused.upgradeTo, 'business');

  // 3. A statement longer than the allowance converts and goes over. Refusing
  //    the job that would overshoot means a Pro subscriber with one 40-page
  //    statement could never convert anything at all.
  store.clear();
  const long = await consume('u-pro', 40);
  check('pro: a 40-page statement on a 20-page plan converts', [long.status, long.allowed, long.used], [200, true, 40]);
  check('pro: and the NEXT one is refused', (await consume('u-pro', 1)).status, 402);

  // 4. Free is pointed at Pro, not at Business.
  store.clear();
  await consume('u-free', 5);
  check('free: refusal points at Pro', (await consume('u-free', 1)).upgradeTo, 'pro');

  // 5. Business is told to wait for the reset, not to upgrade to what it has.
  store.clear();
  await consume('u-biz', 300);
  const biz = await consume('u-biz', 1);
  check('business: refused at 300', biz.status, 402);
  check('business: not told to upgrade to itself', biz.upgradeTo, null);
  check('business: message says they reset', /reset/.test(biz.message), true);

  // 6. The owner is never metered.
  store.clear();
  check('owner: 5000 pages still allowed', (await consume('u-owner', 5000)).allowed, true);

  // 7. Infra trouble must not refuse a conversion the customer already paid for,
  //    and must never report 0 remaining — that reads as "you are out".
  store.clear();
  redisIsDown = true;
  const down = await consume('u-pro', 50);
  check('redis down: allowed, full allowance reported', [down.allowed, down.remaining, down.metered], [true, 20, false]);
  redisIsDown = false;

  redisThrows = true;
  check('redis errors: still allowed', (await consume('u-pro', 5)).allowed, true);
  redisThrows = false;

  server.close();
  console.log(failures ? `\n${failures} FAILED\n` : '\nall passed\n');
  process.exit(failures ? 1 : 0);
})();
