// File Vault — Phase 2: the ciphertext-only storage backend.
//
// The server's ONLY job is to keep sealed boxes safe. Everything arriving here
// was encrypted on the user's device (lib/vault-crypto.ts): file bytes, file
// keys, even file NAMES are opaque blobs. There is no key material on this
// side — not in the DB, not in env, nowhere. A full database + disk dump
// yields ciphertext and sizes, nothing else. That's the product.
//
// Upload is chunked (default 8 MB) so big files never buffer whole in memory
// and flaky connections resume: init → PUT chunks at strictly-increasing
// offsets → complete (size must match the declaration). Quota is enforced at
// init time against the user's plan.
const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { guard } = require('../utils/toolFlag');
const { trackEvent } = require('../utils/trackEvent');
const db = require('../db');

const router = express.Router();

const VAULT_DIR = process.env.VAULT_DIR || '/var/lib/dd-vault';
const QUOTA_BYTES = Number(process.env.VAULT_QUOTA_GB || 10) * 1024 * 1024 * 1024;
const MAX_FILE = Number(process.env.VAULT_MAX_FILE_MB || 500) * 1024 * 1024;
const MAX_CHUNK = Number(process.env.VAULT_CHUNK_MB || 8) * 1024 * 1024;
const OWNER_EMAILS = (process.env.AI_OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// The vault is a Pro feature (it costs real storage). Owner tests pre-launch.
async function requirePro(req, res, next) {
  try {
    const { rows } = await db.query('SELECT plan, email FROM users WHERE id = $1', [req.user.userId]);
    const email = rows[0] ? String(rows[0].email || '').toLowerCase() : '';
    if (rows[0] && (rows[0].plan === 'pro' || OWNER_EMAILS.includes(email))) return next();
    return res.status(402).json({ error: 'pro-required', message: 'The File Vault is a Pro feature.' });
  } catch (e) {
    console.error('vault pro check failed:', e.message);
    return res.status(500).json({ error: 'server', message: 'Please try again.' });
  }
}

router.use(guard('/file-vault'));
router.use(requireAuth);
router.use(requirePro);

const userDir = (userId) => path.join(VAULT_DIR, String(userId));
const blobPath = (userId, id) => path.join(userDir(userId), id); // id = server UUID, no traversal possible

async function usedBytes(userId) {
  const { rows } = await db.query(
    "SELECT COALESCE(SUM(size),0) AS used FROM vault_files WHERE user_id = $1 AND kind = 'file'", [userId]);
  return Number(rows[0].used);
}

// ---- vault lifecycle --------------------------------------------------------

// GET /api/vault → does a vault exist + header + usage
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT header FROM vault_config WHERE user_id = $1', [req.user.userId]);
    const used = await usedBytes(req.user.userId);
    return res.json({ exists: rows.length > 0, header: rows[0] ? rows[0].header : null, used, quota: QUOTA_BYTES });
  } catch (e) { console.error('vault get:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/vault → create (409 if it exists — creation is a one-time ceremony)
router.post('/', async (req, res) => {
  const header = req.body && req.body.header;
  if (!header || typeof header !== 'object' || !header.pass || !header.recovery) {
    return res.status(400).json({ error: 'bad-header', message: 'A sealed vault header is required.' });
  }
  try {
    const ins = await db.query(
      'INSERT INTO vault_config (user_id, header) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING RETURNING user_id',
      [req.user.userId, header]);
    if (!ins.rows.length) return res.status(409).json({ error: 'exists', message: 'This account already has a vault.' });
    await fsp.mkdir(userDir(req.user.userId), { recursive: true });
    trackEvent(req, 'vault_created', { module: '/file-vault', userId: req.user.userId });
    return res.status(201).json({ ok: true });
  } catch (e) { console.error('vault create:', e.message); return res.status(500).json({ error: 'server' }); }
});

// PUT /api/vault/header → passphrase re-wrap (client did the crypto; files untouched)
router.put('/header', async (req, res) => {
  const header = req.body && req.body.header;
  if (!header || typeof header !== 'object' || !header.pass || !header.recovery) {
    return res.status(400).json({ error: 'bad-header' });
  }
  try {
    const upd = await db.query('UPDATE vault_config SET header = $2, updated_at = now() WHERE user_id = $1 RETURNING user_id',
      [req.user.userId, header]);
    if (!upd.rows.length) return res.status(404).json({ error: 'no-vault' });
    return res.json({ ok: true });
  } catch (e) { console.error('vault header:', e.message); return res.status(500).json({ error: 'server' }); }
});

// ---- files & folders ----------------------------------------------------------

// GET /api/vault/files → the full (sealed) listing; the client decrypts names.
router.get('/files', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, parent_id AS "parentId", kind, sealed_name AS "sealedName", wrapped_fk AS "wrappedFk",
              size, status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM vault_files WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.userId]);
    return res.json({ files: rows });
  } catch (e) { console.error('vault list:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/vault/files → folder, or file-upload init (quota checked HERE)
router.post('/files', async (req, res) => {
  const { kind, sealedName, wrappedFk, size, parentId } = req.body || {};
  if (typeof sealedName !== 'string' || !sealedName || sealedName.length > 4096) {
    return res.status(400).json({ error: 'bad-name' });
  }
  try {
    if (parentId) {
      const p = await db.query("SELECT id FROM vault_files WHERE id = $1 AND user_id = $2 AND kind = 'folder'", [parentId, req.user.userId]);
      if (!p.rows.length) return res.status(400).json({ error: 'bad-parent' });
    }
    if (kind === 'folder') {
      const { rows } = await db.query(
        `INSERT INTO vault_files (id, user_id, parent_id, kind, sealed_name, status)
         VALUES ($1, $2, $3, 'folder', $4, 'ready') RETURNING id`,
        [randomUUID(), req.user.userId, parentId || null, sealedName]);
      return res.status(201).json({ id: rows[0].id });
    }
    const declared = Number(size);
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_FILE) {
      return res.status(400).json({ error: 'bad-size', message: `Files up to ${Math.round(MAX_FILE / 1048576)} MB.` });
    }
    if (typeof wrappedFk !== 'string' || !wrappedFk || wrappedFk.length > 2048) return res.status(400).json({ error: 'bad-key' });
    const used = await usedBytes(req.user.userId);
    if (used + declared > QUOTA_BYTES) {
      return res.status(413).json({ error: 'quota', message: 'Vault is full — free some space or contact support.', used, quota: QUOTA_BYTES });
    }
    const id = randomUUID();
    await db.query(
      `INSERT INTO vault_files (id, user_id, parent_id, kind, sealed_name, wrapped_fk, size, uploaded, status)
       VALUES ($1, $2, $3, 'file', $4, $5, $6, 0, 'uploading')`,
      [id, req.user.userId, parentId || null, sealedName, wrappedFk, declared]);
    await fsp.mkdir(userDir(req.user.userId), { recursive: true });
    return res.status(201).json({ id, chunkBytes: MAX_CHUNK });
  } catch (e) { console.error('vault init:', e.message); return res.status(500).json({ error: 'server' }); }
});

// PUT /api/vault/files/:id/chunk?offset=N — raw sealed bytes, strictly in order.
router.put('/files/:id/chunk', express.raw({ type: '*/*', limit: MAX_CHUNK + 1024 }), async (req, res) => {
  const offset = Number(req.query.offset);
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'empty-chunk' });
  if (body.length > MAX_CHUNK) return res.status(413).json({ error: 'chunk-too-big' });
  try {
    const { rows } = await db.query(
      "SELECT uploaded, size, status FROM vault_files WHERE id = $1 AND user_id = $2 AND kind = 'file'",
      [req.params.id, req.user.userId]);
    const f = rows[0];
    if (!f) return res.status(404).json({ error: 'not-found' });
    if (f.status !== 'uploading') return res.status(409).json({ error: 'already-complete' });
    if (offset !== Number(f.uploaded)) return res.status(409).json({ error: 'bad-offset', expected: Number(f.uploaded) });
    if (Number(f.uploaded) + body.length > Number(f.size)) return res.status(400).json({ error: 'overflow', message: 'More bytes than declared.' });
    await fsp.appendFile(blobPath(req.user.userId, req.params.id), body);
    await db.query('UPDATE vault_files SET uploaded = uploaded + $3, updated_at = now() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId, body.length]);
    return res.json({ uploaded: Number(f.uploaded) + body.length });
  } catch (e) { console.error('vault chunk:', e.message); return res.status(500).json({ error: 'server' }); }
});

