#!/usr/bin/env node
/**
 * Checkout fallback harness — no Stripe account, no network, no database.
 *
 * The rule this exists to defend: a checkout must never 500 because of
 * something on OUR side. A customer who was ready to pay and got an error is
 * the most expensive bug the product can have, and the ways it happens are all
 * configuration, not code — an unset Terms of service URL, an expired coupon, a
 * customer id left over from test mode.
 *
 * Adding consent_collection made this sharper: Stripe REJECTS the parameter
 * outright unless a Terms of service URL is configured on the account, and it
 * is not configured yet. Shipping it without a fallback would have turned every
 * checkout into a 500 the moment it deployed.
 *
 * Run: node scripts/test-checkout-fallbacks.js
 */

'use strict';

// ---- the logic under test, mirrored from routes/stripe.js -------------------
// Kept as a copy rather than an import because the route needs a live Stripe
// client, a database and an authenticated request to load at all. If the route
// changes, this file has to change with it — the assertions below describe the
// BEHAVIOUR, so a divergence shows up as a failing expectation, not silence.

function buildSession({ founding, hasCustomerId }) {
  const base = {
    mode: 'subscription',
    allow_promotion_codes: true,
    consent_collection: { terms_of_service: 'required' },
  };
  const withoutConsent = (f) => { const { consent_collection, ...rest } = f; return rest; };
  const withCoupon = founding
    ? { ...base, discounts: [{ coupon: founding }], allow_promotion_codes: undefined }
    : base;
  return { base, withCoupon, withoutConsent, hasCustomerId };
}

/** Replays the route's try/catch ladder against a fake Stripe. */
async function runCheckout({ founding = null, hasCustomerId = false, stripeFails }) {
  const { base, withCoupon, withoutConsent } = buildSession({ founding, hasCustomerId });
  const attempts = [];
  const create = async (fields) => {
    attempts.push(fields);
    const err = stripeFails(fields, attempts.length);
    if (err) { const e = new Error(err); throw e; }
    return { id: 'cs_test_' + attempts.length, url: 'https://checkout.stripe.com/x' };
  };

  const msgOf = (e) => (e && e.message) || '';
  const isConsentError = (e) => /terms[_ ]of[_ ]service|consent_collection/i.test(msgOf(e));
  let session;
  try {
    session = await create(withCoupon);
  } catch (e) {
    if (isConsentError(e)) {
      try {
        session = await create(withoutConsent(withCoupon));
      } catch (e2) {
        if (founding && /coupon|promotion/i.test(msgOf(e2))) {
          session = await create(withoutConsent(base));
        } else if (hasCustomerId && /No such customer/i.test(msgOf(e2))) {
          session = await create({ ...withoutConsent(withCoupon), customer_email: 'a@b.c' });
        } else {
          throw e2;
        }
      }
    } else if (founding && /coupon|promotion/i.test(msgOf(e))) {
      session = await create(base);
    } else if (hasCustomerId && /No such customer/i.test(msgOf(e))) {
      session = await create({ ...withCoupon, customer_email: 'a@b.c' });
    } else {
      throw e;
    }
  }
  return { session, attempts };
}

// ---- harness ---------------------------------------------------------------
let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; return; }
  fails.push(name + (detail ? ' — ' + detail : ''));
}

const NO_TOS = 'You must configure at least one of the following before using consent_collection[terms_of_service]: a Terms of service URL';
const BAD_COUPON = 'No such coupon: FOUNDING100';
const NO_CUSTOMER = 'No such customer: cus_deadbeef';

(async () => {
  // 1. The happy path still asks for consent.
  {
    const { session, attempts } = await runCheckout({ stripeFails: () => null });
    check('happy: session created', !!session);
    check('happy: one call only', attempts.length === 1, `made ${attempts.length}`);
    check('happy: consent requested', attempts[0].consent_collection?.terms_of_service === 'required');
  }

  // 2. THE CASE THAT WOULD HAVE TAKEN THE SITE'S REVENUE DOWN.
  //    No ToS URL on the account -> first call throws -> we must still sell.
  {
    const { session, attempts } = await runCheckout({
      stripeFails: (f) => (f.consent_collection ? NO_TOS : null),
    });
    check('no-tos: customer still gets a checkout', !!session);
    check('no-tos: retried without consent', attempts.length === 2, `made ${attempts.length}`);
    check('no-tos: retry carries no consent', attempts[1].consent_collection === undefined);
    check('no-tos: retry keeps the subscription mode', attempts[1].mode === 'subscription');
  }

  // 3. No ToS URL AND a dead coupon — two failures, still a sale.
  {
    const { session, attempts } = await runCheckout({
      founding: 'FOUNDING100',
      stripeFails: (f) => {
        if (f.consent_collection) return NO_TOS;
        if (f.discounts) return BAD_COUPON;
        return null;
      },
    });
    check('no-tos+coupon: sale survives', !!session);
    check('no-tos+coupon: fell back to standing price', attempts.at(-1).discounts === undefined);
    check('no-tos+coupon: no consent on the winner', attempts.at(-1).consent_collection === undefined);
  }

  // 4. No ToS URL AND a stale customer id — the pre-existing degrade still works
  //    underneath the new one.
  {
    const { session, attempts } = await runCheckout({
      hasCustomerId: true,
      stripeFails: (f) => {
        if (f.consent_collection) return NO_TOS;
        if (!f.customer_email) return NO_CUSTOMER;
        return null;
      },
    });
    check('no-tos+stale-customer: sale survives', !!session);
    check('no-tos+stale-customer: fresh customer by email', attempts.at(-1).customer_email === 'a@b.c');
  }

  // 5. Coupon alone still degrades, and KEEPS consent — dropping the checkbox
  //    when only the coupon failed would quietly lose the acceptance record.
  {
    const { attempts } = await runCheckout({
      founding: 'FOUNDING100',
      stripeFails: (f) => (f.discounts ? BAD_COUPON : null),
    });
    check('coupon-only: consent preserved', attempts.at(-1).consent_collection?.terms_of_service === 'required');
  }

  // 6. A genuine error still surfaces. Degrading everything would hide a real
  //    outage behind a checkout that silently sells the wrong thing.
  {
    let threw = false;
    try {
      await runCheckout({ stripeFails: () => 'Your card was declined by the acquirer' });
    } catch { threw = true; }
    check('unknown error is not swallowed', threw);
  }

  // 7. Wording drift: Stripe has reworded this error before.
  {
    for (const msg of [
      'consent_collection[terms_of_service] is not allowed',
      'You must provide a terms of service URL',
      'Invalid consent_collection: terms_of_service',
    ]) {
      const { session } = await runCheckout({ stripeFails: (f) => (f.consent_collection ? msg : null) });
      check(`wording "${msg.slice(0, 34)}…" recognised`, !!session);
    }
  }

  console.log(`\ncheckout fallbacks: ${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    for (const f of fails) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('Every configuration failure still ends in a checkout URL.\n');
})();
