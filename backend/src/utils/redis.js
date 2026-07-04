// Shared Redis connection (ioredis). Redis runs on the same box, bound to
// loopback. Used for the rate limiter's shared store so counts are consistent
// across all pm2 cluster workers (an in-memory store would give each worker its
// own counter, making every limit N× too loose).
const Redis = require('ioredis');

const client = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // Fail fast instead of buffering forever if Redis is briefly unavailable — the
  // rate limiter degrades to "allow" rather than hanging the request.
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
});

// Never let a Redis hiccup crash the process; log once per disconnect.
let warned = false;
client.on('error', (err) => {
  if (!warned) { console.error('[redis] connection error:', err.message); warned = true; }
});
client.on('ready', () => { warned = false; });

module.exports = client;
