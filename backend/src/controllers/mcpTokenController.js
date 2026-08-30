// Tokens for reaching DiemDesk from an assistant.
//
// The MCP server needs to prove who is calling so a Pro subscriber gets their
// Pro tools. Until now the only credential that existed was the login JWT, and
// the setup page told people to "paste your token" without saying where to find
// one — because there was nowhere. The honest answer was DevTools, which is not
// something to ask a paying customer to do.
//
// Two properties matter more than anything else here:
//
//   It must not expire. The login JWT lasts 30 days. When it lapsed, the MCP
//   would tell an actual subscriber "this needs a Pro account" — wrong, and
//   with no way to act on it. A credential that lives in a config file has to
//   keep working until someone decides otherwise.
//
//   It must be revocable, and storable safely. A token sitting in a JSON file
//   on disk is more exposed than a session cookie, so we keep only its SHA-256
//   and show the plaintext exactly once. A database leak yields hashes, not
//   working credentials.

const crypto = require('crypto');
const db = require('../db');

// Enough entropy that guessing is not a strategy: 32 random bytes, base64url.
// The `ddm_` prefix means a leaked token is recognisable on sight — in a paste,
// a log, or a secret scanner — rather than looking like anonymous base64.
const PREFIX = 'ddm_';
const MAX_TOKENS = 5;

function mint() {
  return PREFIX + crypto.randomBytes(32).toString('base64url');
}

/** Hash for storage and lookup. Fast is fine: this is high-entropy random, not a password. */
function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** List what exists, without ever being able to reproduce one. */
async function list(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, prefix, label, last_used_at, created_at
         FROM mcp_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId],
    );
    return res.json({
      tokens: rows.map((r) => ({
        id: r.id,
        // Enough to tell two apart, never enough to use.
        preview: `${r.prefix}…`,
        label: r.label,
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
      })),
      max: MAX_TOKENS,
    });
  } catch (e) {
    console.error('mcp token list:', e.message);
    return res.status(500).json({ error: 'server', message: 'Could not read your tokens.' });
  }
}

/** Create one. The plaintext is in this response and nowhere else, ever. */
async function create(req, res) {
  try {
    const { rows: existing } = await db.query(
      'SELECT COUNT(*)::int AS n FROM mcp_tokens WHERE user_id = $1',
      [req.user.userId],
    );
    if (existing[0].n >= MAX_TOKENS) {
      return res.status(409).json({
        error: 'too-many',
        message: `You already have ${MAX_TOKENS} tokens. Revoke one before creating another.`,
      });
    }

    const label = String((req.body && req.body.label) || 'Claude').trim().slice(0, 60) || 'Claude';
    const token = mint();

    await db.query(
      'INSERT INTO mcp_tokens (user_id, token_hash, prefix, label) VALUES ($1, $2, $3, $4)',
      [req.user.userId, hash(token), token.slice(0, 12), label],
    );

    // The only time this value leaves the server.
    return res.status(201).json({
      token,
      label,
      note: 'Copy this now — it is not shown again. If you lose it, revoke it and make another.',
    });
  } catch (e) {
    console.error('mcp token create:', e.message);
    return res.status(500).json({ error: 'server', message: 'Could not create a token.' });
  }
}

/** Revoke. Takes effect on the very next request; nothing is cached. */
async function revoke(req, res) {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM mcp_tokens WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId],
    );
    if (!rowCount) return res.status(404).json({ error: 'not-found', message: 'No such token.' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('mcp token revoke:', e.message);
    return res.status(500).json({ error: 'server', message: 'Could not revoke that token.' });
  }
}

/**
 * Resolve a bearer value to a user, or null if it is not one of ours.
 *
 * Called from entitlement.js before it tries to verify a JWT. Returns null
 * quickly and without touching the database for anything lacking our prefix,
 * so the normal login path pays almost nothing for this existing.
 */
async function resolve(bearer) {
  if (typeof bearer !== 'string' || !bearer.startsWith(PREFIX)) return null;
  try {
    const { rows } = await db.query(
      `SELECT t.id, u.id AS user_id, u.plan, u.email
         FROM mcp_tokens t JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1`,
      [hash(bearer)],
    );
    if (!rows.length) return null;

    // "Last used" is what makes an unfamiliar token in the list safe to revoke:
    // it answers "is anything still relying on this?". Fire-and-forget — a
    // failed bookkeeping write must never fail the conversion the user asked
    // for.
    db.query('UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = $1', [rows[0].id])
      .catch(() => { /* bookkeeping only */ });

    return { userId: rows[0].user_id, plan: rows[0].plan, email: rows[0].email };
  } catch (e) {
    console.error('mcp token resolve:', e.message);
    return null;
  }
}

module.exports = { list, create, revoke, resolve, PREFIX, MAX_TOKENS };
