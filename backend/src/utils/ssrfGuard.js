// Guarding the one endpoint that fetches a URL a stranger gave us.
//
// A server that will render any URL you name is a server that will happily
// read its own metadata endpoint, its own admin ports, and anything else on
// the private network it sits in, then hand you a picture of the result. That
// is SSRF, and it is the entire risk of Webpage to PDF.
//
// Blocking "localhost" and "10.x" by name is not enough, because none of these
// are the same check:
//   - a hostname that RESOLVES to a private address (evil.com → 127.0.0.1)
//   - a redirect from a public page to a private one
//   - DNS rebinding: the name resolves publicly when we check and privately a
//     moment later when Chrome looks it up again
//   - an IPv6 form of a v4 address (::ffff:127.0.0.1, 2002:7f00:1::)
//   - a decimal or octal IPv4 literal (2130706433, 0177.0.0.1)
//
// So: validate the URL shape, resolve it ourselves, check every resolved
// address, and then re-check every single request Chrome actually makes —
// which is what closes the redirect and rebinding holes, because by then the
// address is the one being connected to.

const dns = require('dns').promises;
const net = require('net');

const MAX_URL_LEN = 2048;

/** Turn any IPv4 notation Node accepts into dotted quad, or null. */
function normalizeIPv4(host) {
  if (net.isIPv4(host)) return host;
  // Decimal (2130706433), hex (0x7f000001) and octal (0177.0.0.1) all reach
  // the network stack as 127.0.0.1 but do not look like it to a naive check.
  const single = /^0x[0-9a-f]+$/i.test(host) ? parseInt(host, 16)
    : /^0[0-7]+$/.test(host) ? parseInt(host, 8)
    : /^\d+$/.test(host) ? Number(host)
    : null;
  if (single !== null) {
    if (!Number.isSafeInteger(single) || single < 0 || single > 0xffffffff) return null;
    return [(single >>> 24) & 255, (single >>> 16) & 255, (single >>> 8) & 255, single & 255].join('.');
  }
  const parts = host.split('.');
  if (parts.length === 4 && parts.every((p) => /^(0x[0-9a-f]+|\d+)$/i.test(p))) {
    const nums = parts.map((p) => (/^0x/i.test(p) ? parseInt(p, 16) : parseInt(p, /^0\d/.test(p) ? 8 : 10)));
    if (nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return nums.join('.');
  }
  return null;
}

function isPrivateIPv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  if (a === 0) return true;                      // "this network"
  if (a === 10) return true;                     // RFC1918
  if (a === 127) return true;                    // loopback
  if (a === 169 && b === 254) return true;       // link-local, incl. 169.254.169.254 cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true;       // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;         // 192.0.0.0/24 + TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true;        // TEST-NET-2
  if (a === 203 && b === 0) return true;         // TEST-NET-3
  if (a >= 224) return true;                     // multicast, reserved, broadcast
  return false;
}

function isPrivateIPv6(ip) {
  const s = ip.toLowerCase().split('%')[0]; // drop any zone id
  if (s === '::' || s === '::1') return true;
  // v4-mapped / v4-compatible: judge the embedded v4 address.
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || s.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (/^(fc|fd)/.test(s)) return true;   // unique local fc00::/7
  if (/^fe[89ab]/.test(s)) return true;  // link-local fe80::/10
  if (/^ff/.test(s)) return true;        // multicast
  if (/^2002:/.test(s)) return true;     // 6to4 — can encapsulate a private v4
  if (/^64:ff9b:/.test(s)) return true;  // NAT64
  return false;
}

function isPrivateAddress(ip) {
  const v4 = normalizeIPv4(ip);
  if (v4) return isPrivateIPv4(v4);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognised — refuse rather than guess
}

/**
 * Check a URL's shape. Returns { ok } or { ok: false, reason } with a message
 * safe to show a user (it must never echo internal detail back).
 */
function checkUrlShape(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'Please enter a web address.' };
  if (raw.length > MAX_URL_LEN) return { ok: false, reason: 'That web address is too long.' };

  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'That does not look like a web address. It should start with https://' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    // file:, gopher:, data:, blob: — every one of these is a way in.
    return { ok: false, reason: 'Only http:// and https:// addresses can be captured.' };
  }
  if (u.username || u.password) {
    return { ok: false, reason: 'Addresses with a username or password in them are not accepted.' };
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) return { ok: false, reason: 'That web address has no site name.' };
  // A bare literal we can judge immediately, before any DNS.
  if (net.isIP(host) || normalizeIPv4(host)) {
    if (isPrivateAddress(host)) return { ok: false, reason: 'That address is on a private network, so it cannot be captured.' };
  }
  if (/^localhost$/i.test(host) || /\.localhost$/i.test(host) || /\.internal$/i.test(host) || /\.local$/i.test(host)) {
    return { ok: false, reason: 'That address is on a private network, so it cannot be captured.' };
  }
  return { ok: true, url: u };
}

/** Resolve the hostname and refuse if ANY answer is private. */
async function checkResolves(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) || normalizeIPv4(host)) {
    return isPrivateAddress(host)
      ? { ok: false, reason: 'That address is on a private network, so it cannot be captured.' }
      : { ok: true };
  }
  let answers;
  try {
    answers = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: 'That site could not be found.' };
  }
  if (!answers.length) return { ok: false, reason: 'That site could not be found.' };
  // ALL of them, not the first: a name can answer with a public and a private
  // address and Chrome may pick either.
  for (const a of answers) {
    if (isPrivateAddress(a.address)) {
      return { ok: false, reason: 'That address resolves to a private network, so it cannot be captured.' };
    }
  }
  return { ok: true };
}

/** Full pre-flight: shape, then DNS. */
async function validateTarget(raw) {
  const shape = checkUrlShape(raw);
  if (!shape.ok) return shape;
  const resolved = await checkResolves(shape.url.hostname);
  if (!resolved.ok) return resolved;
  return { ok: true, url: shape.url };
}

/**
 * The same judgement, for a URL Chrome is about to request. Used on every
 * request the page makes, which is where redirects and rebinding get caught —
 * the pre-flight above can only speak for the moment it ran.
 */
async function isRequestAllowed(raw) {
  const shape = checkUrlShape(raw);
  if (!shape.ok) return false;
  const resolved = await checkResolves(shape.url.hostname);
  return resolved.ok;
}

module.exports = {
  validateTarget,
  isRequestAllowed,
  // exported for the test harness
  _internals: { isPrivateAddress, normalizeIPv4, checkUrlShape },
};
