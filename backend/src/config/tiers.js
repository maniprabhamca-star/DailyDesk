// What each plan is actually sold. Server side.
//
// These numbers are not configuration — they are PUBLISHED. /pricing prints
// "5 · 20 · 300 statement pages" and "50 · 200 AI actions" in a comparison
// table, and /compare prints $0.063 a page, which is $19 ÷ 300. A customer can
// read all of it before they pay. So the server has to agree with the page, and
// until today it did not: routes/statements.js short-circuited on
// isPaidPlan(plan) and handed every paying account UNLIMITED pages, while
// aiBudget.js gave everyone the single AI_USER_MONTHLY_MAX. Pro was getting
// 300's worth of nothing-stops-you for $5.98, and Business was paying $19 for
// Pro's 50 AI actions. Both directions wrong, both invisible to the build.
//
// The authoritative copy of these numbers is frontend/lib/currency.ts
// (STATEMENT_PAGES, AI_ACTIONS), because that is the file the pricing page
// renders from and therefore the one a customer actually sees. There is no
// build step that shares a constant across a TypeScript frontend and a
// CommonJS backend, so this file restates them — and
// frontend/tests/unit/tier-allowances.test.ts reads BOTH files and fails if
// they ever disagree. Change one, the test tells you about the other.
//
// Env overrides exist for the free tier only (STATEMENT_FREE_PAGES was already
// an env var and prod may be setting it). The paid numbers are deliberately not
// overridable: they are a price, and a price should not be changeable without a
// deploy that also changes the page quoting it.

/** Statement pages included per calendar month, by tier. */
const STATEMENT_PAGES = {
  free: Number(process.env.STATEMENT_FREE_PAGES || 5),
  pro: 20,
  business: 300,
};

/** AI actions included per calendar month, by tier. Free gets a taste via the
 *  global budget rather than an allowance of its own, hence 0 here. */
const AI_ACTIONS = {
  free: 0,
  pro: 50,
  business: 200,
};

const KNOWN = new Set(['free', 'pro', 'business']);

/**
 * Normalise whatever is in users.plan to a tier name we have allowances for.
 *
 * Anything unrecognised — null, a plan from a future tier that this deploy
 * predates, a typo — becomes 'free'. That is the safe direction for a quota:
 * an unknown plan gets the smallest allowance and somebody notices, rather than
 * the largest and nobody does.
 */
function tierOf(plan) {
  const p = String(plan || '').toLowerCase();
  return KNOWN.has(p) ? p : 'free';
}

/**
 * The statement-page allowance for a caller.
 *
 * `null` means unlimited and is returned for the owner only. Not for Business:
 * 300 is a number we published, and the point of this file is that published
 * numbers are enforced.
 *
 * `credits` is the one-time top-up pack (lib/currency.ts `packPages`). Nothing
 * sells it yet — there is no purchase flow and no ledger — so it is 0 today.
 * It is a named term in the sum rather than a thing to remember later, because
 * "included + bought" is the arithmetic even when the second half is always
 * zero, and a meter that cannot express it is a meter that gets rewritten.
 */
function statementAllowance(who) {
  if (who && who.isOwner) return { limit: null, tier: 'owner', included: null, credits: 0 };
  const tier = tierOf(who && who.plan);
  const included = STATEMENT_PAGES[tier];
  const credits = 0; // TODO: read the purchased balance when the credit pack ships.
  return { limit: included + credits, tier, included, credits };
}

/**
 * The monthly AI-action allowance for a caller. `null` = unlimited (owner).
 *
 * Free is 0 here, but a free user is not blocked by this number — the AI
 * features are Pro-gated upstream, and the free taste is bounded by the global
 * USD budgets in aiBudget.js. Returning 0 rather than null keeps "free has no
 * allowance of their own" true in one place.
 */
function aiAllowance(who) {
  if (who && who.isOwner) return { limit: null, tier: 'owner' };
  const tier = tierOf(who && who.plan);
  return { limit: AI_ACTIONS[tier], tier };
}

module.exports = { STATEMENT_PAGES, AI_ACTIONS, tierOf, statementAllowance, aiAllowance };