// POST /api/vault/files/:id/complete — declared size must match exactly.
router.post('/files/:id/complete', async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT uploaded, size, status FROM vault_files WHERE id = $1 AND user_id = $2 AND kind = 'file'",
      [req.params.id, req.user.userId]);
    const f = rows[0];
    if (!f) return res.status(404).json({ error: 'not-found' });
    if (f.status === 'ready') return res.json({ ok: true });
    if (Number(f.uploaded) !== Number(f.size)) {
      return res.status(409).json({ error: 'incomplete', uploaded: Number(f.uploaded), size: Number(f.size) });
    }
    await db.query("UPDATE vault_files SET status = 'ready', updated_at = now() WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.userId]);
    trackEvent(req, 'vault_upload', { module: '/file-vault', userId: req.user.userId });
    return res.json({ ok: true });
  } catch (e) { console.error('vault complete:', e.message); return res.status(500).json({ error: 'server' }); }
});

// GET /api/vault/files/:id → stream the sealed bytes back (ready files only).
router.get('/files/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT size, status FROM vault_files WHERE id = $1 AND user_id = $2 AND kind = 'file'",
      [req.params.id, req.user.userId]);
    const f = rows[0];
    if (!f) return res.status(404).json({ error: 'not-found' });
    if (f.status !== 'ready') return res.status(409).json({ error: 'incomplete' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(f.size));
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(blobPath(req.user.userId, req.params.id));
    stream.on('error', (e) => { console.error('vault stream:', e.message); if (!res.headersSent) res.status(500).end(); else res.destroy(); });
    stream.pipe(res);
  } catch (e) { console.error('vault download:', e.message); return res.status(500).json({ error: 'server' }); }
});

