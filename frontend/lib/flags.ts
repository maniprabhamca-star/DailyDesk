// Global feature flags.
//
// BILLING_ENABLED: during the free launch period this is OFF — Pro is shown
// everywhere as "coming soon" and nobody can subscribe yet. The Stripe
// integration is fully built and live-verified; flipping this to `true` (and
// redeploying the frontend) opens paid subscriptions instantly, no other change.
export const BILLING_ENABLED = true;

// PRO_UPSELL_ENABLED: gates all "upgrade to Pro" size-cap selling (the polished
// over-limit notice CTA + the dismissible corner card). OFF during the free
// launch — since Pro isn't purchasable yet, we never dangle a price. When a file
// is over the cap while this is OFF, the notice degrades to a neutral
// "file too large" message with no Pro pitch. Flip ON with BILLING_ENABLED at
// Pro launch to turn the size cap into a real upsell. Default OFF; a preview
// server can force it ON for testing via NEXT_PUBLIC_PRO_UPSELL=1 (never set in
// production).
export const PRO_UPSELL_ENABLED = process.env.NEXT_PUBLIC_PRO_UPSELL === '1';
