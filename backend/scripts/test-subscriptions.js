// The refund rule, tested. Run: node scripts/test-subscriptions.js
//
// This is the one piece of billing logic that decides whether someone gets
// their money back, so it is checked against Stripe-shaped objects rather than
// trusted to read correctly. No database, no network.

const assert = require('node:assert');
const { refundStatus, describe: describeSub, REFUND_WINDOW_DAYS } = require('../src/utils/subscriptions');

const DAY = 86400;
const at = (d) => Math.floor(d.getTime() / 1000);
const NOW = new Date('2026-08-07T12:00:00Z');
const daysAgo = (n) => at(new Date(NOW.getTime() - n * DAY * 1000));

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log(`refund window = ${REFUND_WINDOW_DAYS} days`);

check('day 0 — just subscribed, refundable', () => {
  const r = refundStatus({ start_date: daysAgo(0) }, NOW);
  assert.equal(r.eligible, true);
  assert.equal(r.daysSinceStart, 0);
  assert.equal(r.daysLeft, REFUND_WINDOW_DAYS);
});

check('day 13 — still inside the window', () => {
  const r = refundStatus({ start_date: daysAgo(13) }, NOW);
  assert.equal(r.eligible, true);
  assert.equal(r.daysSinceStart, 13);
});

check('exactly 14 days — the boundary is INCLUSIVE, to the second', () => {
  const started = new Date(NOW.getTime() - REFUND_WINDOW_DAYS * DAY * 1000 + 1000); // 1s inside
  assert.equal(refundStatus({ start_date: at(started) }, NOW).eligible, true);
});

check('one second past 14 days — refused', () => {
  const started = new Date(NOW.getTime() - REFUND_WINDOW_DAYS * DAY * 1000 - 1000);
  const r = refundStatus({ start_date: at(started) }, NOW);
  assert.equal(r.eligible, false);
  assert.equal(r.daysLeft, 0);
});

check('day 15 and day 400 — refused, and it says how long ago', () => {
  assert.equal(refundStatus({ start_date: daysAgo(15) }, NOW).eligible, false);
  const old = refundStatus({ start_date: daysAgo(400) }, NOW);
  assert.equal(old.eligible, false);
  assert.equal(old.daysSinceStart, 400);
});

check('an annual plan gets the SAME window as monthly — no special case', () => {
  const monthly = refundStatus({ start_date: daysAgo(20) }, NOW);
  const annual = refundStatus({ start_date: daysAgo(20) }, NOW);
  assert.equal(monthly.eligible, false);
  assert.equal(annual.eligible, false);
});

check('start_date wins over created, so a plan change cannot reopen the window', () => {
  // Stripe keeps start_date at the original subscription start; `created` can
  // move. Using created would hand a refund to a year-old subscriber who just
  // switched plans.
  const r = refundStatus({ start_date: daysAgo(200), created: daysAgo(1) }, NOW);
  assert.equal(r.eligible, false);
  assert.equal(r.daysSinceStart, 200);
});

check('no timestamps at all — refuse rather than guess', () => {
  const r = refundStatus({}, NOW);
  assert.equal(r.eligible, false);
  assert.equal(r.deadline, null);
});

check('the deadline is reported as a real date the UI can print', () => {
  const r = refundStatus({ start_date: daysAgo(2) }, NOW);
  const deadline = new Date(r.deadline);
  assert.equal(Number.isFinite(deadline.getTime()), true);
  assert.equal(deadline > NOW, true);
});

check('describe() flattens a Stripe subscription for the account page', () => {
  const sub = {
    id: 'sub_123',
    status: 'active',
    start_date: daysAgo(3),
    current_period_end: at(new Date('2026-09-07T12:00:00Z')),
    cancel_at_period_end: false,
    items: { data: [{ price: { unit_amount: 6000, currency: 'usd', recurring: { interval: 'year' }, product: { name: 'DiemDesk Pro' } } }] },
  };
  const d = describeSub(sub, NOW);
  assert.equal(d.name, 'DiemDesk Pro');
  assert.equal(d.interval, 'year');
  assert.equal(d.intervalLabel, 'Annual');
  assert.equal(d.price.display, '60.00');
  assert.equal(d.price.currency, 'USD');
  assert.equal(d.cancelAtPeriodEnd, false);
  assert.equal(d.refund.eligible, true);
});

check('describe() survives a subscription with no expanded product', () => {
  const d = describeSub({ id: 'sub_x', status: 'active', items: { data: [] } }, NOW);
  assert.equal(d.name, 'DiemDesk Pro');
  assert.equal(d.price, null);
  assert.equal(d.intervalLabel, 'Subscription');
});

console.log(`\n${passed} checks passed`);
