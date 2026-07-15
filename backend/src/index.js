require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { clientKey } = require('./utils/rateLimitKey');
const { makeStore, redisDown } = require('./utils/rateLimitStore');
const { isCanaryReq } = require('./utils/canary');

const app = express();
const PORT = process.env.PORT || 4000;

// Behind Cloudflare -> nginx (two proxies). Trust them so req.ip resolves to the
// real client instead of the loopback peer. (A number, not `true`, so it stays
// spoof-resistant and doesn't trip express-rate-limit's permissive-proxy check.)
app.set('trust proxy', 2);

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Stripe webhook — must run BEFORE the JSON parser and rate limiter: Stripe
// needs the exact raw body to verify the signature, and it controls the volume.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), require('./routes/stripe').webhookHandler);

// Global rate limit — a coarse safety net, keyed per real client (see clientKey).
// 300 / 15 min ≈ 20 req/min per user: generous for normal browsing + auth, still
// a backstop against abuse. Sensitive/expensive routes add stricter limits below.
// Analytics beacons are frequent and have their own limiter, so exclude them here
// to stop them from draining a user's global budget.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  keyGenerator: clientKey,
  store: makeStore('rl:global:'),
  message: { error: 'Too many requests, please try again later.' },
  // Skip analytics beacons (own limiter) and the monitoring canary (health probe,
  // not a user — see utils/canary.js + docs/canary-and-rate-limits.md).
  skip: (req) => redisDown() || req.originalUrl.startsWith('/api/events') || isCanaryReq(req),
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DailyDesk API', timestamp: new Date().toISOString() });
});

// API routes (to be added per module)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/convert', require('./routes/convert'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/events', require('./routes/events'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/tools', require('./routes/tools'));
app.use('/api/stripe', require('./routes/stripe').router);
app.use('/api/waitlist', require('./routes/waitlist'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Bind to loopback only — the API is reached via the nginx reverse proxy,
// never directly from the public internet.
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`DailyDesk API running on ${HOST}:${PORT}`);
});

module.exports = app;
