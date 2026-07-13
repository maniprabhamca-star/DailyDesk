// Server-side enforcement of the admin "kill switch" (tool_flags table).
//
// The front-end already HIDES disabled tools, but DiemDesk's *processed* tools
// (the LibreOffice converters and OCR) have real API endpoints that a bot or a
// script can call directly — bypassing the hidden button. So when a server tool
// is switched off in the admin console, the endpoint itself must also refuse.
//
// We block ONLY on the 'disabled' status — the red "Kill" button. 'pro' and
// 'coming_soon' are front-end / billing concerns (the API has no user context
// here), so they stay allowed at this layer. Fail-open: any DB error => allowed,
// so a database hiccup can never take a working tool offline.
const db = require('../db');
const { isCanaryReq } = require('./canary');

const TTL_MS = 30 * 1000; // match the public /api/tools/flags cache
let cache = { at: 0, blocked: new Set() };

async function refresh() {
  const { rows } = await db.query("SELECT slug FROM tool_flags WHERE status = 'disabled'");
  cache = { at: Date.now(), blocked: new Set(rows.map((r) => r.slug)) };
}

// True if the given tool slug (e.g. '/pdf-to-word') is currently killed by an admin.
async function isDisabled(slug) {
  try {
    if (Date.now() - cache.at > TTL_MS) await refresh();
    return cache.blocked.has(slug);
  } catch (err) {
    console.error('toolFlag check error:', err.message);
    return false; // fail-open — never break a live tool on a DB error
  }
}

// Express guard: replies 503 when the tool is killed, else calls next().
// `slugFor` is a slug string, or a function(req) => slug for endpoints that
// serve a single fixed tool.
function guard(slugFor) {
  return async (req, res, next) => {
    const slug = typeof slugFor === 'function' ? slugFor(req) : slugFor;
    // The monitoring canary (x-canary) may probe a disabled tool to detect recovery.
    const isCanary = isCanaryReq(req);
    if (slug && !isCanary && (await isDisabled(slug))) {
      return res.status(503).json({
        error: 'tool-disabled',
        message: 'This tool is temporarily unavailable. Please try again later.',
      });
    }
    next();
  };
}

module.exports = { isDisabled, guard };
