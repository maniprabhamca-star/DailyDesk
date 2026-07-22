const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { clientKey } = require('../utils/rateLimitKey');
const { makeStore, redisDown } = require('../utils/rateLimitStore');
const { isCanaryReq } = require('../utils/canary');

// Credential endpoints get a TIGHT limiter on top of the global one — the
// global 300/15min is sized for tool usage, which is ~280 more login attempts
// per window than any honest person needs. Keyed to the real client IP
// (spoof-proof: the origin only accepts traffic from Cloudflare).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: clientKey,
  store: makeStore('rl:auth:'),
  skip: (req) => redisDown() || isCanaryReq(req),
  message: { error: 'rate', message: 'Too many attempts — please wait a few minutes and try again.' },
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/google', authLimiter, authController.googleLogin);

module.exports = router;
