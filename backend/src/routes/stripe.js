const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { notifyOwner } = require('../utils/notify');
const { REFUND_WINDOW_DAYS, refundStatus, describe } = require('../utils/subscriptions');
const { isPaidPlan } = require('../utils/entitlement');

// Stripe subscription billing for DiemDesk Pro. Everything here is ENV-GATED:
// if STRIPE_SECRET_KEY isn't set, the endpoints report "not configured" and the
// webhook no-ops — so the app runs perfectly fine before billing is wired.
// Set on the server (never in code): STRIPE_SECRET_KEY, STRIPE_PRICE_ID (monthly),
// STRIPE_PRICE_ID_YEARLY (annual), STRIPE_WEBHOOK_SECRET. FRONTEND_URL = return URLs.
const PRICE_MONTHLY = process.env.STRIPE_PRICE_ID;
const PRICE_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY;
// Business: STRIPE_PRICE_ID_BUSINESS (monthly) + STRIPE_PRICE_ID_BUSINESS_YEARLY.
const PRICE_BUSINESS_MONTHLY = process.env.STRIPE_PRICE_ID_BUSINESS;
const PRICE_BUSINESS_YEARLY = process.env.STRIPE_PRICE_ID_BUSINESS_YEARLY;

/** Which Stripe price a (tier, interval) pair maps to.
 *
 *  A table rather than a nested ternary, because the failure it prevents is
 *  silent and expensive: if a Business click fell through to the Pro price, the
 *  customer would be charged $5.98, Stripe would report a successful checkout,
 *  the webhook would mark them 'pro', and nobody would find out until they
 *  asked why their statement allowance was 20 pages. An unmapped combination
 *  returns undefined and the caller refuses the request instead. */
const PRICES = {
  pro: { month: PRICE_MONTHLY, year: PRICE_YEARLY },
  business: { month: PRICE_BUSINESS_MONTHLY, year: PRICE_BUSINESS_YEARLY },
};

/** The plan a Stripe price belongs to — used by the webhook, so a Business
 *  payment is never recorded as a Pro one. Built from the same table, so the
 *  two directions cannot disagree. */
function planForPrice(priceId) {
  if (!priceId) return null;
  for (const [plan, byInterval] of Object.entries(PRICES)) {
    if (Object.values(byInterval).includes(priceId)) return plan;
  }
  return null;
}
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND = process.env.FRONTEND_URL || 'https://diemdesk.com';

// Founding-member coupon, auto-applied while the founding window is open.
//
// The plan (decided 2026-07-04): standing price $5.98/mo, and the first 1,000
// subscribers keep $4.99 for life. Stripe enforces that natively — a coupon of
// $0.99 off, duration=forever, max_redemptions=1000 — so there is no counter to
// maintain here and no way to oversell it: once the 1,000th redemption lands,
// Stripe refuses the coupon and the code below quietly falls back to the
// standing price rather than failing the checkout.
//
// UNSET = nothing happens. Set STRIPE_FOUNDING_COUPON to the coupon id at Pro
// launch and remove it (or let Stripe exhaust it) when the window closes.
const FOUNDING_COUPON = process.env.STRIPE_FOUNDING_COUPON;

// The API version is pinned here on purpose. Left unset, the version is whatever
// the installed SDK happens to pin, so a routine `npm update` would quietly move
// live checkout and webhook calls onto a different Stripe API — the kind of
// change that shows up as a customer who could not pay, not as a failing test.
// Keep this equal to the SDK's own pinned version (stripe/cjs/apiVersion.js) when
// taking a stripe major, and read that release's breaking changes first.
const STRIPE_API_VERSION = '2026-10-28.endive';

let stripe = null;
function getStripe() {
  if (stripe) return stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return stripe;
}

const router = express.Router();

