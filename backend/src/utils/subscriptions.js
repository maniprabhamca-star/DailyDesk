// Subscription state and the refund window, in one place.
//
// TWO DIFFERENT RULES, deliberately kept apart:
//   • CANCELLING is always allowed. Blocking it after N days would breach the
//     UK/EU consumer rules and California's auto-renewal law ("cancel as easily
//     as you subscribed"), and in practice just turns into chargebacks.
//   • A REFUND is only available inside the 14-day window published in
//     /refund-policy. That is checked HERE, from Stripe's own timestamps —
//     never from anything the browser sends.
//
// Everything is written to work for ANY subscription on the customer, so the
// Statements tier (bank statement converter) is covered the day it exists
// without another round of plumbing.

const REFUND_WINDOW_DAYS = Number(process.env.REFUND_WINDOW_DAYS || 14);

const DAY_MS = 86400 * 1000;

/** When did the customer actually start paying for this subscription? Stripe's
 *  `start_date` survives plan changes; `created` is the fallback. */
function startedAt(sub) {
  const secs = sub.start_date || sub.created;
  return secs ? new Date(secs * 1000) : null;
}

/** Strictly: is this subscription still inside the refund window? */
function refundStatus(sub, now = new Date()) {
  const started = startedAt(sub);
  if (!started) return { eligible: false, daysSinceStart: null, deadline: null, windowDays: REFUND_WINDOW_DAYS };
  const daysSinceStart = Math.floor((now.getTime() - started.getTime()) / DAY_MS);
  const deadline = new Date(started.getTime() + REFUND_WINDOW_DAYS * DAY_MS);
  return {
    eligible: now.getTime() <= deadline.getTime(),
    daysSinceStart,
    daysLeft: Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS)),
    deadline: deadline.toISOString(),
    startedAt: started.toISOString(),
    windowDays: REFUND_WINDOW_DAYS,
  };
}

const money = (amount, currency) =>
  amount == null ? null : { amount, currency: (currency || 'usd').toUpperCase(), display: (amount / 100).toFixed(2) };

/** A subscription flattened into what the account page needs to show. */
function describe(sub, now = new Date()) {
  const item = (sub.items && sub.items.data && sub.items.data[0]) || null;
  const price = item && item.price;
  const product = price && price.product;
  const interval = price && price.recurring ? price.recurring.interval : null;
  return {
    id: sub.id,
    status: sub.status,
    name: (product && (product.name || product)) || 'DiemDesk Pro',
    interval,                                   // 'month' | 'year'
    intervalLabel: interval === 'year' ? 'Annual' : interval === 'month' ? 'Monthly' : 'Subscription',
    price: price ? money(price.unit_amount, price.currency) : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    refund: refundStatus(sub, now),
  };
}

module.exports = { REFUND_WINDOW_DAYS, refundStatus, describe, startedAt };
