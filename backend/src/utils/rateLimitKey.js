// Real per-client key for rate limiting behind Cloudflare -> nginx.
//
// The API is only reached through the reverse proxy, so express's socket peer is
// always the loopback address — keying on that would put every visitor in ONE
// shared bucket. Cloudflare sets `CF-Connecting-IP` to the true visitor and
// overwrites any client-supplied value, so it's the reliable per-user key.
// Falls back to express's resolved `req.ip` (correct once `trust proxy` is set)
// for any request that didn't come through Cloudflare (e.g. local health checks).
function clientKey(req) {
  return req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

module.exports = { clientKey };