// Start a hosted Checkout for the Pro subscription; returns the redirect URL.
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const s = getStripe();
  // Which billing period? Default to monthly; annual when explicitly requested.
  const interval = req.body && req.body.interval === 'year' ? 'year' : 'month';
  // Default to 'pro' when unspecified so an older client that does not send a
  // plan keeps working exactly as before. Anything other than the two known
  // tiers is treated as pro rather than trusted.
  const plan = req.body && req.body.plan === 'business' ? 'business' : 'pro';
  const priceId = PRICES[plan] && PRICES[plan][interval];
  if (!s || !priceId) {
    // Name the gap in the log. "Billing isn't set up" is the right thing to
    // tell a customer and useless to whoever has to fix it at 9pm.
    console.warn(`[stripe] no price configured for plan=${plan} interval=${interval} — set STRIPE_PRICE_ID${plan === 'business' ? '_BUSINESS' : ''}${interval === 'year' ? '_YEARLY' : ''}`);
    return res.status(503).json({ error: 'Billing isn’t set up yet — please try again shortly.' });
  }
  try {
    const { rows } = await db.query('SELECT email, plan, stripe_customer_id FROM users WHERE id = $1', [req.user.userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Any paid tier, not just Pro: this endpoint SELLS Pro, and a Business
    // subscriber already has everything in it. Selling it to them would create a
    // second subscription beside the one they have — the exact problem the
    // Business tier exists to remove. Moving between paid tiers is a Stripe plan
    // change with proration, handled separately (B6).
    // Refuse only when the customer already has what this session would sell
    // them. A Pro subscriber buying BUSINESS is the upgrade path, not a mistake
    // — blocking it here is how someone ends up with two subscriptions, which
    // is the exact thing the Business tier exists to remove.
    //
    // This endpoint still refuses it, and that is not a gap: buying Business
    // HERE would open a second subscription beside the Pro one. The upgrade is
    // a price change on the subscription they already hold, which is what
    // POST /change-plan does. This is the backstop for a client that has not
    // been updated, so it points at the right door rather than selling the
    // wrong thing.
    if (isPaidPlan(user.plan)) {
      if (user.plan === 'pro' && plan === 'business') {
        return res.status(400).json({
          error: 'Use the upgrade button on your account page — moving to Business changes the subscription you already have, so you are never charged twice.',
          upgradeEndpoint: '/api/stripe/change-plan',
        });
      }
      return res.status(400).json({
        error: user.plan === 'business'
          ? 'You’re already on Business, which includes everything in Pro.'
          : 'You’re already on Pro.',
      });
    }

    const base = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: String(req.user.userId),
      success_url: `${FRONTEND}/pricing?upgraded=1`,
      cancel_url: `${FRONTEND}/pricing?canceled=1`,
      allow_promotion_codes: true,
      metadata: { userId: String(req.user.userId), plan },
      // Hosted Checkout already discloses the recurring terms; what this adds is
      // a RECORD that the customer accepted them, stored by Stripe on the
      // session and mirrored onto the user row by the webhook. Worth having
      // before the first chargeback, not after.
      //
      // ⚠ Stripe REJECTS this unless a Terms of service URL is set on the
      // account (Dashboard → Settings → Business → Public details). It is not
      // set yet, which is why this is applied as a strippable layer rather than
      // baked into `base` — see the fallback below. The day the owner sets that
      // URL, consent starts being collected with no deploy.
      consent_collection: { terms_of_service: 'required' },
    };
    // `base` minus the parameter Stripe refuses without a configured ToS URL.
    const withoutConsent = (f) => { const { consent_collection, ...rest } = f; return rest; };
    // The founding discount is applied for them. Making a founder hunt for a
    // promo code to get the price we advertised would be a strange way to treat
    // the first thousand customers.
    //
    // Stripe rejects `discounts` and `allow_promotion_codes` together, so while
    // the coupon is live the manual code box is dropped — the better price is
    // already on the session.
    //
    // ⚠ PRO ONLY. The founding offer is a LIFETIME price, and applying it to the
    // tier that carries the margin is the one pricing mistake that cannot be
    // undone — a founding Business subscriber would pay $15.83/mo for ever. The
    // pricing page says "Business is not included"; this is the half that makes
    // that true even if somebody edits the page. Decision P3 in
    // docs/designs/business-tier-pricing.html.
    const withCoupon = FOUNDING_COUPON && plan === 'pro'
      ? { ...base, discounts: [{ coupon: FOUNDING_COUPON }], allow_promotion_codes: undefined }
      : base;

    // Reuse an existing customer if we have one, else let Stripe create one
    // pre-filled with their email.
    const create = (fields) => s.checkout.sessions.create(
      user.stripe_customer_id ? { ...fields, customer: user.stripe_customer_id } : { ...fields, customer_email: user.email }
    );

    // Three independent things can go wrong, and NONE of them may cost us the
    // sale — a checkout that 500s is a customer who was ready to pay and wasn't
    // allowed to:
    //   1. the account has no Terms of service URL -> drop the consent checkbox
    //   2. the coupon is exhausted / expired / mistyped -> charge standing price
    //   3. the stored customer id is unknown to Stripe  -> make a fresh customer
    // (3) predates the coupon and happens with a leftover live id while testing.
    const msgOf = (e) => (e && e.message) || '';
    // Stripe's wording has changed before, so match on either half of it.
    const isConsentError = (e) => /terms[_ ]of[_ ]service|consent_collection/i.test(msgOf(e));
    let session;
    try {
      session = await create(withCoupon);
    } catch (e) {
      if (isConsentError(e)) {
        // Not an error the customer should ever meet. Take the checkbox off and
        // let them pay; the acceptance record is the thing we lose, not the sale.
        console.warn('[stripe] ToS consent rejected — set a Terms of service URL in Dashboard → Settings → Business → Public details:', msgOf(e));
        try {
          session = await create(withoutConsent(withCoupon));
        } catch (e2) {
          if (FOUNDING_COUPON && /coupon|promotion/i.test(msgOf(e2))) {
            session = await create(withoutConsent(base));
          } else if (user.stripe_customer_id && /No such customer/i.test(msgOf(e2))) {
            session = await s.checkout.sessions.create({ ...withoutConsent(withCoupon), customer_email: user.email });
          } else {
            throw e2;
          }
        }
      } else if (FOUNDING_COUPON && /coupon|promotion/i.test(msgOf(e))) {
        console.warn('[stripe] founding coupon rejected, falling back to standing price:', msgOf(e));
        session = await create(base);
      } else if (user.stripe_customer_id && /No such customer/i.test(msgOf(e))) {
        session = await s.checkout.sessions.create({ ...withCoupon, customer_email: user.email });
      } else {
        throw e;
      }
    }
    res.json({ url: session.url });
  } catch (err) {
    // A failed checkout = a lost sale. Log AND page the owner so it's caught and
    // fixed fast, never discovered later. notifyOwner never throws.
    console.error('Stripe checkout error:', err.message);
    void notifyOwner('Checkout failed', `A Pro checkout failed to start.\nUser: ${req.user && req.user.userId}\nError: ${err.message}`);
    res.status(500).json({ error: 'Could not start checkout — please try again.' });
  }
});

