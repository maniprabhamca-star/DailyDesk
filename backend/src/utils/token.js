const jwt = require('jsonwebtoken');

// Shared JWT signer — the token carries the plan so the frontend can gate
// offline. After a plan change (e.g. Stripe upgrade) a fresh token is minted
// via /api/user/me so the change takes effect without a full re-login.
//
// 30 days, not 7. At 7 the owner was signed out simply by not visiting for a
// week, and the front end only ever renewed a token on /account — so ordinary
// daily use never extended it either (both halves of that are fixed; the client
// now touches /me once per tab). Override with JWT_EXPIRES_IN if this ever needs
// to be shorter for a specific deployment.
function signToken(userId, email, plan) {
  return jwt.sign(
    { userId, email, plan },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

module.exports = { signToken };
