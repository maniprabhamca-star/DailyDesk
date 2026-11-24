#!/usr/bin/env node
/**
 * B6 — moving a paying customer from Pro to Business.
 *
 * This is the endpoint that takes money from someone who is ALREADY paying, by
 * editing the subscription they already hold. Every branch of it is a way to
 * get that wrong: charge twice, charge nothing, change the tier without
 * collecting, or carry a lifetime discount onto the tier that carries the
 * margin. None of those can be tested against live Stripe before the four
 * Business prices exist, and by then the first person through the door is a
 * real customer.
 *
 * So Stripe is stubbed — the SDK factory, not the network — and we assert on
 * the exact arguments the route sends it. What this proves is the decision and
 * the call shape, not that Stripe behaves as documented.
 *
 *   node scripts/test-plan-change.js     (or: npm run test:plan-change)
 */
process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
process.env.STRIPE_PRICE_ID = 'price_pro_month';
process.env.STRIPE_PRICE_ID_YEARLY = 'price_pro_year';
process.env.STRIPE_PRICE_ID_BUSINESS = 'price_biz_month';
process.env.STRIPE_PRICE_ID_BUSINESS_YEARLY = 'price_biz_year';
process.env.JWT_SECRET = 'test-secret';
// Read once at module load in routes/stripe.js, so it must be set before the
// require below — setting it later leaves the webhook permanently 'not configured'.
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_stub';

const path = require('node:path');
const Module = require('node:module');

// ── state the stubs read and the assertions inspect ────────────────────────
const state = {
  user: null,
  subs: [],
  updateArgs: null,
  updateThrows: null,
  updateReturns: null,
  dbWrites: [],
  ownerAlerts: [],
};

function stub(id, exports) {
  require.cache[id] = new Module(id, null);
  require.cache[id].filename = id;
  require.cache[id].loaded = true;
  require.cache[id].exports = exports;
}
const src = (p) => require.resolve(path.join(__dirname, '..', 'src', p));

stub(src('db'), {
  async query(sql, params) {
    if (/SELECT email, plan, stripe_customer_id/.test(sql)) return { rows: state.user ? [state.user] : [] };
    if (/^UPDATE users SET plan/.test(sql)) { state.dbWrites.push(params); return { rowCount: 1 }; }
    return { rows: [], rowCount: 0 };
  },
});
stub(src('middleware/auth'), {
  requireAuth(req, _res, next) { req.user = { userId: 'u-1' }; next(); },
});
stub(src('utils/notify'), {
  notifyOwner: async (subject, body) => { state.ownerAlerts.push({ subject, body }); },
});

// The Stripe SDK itself. `require('stripe')(key, opts)` → this object.
stub(require.resolve('stripe'), () => ({
  subscriptions: {
    async list() { return { data: state.subs }; },
    async update(id, args) {
      state.updateArgs = { id, args };
      if (state.updateThrows) throw new Error(state.updateThrows);
      return state.updateReturns || { id, status: 'active', discounts: [] };
    },
  },
  checkout: { sessions: { async create() { return { url: 'https://stub' }; } } },
  billingPortal: { sessions: { async create() { return { url: 'https://stub' }; } } },
  webhooks: { constructEvent: (b) => JSON.parse(b) },
}));

const express = require('express');
const { router, webhookHandler } = require('../src/routes/stripe');
const app = express();
// The webhook is mounted BEFORE express.json on purpose, exactly as src/index.js
// does it. Stripe signs the raw bytes, so a json parser that runs first consumes
// the body and leaves constructEvent with an object it cannot verify. Getting
// this order wrong in the real app means every webhook fails signature checking
// and no customer is ever upgraded.
app.post('/hook', express.raw({ type: '*/*' }), webhookHandler);
app.use(express.json());
app.use('/api/stripe', router);
const server = app.listen(0);
const url = (p) => `http://127.0.0.1:${server.address().port}${p}`;