// Self-service billing: open the Stripe-hosted Customer Portal where the user can
// cancel, update their card, and see invoices. Stripe handles cancel-at-period-end,
// proration and dunning; the subscription.deleted webhook flips plan→free when the
// paid period actually ends. Requires the Portal to be enabled once in the Stripe
// dashboard (Settings → Billing → Customer portal), in both test and live modes.
router.post('/portal', requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Billing isn’t set up yet.' });
  try {
    const { rows } = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.userId]);
    const customer = rows[0] && rows[0].stripe_customer_id;
    if (!customer) return res.status(400).json({ error: 'No subscription to manage yet.' });
    const session = await s.billingPortal.sessions.create({ customer, return_url: `${FRONTEND}/account` });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err.message);
    res.status(500).json({ error: 'Could not open the billing portal — please try again.' });
  }
});

// ── B6: moving between paid tiers ───────────────────────────────────────────
//
// A Pro subscriber who wants Business must NOT buy a second subscription. That
// is the precise failure the Business tier exists to remove: two renewal dates,
// two cancel buttons, $24.98 a month for one person's work. So this is a Stripe
// plan change on the subscription they already have, prorated, not a checkout.
//
// Three decisions worth stating, because each one is a way to take money wrongly:
//
//  1. UPGRADES ONLY. pro → business, and month → year inside a tier. A downgrade
//     needs the change to land at the end of the period they have already paid
//     for, which is a subscription schedule rather than an update, and it raises
//     a refund question we have a published policy for (/refund-policy, 14 days)
//     and no code for. Rather than half-build that, a downgrade is refused here
//     with somewhere to go. Half a billing feature is worse than none.
//
//  2. `error_if_incomplete` + `always_invoice`. The customer is getting more, so
//     they pay the prorated difference now rather than at the next renewal. The
//     pairing is the safety: if the card cannot be charged, Stripe returns an
//     error and the subscription is NOT changed. Either they are on Business and
//     have paid for it, or nothing happened. There is no state where somebody
//     holds the tier and owes us for it.
//
//  3. THE FOUNDING COUPON IS REMOVED. This is the trap. A founding member holds
//     $0.99-off-forever, attached to their subscription. Change the price under
//     it and the discount simply carries, and they hold Business at $18.01 for
//     life — the one pricing mistake that cannot be taken back, called out as
//     decision P3 in docs/designs/business-tier-pricing.html, and already
//     guarded on the checkout path and on the pricing page. This is the third
//     place it has to be true, because this is the path that did not exist when
//     the other two were written.

