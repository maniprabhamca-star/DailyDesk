// Real per-client key for rate limiting behind Cloudflare -> nginx.
//
// The API is only reached through the reverse proxy, so express's socket peer is
// always the loopback address — keying on that would put every visitor in ONE
// shared bucket. Cloudflare sets `CF-Connecting-IP` to the true visitor and
// overwrites any client-supplied value, so it's the reliable per-user key.
// Falls back to express's resolved `req.ip` (correct once `trust proxy` is set)
// for any request that didn't come through Cloudflare (e.g. local health checks).
//
// ⚠ The IP is narrowed to a /56 network by express-rate-limit's own
// `ipKeyGenerator` before it becomes the key. A single residential IPv6
// subscriber is handed a whole prefix and can pick a fresh address per request,
// so keying on the full address gave one person an unlimited supply of empty
// buckets — every limit in the app was bypassable from any IPv6 connection.
// IPv4 addresses pass through untouched, and the IPv4-mapped form
// (`::ffff:1.2.3.4`) collapses to the plain address, so the same visitor can no
// longer end up in two different buckets depending on which hop reported them.
const { ipKeyGenerator } = require('express-rate-limit');

function clientKey(req) {
  const ip = req.headers['cf-connecting-ip'] || req.ip;
  if (!ip) return 'unknown';
  return ipKeyGenerator(ip);
}

module.exports = { clientKey };
