const jwt = require('jsonwebtoken');

// Shared JWT signer — the token carries the plan so the frontend can gate
// offline. After a plan change (e.g. Stripe upgrade) a fresh token is minted
// via /api/user/me so the change takes effect without a full re-login.
function signToken(userId, email, plan) {
  return jwt.sign(
    { userId, email, plan },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { signToken };