/** pro → business, or month → year. Anything else is not an upgrade. */
function isUpgrade(fromPlan, fromInterval, toPlan, toInterval) {
  const rank = { free: 0, pro: 1, business: 2 };
  const from = rank[fromPlan] === undefined ? 0 : rank[fromPlan];
  const to = rank[toPlan] === undefined ? 0 : rank[toPlan];
  if (to > from) return true;                                                       // pro → business
  if (to === from && fromInterval === 'month' && toInterval === 'year') return true; // longer commitment
  return false;
}

router.post('/change-plan', requireAuth, async (req, res) => {
  const s = getStripe();
  const interval = req.body && req.body.interval === 'year' ? 'year' : 'month';
  const plan = req.body && req.body.plan === 'business' ? 'business' : 'pro';
  const priceId = PRICES[plan] && PRICES[plan][interval];
  if (!s || !priceId) {
    console.warn(`[stripe] change-plan: no price for plan=${plan} interval=${interval}`);
    return res.status(503).json({ error: 'Billing isn’t set up yet — please try again shortly.' });
  }

  try {
    const { rows } = await db.query('SELECT email, plan, stripe_customer_id FROM users WHERE id = $1', [req.user.userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!isPaidPlan(user.plan)) {
      return res.status(400).json({ error: 'You’re not on a paid plan yet — start one from the pricing page.' });
    }
    if (!user.stripe_customer_id) {
      // Paid plan, no Stripe customer: granted by hand, or billed elsewhere.
      // Changing a subscription we cannot see is not something to improvise.
      return res.status(409).json({ error: 'We can’t find a subscription to change — email us and we’ll sort it out by hand.' });
    }

    const list = await s.subscriptions.list({ customer: user.stripe_customer_id, status: 'active', limit: 10 });
    const sub = list.data[0];
    if (!sub) return res.status(409).json({ error: 'We can’t find an active subscription to change — email us and we’ll sort it out by hand.' });
    if (list.data.length > 1) {
      // Exactly the mess this endpoint exists to prevent. Do not guess which one.
      console.error(`[stripe] ${list.data.length} active subscriptions for customer ${user.stripe_customer_id}`);
      void notifyOwner('Two live subscriptions', `Customer ${user.stripe_customer_id} has ${list.data.length} active subscriptions and asked to change plan. Resolve by hand.`);
      return res.status(409).json({ error: 'There’s more than one subscription on your account — email us and we’ll merge them, no double charge.' });
    }

    const item = sub.items && sub.items.data && sub.items.data[0];
    if (!item) return res.status(409).json({ error: 'We can’t read your subscription — email us and we’ll sort it out by hand.' });
    if (item.price && item.price.id === priceId) {
      return res.status(400).json({ error: `You’re already on ${plan === 'business' ? 'Business' : 'Pro'}, billed ${interval === 'year' ? 'annually' : 'monthly'}.` });
    }

    const fromInterval = item.price && item.price.recurring ? item.price.recurring.interval : 'month';
    const fromPlan = planForPrice(item.price && item.price.id) || user.plan;
    if (!isUpgrade(fromPlan, fromInterval, plan, interval)) {
      return res.status(400).json({
        error: 'Moving down a tier isn’t self-serve yet — email us and we’ll make the change at the end of the period you’ve already paid for.',
        reason: 'downgrade',
      });
    }

    const updated = await s.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
      // See decision 3 above. A lifetime Pro discount must not become a
      // lifetime Business discount.
      discounts: [],
      metadata: Object.assign({}, sub.metadata || {}, { plan, userId: String(req.user.userId) }),
    });

    // The subscription.updated webhook writes this too, and either may land
    // first. Writing it here means the customer's next page load is already
    // right instead of right-in-a-moment; the webhook then agrees with it.
    await db.query('UPDATE users SET plan = $1, updated_at = now() WHERE id = $2', [plan, req.user.userId]);
    console.log(`Stripe: user ${req.user.userId} ${fromPlan}/${fromInterval} → ${plan}/${interval} (sub ${sub.id})`);

    // If a discount survived the update, the customer is now holding a price we
    // did not intend to sell for ever. Nothing here can safely undo it, so say
    // so loudly rather than let it sit in a dashboard nobody reads.
    const stillDiscounted = Array.isArray(updated.discounts) ? updated.discounts.length > 0 : !!updated.discount;
    if (stillDiscounted) {
      console.error(`[stripe] discount SURVIVED the move to ${plan} on ${sub.id}`);
      void notifyOwner('Founding discount survived an upgrade', `Subscription ${sub.id} moved to ${plan} and still carries a discount. A founding rate on Business is a lifetime price we did not mean to sell — check it now.`);
    }

    // Named subscriptionStatus, not status: a JSON body whose `status` means
    // 'active' sits next to an HTTP status that means 200, and the first
    // client to flatten the two gets a confident, wrong answer.
    res.json({ ok: true, plan, interval, subscriptionId: sub.id, subscriptionStatus: updated.status });
  } catch (err) {
    const msg = (err && err.message) || '';
    // error_if_incomplete surfaces a declined card as an error, which is the
    // point — but it is the customer's problem to fix, not an outage.
    if (/card|payment|declin|insufficient|authentication/i.test(msg)) {
      console.warn('[stripe] change-plan payment failed:', msg);
      return res.status(402).json({
        error: 'Your card couldn’t be charged for the difference, so nothing has changed — update your card and try again.',
        detail: 'payment',
      });
    }
    console.error('Stripe change-plan error:', msg);
    void notifyOwner('Plan change failed', `A plan change failed.\nUser: ${req.user && req.user.userId}\nError: ${msg}`);
    res.status(500).json({ error: 'Could not change your plan — please try again, or email us.' });
  }
});

