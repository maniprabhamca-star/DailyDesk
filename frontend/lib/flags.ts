// Global feature flags.
//
// BILLING_ENABLED: during the free launch period this is OFF — Pro is shown
// everywhere as "coming soon" and nobody can subscribe yet. The Stripe
// integration is fully built and live-verified; flipping this to `true` (and
// redeploying the frontend) opens paid subscriptions instantly, no other change.
export const BILLING_ENABLED = false;