const post = (p, body) =>
  fetch(url(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    // Body first, HTTP status last: the body has its own fields and must not
    // be allowed to overwrite the status we are asserting on.
    .then(async (r) => ({ ...(await r.json().catch(() => ({}))), status: r.status }));

const subOn = (priceId, interval, extra = {}) => ({
  id: 'sub_1', status: 'active', metadata: {},
  items: { data: [{ id: 'si_1', price: { id: priceId, recurring: { interval } } }] },
  ...extra,
});

function reset(plan = 'pro', priceId = 'price_pro_month', interval = 'month') {
  state.user = { email: 'a@b.test', plan, stripe_customer_id: 'cus_1' };
  state.subs = [subOn(priceId, interval)];
  state.updateArgs = null; state.updateThrows = null; state.updateReturns = null;
  state.dbWrites = []; state.ownerAlerts = [];
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`}`);
}

(async () => {
  console.log('\nB6 — Pro to Business as a plan change\n');

  // ── the happy path, and the three arguments that make it safe ────────────
  reset();
  const ok = await post('/api/stripe/change-plan', { plan: 'business', interval: 'month' });
  check('pro → business succeeds', [ok.status, ok.ok, ok.plan], [200, true, 'business']);
  check('it edits the EXISTING subscription, not a new one', state.updateArgs.id, 'sub_1');
  check('swaps the price on the existing item', state.updateArgs.args.items, [{ id: 'si_1', price: 'price_biz_month' }]);
  check('invoices the difference now', state.updateArgs.args.proration_behavior, 'always_invoice');
  check('no tier without payment', state.updateArgs.args.payment_behavior, 'error_if_incomplete');
  // The one that cannot be undone: a founding member's $0.99-off-forever must
  // not become $0.99 off Business for ever. P3 in the design doc.
  check('the founding discount is cleared', state.updateArgs.args.discounts, []);
  check('our own record is written too', state.dbWrites, [['business', 'u-1']]);

  // ── a longer commitment inside a tier is also an upgrade ─────────────────
  reset('business', 'price_biz_month', 'month');
  const yearly = await post('/api/stripe/change-plan', { plan: 'business', interval: 'year' });
  check('business monthly → annual allowed', [yearly.status, yearly.interval], [200, 'year']);

  // ── everything that must be refused ──────────────────────────────────────
  reset('business', 'price_biz_month', 'month');
  const down = await post('/api/stripe/change-plan', { plan: 'pro', interval: 'month' });
  check('business → pro is refused, not half-done', [down.status, down.reason], [400, 'downgrade']);
  check('and nothing was sent to Stripe', state.updateArgs, null);

  reset('business', 'price_biz_year', 'year');
  const shorter = await post('/api/stripe/change-plan', { plan: 'business', interval: 'month' });
  check('annual → monthly is refused', shorter.status, 400);

  reset('business', 'price_biz_month', 'month');
  check('already on it → 400, no Stripe call', (await post('/api/stripe/change-plan', { plan: 'business', interval: 'month' })).status, 400);
  check('  (really no call)', state.updateArgs, null);

  reset('free');
  check('a free user is sent to the pricing page', (await post('/api/stripe/change-plan', { plan: 'business' })).status, 400);

  reset(); state.user.stripe_customer_id = null;
  check('paid plan with no Stripe customer → 409, by hand', (await post('/api/stripe/change-plan', { plan: 'business' })).status, 409);

  reset(); state.subs = [];
  check('no active subscription → 409', (await post('/api/stripe/change-plan', { plan: 'business' })).status, 409);

  // Two live subscriptions is the exact mess this endpoint exists to prevent.
  reset(); state.subs = [subOn('price_pro_month', 'month'), subOn('price_biz_month', 'month')];
  const two = await post('/api/stripe/change-plan', { plan: 'business' });
  check('two subscriptions → refuse and page the owner', two.status, 409);
  check('  owner was told', state.ownerAlerts.length, 1);
  check('  and nothing was changed', state.updateArgs, null);

  // ── a declined card must leave them exactly where they were ──────────────
  reset(); state.updateThrows = 'Your card was declined.';
  const declined = await post('/api/stripe/change-plan', { plan: 'business' });
  check('declined card → 402, not 500', [declined.status, declined.detail], [402, 'payment']);
  check('  no plan written on a failed charge', state.dbWrites, []);
  check('  and the owner is not paged for a card decline', state.ownerAlerts.length, 0);

  // ── a surviving discount is loud, because it cannot be quietly fixed ─────
  reset(); state.updateReturns = { id: 'sub_1', status: 'active', discounts: [{ id: 'di_1' }] };
  await post('/api/stripe/change-plan', { plan: 'business' });
  check('a discount that survives pages the owner', state.ownerAlerts.length, 1);

  // ── the webhook keeps us in step with changes made at Stripe ─────────────
  const hook = (type, object) =>
    fetch(url('/hook'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, data: { object } }) })
      .then((r) => r.status);

  reset(); state.dbWrites = [];
  await hook('customer.subscription.updated', { id: 'sub_1', status: 'active', customer: 'cus_1', items: { data: [{ price: { id: 'price_biz_year' } }] } });
  check('subscription.updated writes the new tier', state.dbWrites, [['business', 'cus_1']]);

  state.dbWrites = [];
  await hook('customer.subscription.updated', { id: 'sub_1', status: 'canceled', customer: 'cus_1', items: { data: [{ price: { id: 'price_biz_year' } }] } });
  check('a canceled subscription is NOT revived', state.dbWrites, []);

  state.dbWrites = []; state.ownerAlerts = [];
  await hook('customer.subscription.updated', { id: 'sub_1', status: 'active', customer: 'cus_1', items: { data: [{ price: { id: 'price_unknown' } }] } });
  check('an unmapped price changes nothing', state.dbWrites, []);
  check('  but does page the owner', state.ownerAlerts.length, 1);

  server.close();
  console.log(failures ? `\n${failures} FAILED\n` : '\nall passed\n');
  process.exit(failures ? 1 : 0);
})();