// PATCH /api/vault/files/:id → rename (new sealed name) and/or move.
router.patch('/files/:id', async (req, res) => {
  const { sealedName, parentId } = req.body || {};
  if (sealedName !== undefined && (typeof sealedName !== 'string' || !sealedName || sealedName.length > 4096)) {
    return res.status(400).json({ error: 'bad-name' });
  }
  try {
    if (parentId) {
      const p = await db.query("SELECT id FROM vault_files WHERE id = $1 AND user_id = $2 AND kind = 'folder'", [parentId, req.user.userId]);
      if (!p.rows.length) return res.status(400).json({ error: 'bad-parent' });
      if (parentId === req.params.id) return res.status(400).json({ error: 'bad-parent' });
    }
    const { rows } = await db.query(
      `UPDATE vault_files SET
         sealed_name = COALESCE($3, sealed_name),
         parent_id = CASE WHEN $4::uuid IS NOT NULL THEN $4::uuid ELSE parent_id END,
         updated_at = now()
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.userId, sealedName ?? null, parentId ?? null]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    return res.json({ ok: true });
  } catch (e) { console.error('vault patch:', e.message); return res.status(500).json({ error: 'server' }); }
});

// DELETE /api/vault/files/:id → blob + row. Folders only when empty (v1).
router.delete('/files/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT kind FROM vault_files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
    const f = rows[0];
    if (!f) return res.status(404).json({ error: 'not-found' });
    if (f.kind === 'folder') {
      const kids = await db.query('SELECT 1 FROM vault_files WHERE parent_id = $1 AND user_id = $2 LIMIT 1', [req.params.id, req.user.userId]);
      if (kids.rows.length) return res.status(409).json({ error: 'not-empty', message: 'Empty the folder first.' });
    }
    await db.query('DELETE FROM vault_files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
    if (f.kind === 'file') await fsp.rm(blobPath(req.user.userId, req.params.id), { force: true });
    return res.json({ ok: true });
  } catch (e) { console.error('vault delete:', e.message); return res.status(500).json({ error: 'server' }); }
});

module.exports = router;