// ── Subscriptions: see them, cancel them, tell us why ───────────────────────
//
// The Stripe portal still handles cards and invoices, but cancelling happens
// here so we can (a) apply the 14-day refund rule ourselves, from Stripe's own
// timestamps, and (b) actually record why people leave. A cancellation we never
// hear the reason for is a lost lesson.

let cancelTableReady = null;
function ensureCancelTable() {
  if (!cancelTableReady) {
    cancelTableReady = db.query(`
      CREATE TABLE IF NOT EXISTS subscription_cancellations (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        subscription_id VARCHAR(64) NOT NULL,
        plan_name       VARCHAR(120),
        billing_interval VARCHAR(10),
        reason          VARCHAR(60),
        comment         TEXT,
        days_since_start INTEGER,
        refund_requested BOOLEAN NOT NULL DEFAULT false,
        refund_granted   BOOLEAN NOT NULL DEFAULT false,
        refund_amount    INTEGER,
        refund_currency  VARCHAR(10),
        ends_at         TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_cancellations_created ON subscription_cancellations(created_at DESC);
    `).catch((e) => { cancelTableReady = null; throw e; });
  }
  return cancelTableReady;
}

// The reasons we offer. Anything else is stored as 'other' with the comment —
// a free-text-only field would give us noise we can't count.
const REASONS = new Set(['too_expensive', 'not_using', 'missing_feature', 'found_alternative', 'temporary', 'technical', 'other']);

