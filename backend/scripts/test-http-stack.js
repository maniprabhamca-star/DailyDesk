#!/usr/bin/env node
/**
 * HTTP-stack regression harness — express, helmet, express-rate-limit.
 *
 * These three sit under every single request, and a major-version change in any
 * of them can alter behaviour without breaking a build or a unit test:
 *
 *  - express 5 replaced the route parser (path-to-regexp v8). An invalid path
 *    string now throws at require time, so simply loading the real app proves
 *    every route in every router still parses.
 *  - express 5 forwards a rejected promise from an async handler to the error
 *    middleware instead of leaving it unhandled. That is better, but it means
 *    the error handler is now on a path it never used to see.
 *  - helmet 8 raised the HSTS max-age to 365 days.
 *  - express-rate-limit 8 renamed `max` to `limit` and, more importantly, warns
 *    that a custom keyGenerator returning a raw IP lets IPv6 clients bypass
 *    every limit. Our clientKey now narrows to a /56.
 *
 * Run: npm run test:http-stack     (no database or redis required)
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const http = require('http');
const assert = require('assert');

let pass = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n         ${err.message}`);
  }
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  // ---------------------------------------------------------------- the real app
  console.log('\n[1] the real app boots and routes resolve under express 5');

  // Loading the app parses every route string in every router. Under express 4
  // an unsupported pattern was silently tolerated; under express 5 it throws.
  const app = require('../src/index.js');
  check('src/index.js loads (all routers parsed by path-to-regexp v8)', () => {
    assert.ok(app, 'app did not export');
  });

  const expressVersion = require('express/package.json').version;
  check('express is 5.x', () => {
    assert.match(expressVersion, /^5\./, `got ${expressVersion}`);
  });

  // The app calls app.listen() itself on require, so talk to a second instance
  // bound to an ephemeral port to avoid fighting over 4000.
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const health = await get(port, '/health');
  check('GET /health -> 200 JSON', () => {
    assert.strictEqual(health.status, 200);
    assert.strictEqual(JSON.parse(health.body).status, 'ok');
  });

  const missing = await get(port, '/api/definitely-not-a-route');
  check('unknown route -> 404 JSON from our handler', () => {
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(JSON.parse(missing.body).error, 'Route not found');
  });

  // ---------------------------------------------------------------- helmet 8
  console.log('\n[2] helmet 8 headers on a real response');

  const h = health.headers;
  check('X-Content-Type-Options: nosniff', () => assert.strictEqual(h['x-content-type-options'], 'nosniff'));
  check('X-Frame-Options: SAMEORIGIN', () => assert.strictEqual(h['x-frame-options'], 'SAMEORIGIN'));
  check('Referrer-Policy: no-referrer', () => assert.strictEqual(h['referrer-policy'], 'no-referrer'));
  check('X-Powered-By is gone', () => assert.strictEqual(h['x-powered-by'], undefined));
  check('HSTS is now 365 days (helmet 8 raised it from 180)', () => {
    assert.ok(h['strict-transport-security'], 'no HSTS header');
    const age = /max-age=(\d+)/.exec(h['strict-transport-security']);
    assert.ok(age, 'HSTS has no max-age');
    assert.strictEqual(Number(age[1]), 31536000, `max-age=${age && age[1]}`);
    assert.match(h['strict-transport-security'], /includeSubDomains/);
  });

  server.close();

  // ---------------------------------------------------- express-rate-limit 8
  console.log('\n[3] express-rate-limit 8 still limits, with the app\'s own options');

  const express = require('express');
  const rateLimit = require('express-rate-limit');
  const { clientKey } = require('../src/utils/rateLimitKey');

  const limited = express();
  limited.set('trust proxy', 2);
  // The same option shape index.js uses, with a small limit so it can be hit.
  limited.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 3,
    keyGenerator: clientKey,
    message: { error: 'Too many requests, please try again later.' },
  }));
  limited.get('/ping', (req, res) => res.json({ ok: true }));

  const ls = http.createServer(limited);
  await new Promise((r) => ls.listen(0, '127.0.0.1', r));
  const lp = ls.address().port;

  const ip = { 'cf-connecting-ip': '203.0.113.9' };
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await get(lp, '/ping', ip)).status);
  check('limit: 3 -> 200,200,200 then 429,429', () => {
    assert.deepStrictEqual(codes, [200, 200, 200, 429, 429]);
  });

  const blocked = await get(lp, '/ping', ip);
  check('429 body is our JSON message object', () => {
    assert.strictEqual(JSON.parse(blocked.body).error, 'Too many requests, please try again later.');
  });

  const other = await get(lp, '/ping', { 'cf-connecting-ip': '198.51.100.4' });
  check('a different client has its own bucket', () => {
    assert.strictEqual(other.status, 200);
  });

  // The IPv6 bypass this upgrade surfaced: two addresses one subscriber can hold
  // at the same time must share a bucket, or the limit means nothing.
  const v6a = await get(lp, '/ping', { 'cf-connecting-ip': '2001:db8:abcd:1200::1' });
  const v6b = await get(lp, '/ping', { 'cf-connecting-ip': '2001:db8:abcd:1200::2' });
  const v6c = await get(lp, '/ping', { 'cf-connecting-ip': '2001:db8:abcd:1200::3' });
  const v6d = await get(lp, '/ping', { 'cf-connecting-ip': '2001:db8:abcd:1200::4' });
  check('four IPv6 addresses in one /56 share a bucket (200,200,200,429)', () => {
    assert.deepStrictEqual([v6a.status, v6b.status, v6c.status, v6d.status], [200, 200, 200, 429]);
  });

  const farV6 = await get(lp, '/ping', { 'cf-connecting-ip': '2001:db8:abcd:9900::1' });
  check('a genuinely different IPv6 /56 is not collateral damage', () => {
    assert.strictEqual(farV6.status, 200);
  });

  check('IPv4-mapped IPv6 collapses to the plain address (one visitor, one bucket)', () => {
    const { ipKeyGenerator } = rateLimit;
    assert.strictEqual(ipKeyGenerator('::ffff:203.0.113.9'), '203.0.113.9');
  });

  ls.close();

  // -------------------------------------------- express 5 async error handling
  console.log('\n[4] express 5 sends a rejected async handler to the error middleware');

  const errApp = express();
  errApp.get('/boom', async () => { throw new Error('deliberate'); });
  // The same error handler shape as src/index.js.
  errApp.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: 'Internal server error' });
  });
  const es = http.createServer(errApp);
  await new Promise((r) => es.listen(0, '127.0.0.1', r));
  const boom = await get(es.address().port, '/boom');
  check('async throw -> 500 JSON, not a hung request', () => {
    assert.strictEqual(boom.status, 500);
    assert.strictEqual(JSON.parse(boom.body).error, 'Internal server error');
  });
  es.close();

  // -------------------------------------- the stripe webhook's raw body + signature
  console.log('\n[5] the stripe webhook still receives byte-exact JSON it can verify');

  // express.raw() is mounted before express.json() in src/index.js precisely so
  // that Stripe's signature can be checked against the exact bytes sent. If a
  // body parser ever gets in front of it, or express changes what raw() hands
  // over, verification fails for every webhook — payments stop being recorded
  // while checkout itself looks perfectly healthy.
  const Stripe = require('stripe');
  const SECRET = 'whsec_test_secret_for_the_harness_only';
  const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object: { id: 'cs_test' } } });

  const hookApp = express();
  let received = null;
  hookApp.post('/hook', express.raw({ type: 'application/json' }), (req, res) => {
    received = req.body;
    try {
      const stripeClient = new Stripe('sk_test_not_a_real_key');
      const header = stripeClient.webhooks.generateTestHeaderString({ payload, secret: SECRET });
      const event = stripeClient.webhooks.constructEvent(req.body, header, SECRET);
      res.json({ ok: true, type: event.type });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  });
  const hs = http.createServer(hookApp);
  await new Promise((r) => hs.listen(0, '127.0.0.1', r));

  const hookRes = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: hs.address().port, path: '/hook', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end(payload);
  });

  check('express.raw hands the handler a Buffer, not a parsed object', () => {
    assert.ok(Buffer.isBuffer(received), `got ${received === null ? 'nothing' : typeof received}`);
  });
  check('the bytes arrive unmodified (signature verification depends on this)', () => {
    assert.strictEqual(received.toString('utf8'), payload);
  });
  check('a correctly signed payload verifies under stripe 23', () => {
    assert.strictEqual(hookRes.status, 200, hookRes.body);
    assert.strictEqual(JSON.parse(hookRes.body).type, 'checkout.session.completed');
  });
  check('the pinned API version matches the SDK\'s own', () => {
    // Stripe.API_VERSION is the public surface; the cjs/apiVersion.js module it
    // comes from is not an exported subpath, so don't reach for that.
    const sdkPinned = Stripe.API_VERSION;
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'routes', 'stripe.js'), 'utf8');
    const pinned = /STRIPE_API_VERSION = '([^']+)'/.exec(source);
    assert.ok(pinned, 'STRIPE_API_VERSION not found in routes/stripe.js');
    assert.strictEqual(pinned[1], sdkPinned,
      `code pins ${pinned[1]} but the installed SDK pins ${sdkPinned} — read that release's breaking changes, then move the constant`);
  });
  hs.close();

  // ------------------------------------------------------------------- report
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('failed:', failures.join(', '));
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  console.error('\nharness crashed:', err);
  process.exit(1);
});
