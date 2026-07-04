// Redis-backed store factory for express-rate-limit. A shared store keeps rate
// limits consistent across every pm2 cluster worker (and, later, across multiple
// app servers) — without it each worker counts independently and the effective
// limit is multiplied by the worker count.
//
// If Redis is unreachable, RedisStore surfaces the error; we tolerate that by
// falling back to allowing the request (see the client's enableOfflineQueue:false
// + the limiter usage) rather than 500-ing. Redis is local, so this is rare.
const { RedisStore } = require('rate-limit-redis');
const redis = require('./redis');

function makeStore(prefix) {
  return new RedisStore({
    prefix,
    // ioredis: forward the raw command express-rate-limit wants to run.
    sendCommand: (...args) => redis.call(...args),
  });
}

// Fail-open guard: if Redis isn't ready, skip rate limiting entirely rather than
// 500-ing every request. Availability > strict limiting during a store outage.
function redisDown() {
  return redis.status !== 'ready';
}

module.exports = { makeStore, redisDown };