async function customerFor(userId) {
  const { rows } = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId]);
  return (rows[0] && rows[0].stripe_customer_id) || null;
}

/** Every live subscription on the account — Pro today, Statements tomorrow. */
router.get('/subscription', requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) return res.json({ configured: false, subscriptions: [] });
  try {
    const customer = await customerFor(req.user.userId);
    if (!customer) return res.json({ configured: true, subscriptions: [] });
    const list = await s.subscriptions.list({
      customer,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price.product'],
    });
    const live = list.data
      .filter((sub) => ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status))
      .map((sub) => describe(sub));
    res.json({ configured: true, refundWindowDays: REFUND_WINDOW_DAYS, subscriptions: live });
  } catch (err) {
    console.error('Stripe subscription list error:', err.message);
    res.status(500).json({ error: 'Could not read your subscription — please try again.' });
  }
});

/** Cancel. Always permitted; a refund only inside the window, checked here. */
router.post('/cancel', requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Billing isn’t set up yet.' });

  const body = req.body || {};
  const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : '';
  const reason = REASONS.has(body.reason) ? body.reason : 'other';
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';
  const wantsRefund = body.requestRefund === true;
  if (!subscriptionId) return res.status(400).json({ error: 'Which subscription?' });

  try {
    const customer = await customerFor(req.user.userId);
    if (!customer) return res.status(400).json({ error: 'No subscription to cancel.' });

    // Never trust an id from the browser: re-read it and confirm it is theirs.
    const sub = await s.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price.product', 'latest_invoice'] });
    if (!sub || sub.customer !== customer) return res.status(403).json({ error: 'That subscription isn’t on your account.' });
    if (['canceled', 'incomplete_expired'].includes(sub.status)) {
      return res.status(400).json({ error: 'That subscription has already ended.' });
    }

    const info = describe(sub);
    const refund = refundStatus(sub);

    // The published policy calls it a ONE-TIME guarantee: refund once, and a
    // later subscription doesn't get a fresh window. Without this check a
    // subscribe → refund → subscribe loop is free forever.
    let alreadyRefunded = false;
    try {
      await ensureCancelTable();
      const prior = await db.query(
        'SELECT 1 FROM subscription_cancellations WHERE user_id = $1 AND refund_granted = true LIMIT 1',
        [req.user.userId],
      );
      alreadyRefunded = prior.rowCount > 0;
    } catch (e) {
      console.error('refund-history check failed:', e.message);
    }

    // STRICT: eligibility comes from Stripe's start_date, not from the request.
    const grantRefund = wantsRefund && refund.eligible && !alreadyRefunded;

    let updated;
    let refundResult = null;

    if (grantRefund) {
      // Inside the window: end it now and give the money back, because keeping
      // someone on a service they've asked to leave and paid for is the thing
      // people hate about subscriptions.
      const invoice = sub.latest_invoice && typeof sub.latest_invoice === 'object'
        ? sub.latest_invoice
        : sub.latest_invoice ? await s.invoices.retrieve(sub.latest_invoice) : null;
      const paymentIntent = invoice && invoice.payment_intent;
      if (paymentIntent) {
        refundResult = await s.refunds.create({
          payment_intent: typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id,
          reason: 'requested_by_customer',
          metadata: { userId: String(req.user.userId), subscriptionId, cancelReason: reason },
        });
      }
      updated = await s.subscriptions.cancel(subscriptionId);
      await db.query("UPDATE users SET plan = 'free', updated_at = now() WHERE id = $1", [req.user.userId]);
    } else {
      // Outside the window (or no refund asked for): they keep what they paid
      // for until the period ends. The subscription.deleted webhook flips the
      // plan when it actually lapses.
      updated = await s.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        cancellation_details: { comment: comment || undefined, feedback: undefined },
      });
    }

    const endsAt = grantRefund
      ? new Date()
      : updated.current_period_end ? new Date(updated.current_period_end * 1000) : null;

    try {
      await ensureCancelTable();
      await db.query(
        `INSERT INTO subscription_cancellations
           (user_id, subscription_id, plan_name, billing_interval, reason, comment,
            days_since_start, refund_requested, refund_granted, refund_amount, refund_currency, ends_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [req.user.userId, subscriptionId, info.name, info.interval, reason, comment || null,
         refund.daysSinceStart, wantsRefund, grantRefund,
         refundResult ? refundResult.amount : null, refundResult ? refundResult.currency : null, endsAt],
      );
    } catch (e) {
      // Losing the feedback must never break the cancellation itself.
      console.error('cancellation log failed:', e.message);
    }

    void notifyOwner(
      `Subscription cancelled — ${info.name} (${info.intervalLabel})`,
      `Reason: ${reason}\nComment: ${comment || '—'}\nDay ${refund.daysSinceStart} of the subscription\n` +
      `Refund requested: ${wantsRefund ? 'yes' : 'no'} · granted: ${grantRefund ? 'yes' : 'no'}\n` +
      `Ends: ${endsAt ? endsAt.toISOString() : 'unknown'}`,
    );

    res.json({
      ok: true,
      immediate: grantRefund,
      endsAt: endsAt ? endsAt.toISOString() : null,
      refunded: grantRefund,
      refundAmount: refundResult ? (refundResult.amount / 100).toFixed(2) : null,
      refundCurrency: refundResult ? refundResult.currency.toUpperCase() : null,
      refundWindowDays: REFUND_WINDOW_DAYS,
      refundEligible: refund.eligible,
      // Told plainly rather than silently ignored, so nobody is left wondering
      // where their refund went.
      refundDeclinedReason: wantsRefund && !grantRefund
        ? (alreadyRefunded ? 'guarantee_already_used' : 'window_closed')
        : null,
    });
  } catch (err) {
    console.error('Stripe cancel error:', err.message);
    void notifyOwner('Subscription cancel FAILED', `A cancellation attempt errored: ${err.message}`);
    res.status(500).json({ error: 'Could not cancel just now — nothing has changed. Please try again, or email support@diemdesk.com.' });
  }
});

/** Changed their mind before the period ends. */
router.post('/resume', requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Billing isn’t set up yet.' });
  const subscriptionId = req.body && typeof req.body.subscriptionId === 'string' ? req.body.subscriptionId : '';
  if (!subscriptionId) return res.status(400).json({ error: 'Which subscription?' });
  try {
    const customer = await customerFor(req.user.userId);
    const sub = await s.subscriptions.retrieve(subscriptionId);
    if (!customer || !sub || sub.customer !== customer) return res.status(403).json({ error: 'That subscription isn’t on your account.' });
    if (sub.status === 'canceled') return res.status(400).json({ error: 'That subscription has already ended — start a new one from Pricing.' });
    const updated = await s.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    res.json({ ok: true, renewsAt: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null });
  } catch (err) {
    console.error('Stripe resume error:', err.message);
    res.status(500).json({ error: 'Could not restart it just now — please try again.' });
  }
});

// Webhook: registered with express.raw in index.js (Stripe needs the exact raw
// body to verify the signature). Flips the user's plan on subscribe/cancel.
async function webhookHandler(req, res) {
  const s = getStripe();
  if (!s || !WEBHOOK_SECRET) return res.status(200).json({ received: true, note: 'billing not configured' });

  let event;
  try {
    event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
      if (userId) {
        // Which plan did they actually buy? Hard-coding 'pro' here would record
        // a $19 Business payment as a $5.98 Pro subscription — the customer is
        // charged correctly by Stripe and under-served by us, which is the one
        // billing bug that looks fine in the dashboard.
        //
        // The session metadata is set by /create-checkout-session above, so it
        // is the cheap answer. It is still OUR value echoed back, so when it is
        // missing or unrecognised we ask Stripe what was on the line item and
        // map that through the same price table. Only if both fail do we fall
        // back to 'pro' — the lower tier, because under-granting is a support
        // email and over-granting is giving away the margin tier.
        let plan = PRICES[session.metadata && session.metadata.plan] ? session.metadata.plan : null;
        if (!plan) {
          try {
            const items = await s.checkout.sessions.listLineItems(session.id, { limit: 1 });
            plan = planForPrice(items.data[0] && items.data[0].price && items.data[0].price.id);
          } catch (err) {
            console.error('Stripe webhook: could not read line items:', err.message);
          }
        }
        if (!plan) {
          plan = 'pro';
          console.warn(`Stripe: could not determine the plan for session ${session.id} — recorded as pro. Check STRIPE_PRICE_ID_* env vars.`);
        }
        await db.query('UPDATE users SET plan = $1, stripe_customer_id = $2, updated_at = now() WHERE id = $3', [plan, session.customer || null, userId]);
        console.log(`Stripe: user ${userId} → ${plan}`);

        // Mirror the terms acceptance onto the user, AFTER the upgrade and in
        // its own try/catch. The upgrade is the thing a paying customer is
        // waiting on; a missing column on a database that has not run the
        // latest schema.sql must never be the reason someone paid and stayed
        // on free. Absent consent is a footnote, a failed upgrade is an
        // incident.
        if (session.consent && session.consent.terms_of_service === 'accepted') {
          try {
            await db.query(
              'UPDATE users SET tos_accepted_at = to_timestamp($1), tos_accepted_session = $2 WHERE id = $3 AND tos_accepted_at IS NULL',
              [session.created || Math.floor(Date.now() / 1000), String(session.id).slice(0, 80), userId],
            );
          } catch (e) {
            console.warn('[stripe] could not record ToS acceptance (run backend/src/db/schema.sql):', e.message);
          }
        }
      }
    } else if (event.type === 'customer.subscription.updated') {
      // A subscription's price can change without a checkout: our own
      // /change-plan does it, and so does the Stripe Customer Portal if plan
      // switching is ever enabled there. Before this handler existed, neither
      // reached the database — only checkout.session.completed did — so a
      // customer could be paying Business at Stripe and reading Pro's limits
      // here, indefinitely, with both systems convinced they were right.
      //
      // This fires for a lot of reasons that are not a price change (a card
      // update, cancel_at_period_end toggling, dunning), so it only acts when
      // the price maps to a tier we sell AND the subscription is in a state
      // worth honouring. Anything else is left alone rather than guessed at —
      // notably `canceled`, which has its own handler below and must not be
      // turned back into a paid plan by an update event arriving late.
      const sub = event.data.object;
      const item = sub.items && sub.items.data && sub.items.data[0];
      const plan = planForPrice(item && item.price && item.price.id);
      const live = ['active', 'trialing', 'past_due'].includes(sub.status);
      if (plan && live && sub.customer) {
        const { rowCount } = await db.query(
          'UPDATE users SET plan = $1, updated_at = now() WHERE stripe_customer_id = $2 AND plan <> $1',
          [plan, sub.customer],
        );
        if (rowCount) console.log(`Stripe: customer ${sub.customer} → ${plan} (subscription updated)`);
      } else if (!plan && live && sub.customer) {
        // Paying for something we cannot name. Either a price exists in Stripe
        // that is not in STRIPE_PRICE_ID_*, or an env var is missing on this
        // deploy. Both end with a customer served the wrong tier, and neither
        // is visible anywhere else.
        console.warn(`Stripe: subscription ${sub.id} has an unmapped price — check STRIPE_PRICE_ID_* env vars`);
        void notifyOwner('Unmapped Stripe price', `Subscription ${sub.id} (customer ${sub.customer}) is active on a price this deploy does not recognise, so the customer's plan was NOT changed. Check STRIPE_PRICE_ID_* on the server.`);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await db.query("UPDATE users SET plan = 'free', updated_at = now() WHERE stripe_customer_id = $1", [sub.customer]);
      console.log(`Stripe: customer ${sub.customer} → free`);
    }
  } catch (err) {
    // A webhook failure can mean a PAID user didn't get upgraded — critical.
    // Log, page the owner, and still 200 so Stripe won't retry-storm.
    console.error('Stripe webhook handling error:', err.message);
    void notifyOwner('Stripe webhook failed', `A Stripe webhook (${event && event.type}) failed to process — a paid user may not be upgraded.\nError: ${err.message}`);
  }
  res.json({ received: true });
}

module.exports = { router, webhookHandler };
