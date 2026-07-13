// Shared identity check for the monitoring canary (backend/scripts/canary.js).
//
// The canary probes the server tools over HTTP from localhost. It authenticates
// as a HEALTH PROBE — not a user — by sending the secret CANARY_TOKEN in the
// `x-canary` header. Any request bearing the correct token MUST bypass EVERY rate
// limiter, quota, and kill-switch. Otherwise the canary meters itself against a
// user cap (e.g. the 3/day free-conversion quota), gets HTTP 429, and its own
// probe reads that as "tool broken" — auto-disabling a perfectly healthy tool.
// That exact bug took /word-to-pdf + /pdf-to-word offline daily until 2026-07-13.
// See docs/canary-and-rate-limits.md for the full contract.
//
// SECURITY: the check is token-only. CANARY_TOKEN is an unforgeable secret in the
// backend .env. NEVER exempt by IP / loopback instead — a request that reaches the
// origin directly can spoof `cf-connecting-ip: 127.0.0.1` and dodge every quota.
const CANARY_TOKEN = process.env.CANARY_TOKEN || '';

function isCanaryReq(req) {
  return !!CANARY_TOKEN && req.headers['x-canary'] === CANARY_TOKEN;
}

module.exports = { isCanaryReq, CANARY_TOKEN };
