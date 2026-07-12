const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Stripe subscription billing for DiemDesk Pro. Everything here is ENV-GATED:
// if STRIPE_SECRET_KEY isn't set, the endpoints report "not configured" and the
// webhook no-ops — so the app runs perfectly fine before billing is wired.
// Set on the server (never in code): STRIPE_SECRET_KEY, STRIPE_PRICE_ID (monthly),
// STRIPE_PRICE_ID_YEARLY (annual), STRIPE_WEBHOOK_SECRET. FRONTEND_URL = return URLs.
const PRICE_MONTHLY = process.env.STRIPE_PRICE_ID;
const PRICE_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND = process.env.FRONTEND_URL || 'https://diemdesk.com';

let stripe = null;
function getStripe() {
  if (stripe) return stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

const router = express.Router();

// Start a hosted Checkout for the Pro subscription; returns the redirect URL.
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const s = getStripe();
  // Which billing period? Default to monthly; annual when explicitly requested.
  const interval = req.body && req.body.interval === 'year' ? 'year' : 'month';
  const priceId = interval === 'year' ? PRICE_YEARLY : PRICE_MONTHLY;
  if (!s || !priceId) return res.status(503).json({ error: 'Billing isn’t set up yet — please try again shortly.' });
  try {
    const { rows } = await db.query('SELECT email, plan, stripe_customer_id FROM users WHERE id = $1', [req.user.userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.plan === 'pro') return res.status(400).json({ error: 'You’re already on Pro.' });

    const base = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: String(req.user.userId),
      success_url: `${FRONTEND}/pricing?upgraded=1`,
      cancel_url: `${FRONTEND}/pricing?canceled=1`,
      allow_promotion_codes: true,
      metadata: { userId: String(req.user.userId) },
    };
    let session;
    try {
      // Reuse an existing customer if we have one, else let Stripe create one
      // pre-filled with their email.
      session = await s.checkout.sessions.create(
        user.stripe_customer_id ? { ...base, customer: user.stripe_customer_id } : { ...base, customer_email: user.email }
      );
    } catch (e) {
      // A stored customer Stripe can't find (deleted, or from a different Stripe
      // mode — e.g. a leftover live id while testing) must not dead-end checkout:
      // retry with just the email so a fresh customer is created.
      if (user.stripe_customer_id && /No such customer/i.test(e.message || '')) {
        session = await s.checkout.sessions.create({ ...base, customer_email: user.email });
      } else {
        throw e;
      }
    }
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout — please try again.' });
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
        await db.query('UPDATE users SET plan = $1, stripe_customer_id = $2, updated_at = now() WHERE id = $3', ['pro', session.customer || null, userId]);
        console.log(`Stripe: user ${userId} → pro`);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await db.query("UPDATE users SET plan = 'free', updated_at = now() WHERE stripe_customer_id = $1", [sub.customer]);
      console.log(`Stripe: customer ${sub.customer} → free`);
    }
  } catch (err) {
    // Log and still 200 so Stripe won't retry-storm on a transient DB error.
    console.error('Stripe webhook handling error:', err.message);
  }
  res.json({ received: true });
}

module.exports = { router, webhookHandler };
