const bcrypt = require('bcryptjs');
const db = require('../db');

// Account self-service: the transparency ledger, the GDPR exits, and passwords.
//
// The export and the deletion are not features in the product sense — Article 20
// (portability) and Article 17 (erasure) both require them and we had neither,
// while serving the UK and EU. See docs/designs/account-page.md.
//
// Every user-owned table cascades from users(id), so erasure really is one
// DELETE. That is worth stating explicitly because it is the sort of thing that
// silently stops being true when someone adds a table without the FK.
const OWNED_TABLES = [
  { table: 'notes', label: 'Notes', href: '/notes' },
  { table: 'habits', label: 'Habits', href: '/habits' },
  { table: 'habit_logs', label: 'Habit check-ins', href: '/habits' },
  { table: 'expenses', label: 'Budget entries', href: '/budget' },
  { table: 'bio_pages', label: 'Link-in-bio page', href: '/link-in-bio' },
  { table: 'files', label: 'Stored files', href: null },
  { table: 'vault_files', label: 'Vault items (encrypted — we cannot read these)', href: '/file-vault' },
];

/** Google sign-ups get a random unguessable hash, so "your current password"
 *  is a question they can never answer. Track whether one was ever chosen. */
async function ensureHasPasswordColumn() {
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password BOOLEAN NOT NULL DEFAULT true");
}

async function countFor(table, userId) {
  try {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE user_id = $1`, [userId]);
    return rows[0]?.n ?? 0;
  } catch {
    // A table that isn't deployed yet must not take the whole ledger down —
    // an account page that 500s is worse than one row reading zero.
    return 0;
  }
}

/** The ledger. Everything of yours that lives on our server, including the
 *  rows that are empty — "nothing stored" is the product working, and it only
 *  reads as an answer if we show it. */
exports.dataSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await db.query(
      'SELECT created_at, storage_used_bytes, plan FROM users WHERE id = $1', [userId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const counts = await Promise.all(
      OWNED_TABLES.map(async (t) => ({ ...t, count: await countFor(t.table, userId) })),
    );

    await ensureHasPasswordColumn().catch(() => {});
    const { rows: pw } = await db.query('SELECT has_password FROM users WHERE id = $1', [userId]);

    res.json({
      memberSince: rows[0].created_at,
      storageUsedBytes: Number(rows[0].storage_used_bytes || 0),
      hasPassword: pw[0]?.has_password !== false,
      items: counts,
    });
  } catch (err) {
    console.error('dataSummary error:', err);
    res.status(500).json({ error: 'Could not read your account summary.' });
  }
};

/** Article 20: structured, commonly used, machine-readable. JSON, one file,
 *  no queue and no "we'll email it within 30 days". */
exports.exportData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows: userRows } = await db.query(
      'SELECT id, name, email, plan, storage_used_bytes, created_at, updated_at FROM users WHERE id = $1',
      [userId],
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const data = {};
    for (const { table } of OWNED_TABLES) {
      try {
        const { rows } = await db.query(`SELECT * FROM ${table} WHERE user_id = $1`, [userId]);
        data[table] = rows;
      } catch {
        data[table] = [];
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="diemdesk-${userId}.json"`);
    res.send(JSON.stringify({
      exportedAt: new Date().toISOString(),
      note: 'Everything DiemDesk holds about this account. Files processed with the '
        + 'in-browser tools never reached our servers, so they are not here — there '
        + 'was never a copy to include. Vault items are end-to-end encrypted and are '
        + 'exported as stored: we cannot decrypt them.',
      account: userRows[0],
      ...data,
    }, null, 2));
  } catch (err) {
    console.error('exportData error:', err);
    res.status(500).json({ error: 'Could not build your export.' });
  }
};

/** Set or change a password. Someone who signed up with Google has never had
 *  one, so they are not asked for a current password they cannot know. */
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Choose a password of at least 8 characters.' });
  }
  try {
    await ensureHasPasswordColumn().catch(() => {});
    const { rows } = await db.query('SELECT password_hash, has_password FROM users WHERE id = $1', [req.user.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const hadOne = rows[0].has_password !== false;
    if (hadOne) {
      if (!currentPassword) return res.status(400).json({ error: 'Enter your current password.' });
      const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!ok) return res.status(400).json({ error: 'That current password is not right.' });
    }

    const hash = await bcrypt.hash(String(newPassword), 12);
    await db.query(
      'UPDATE users SET password_hash = $1, has_password = true, updated_at = NOW() WHERE id = $2',
      [hash, req.user.userId],
    );
    res.json({ ok: true, set: !hadOne });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Could not change your password.' });
  }
};

/** Article 17. Immediate and real — every owned table cascades from users(id).
 *  Re-verified by typing the email address, plus the password where there is
 *  one, because a destructive action reached by a single click is a trap. */
exports.deleteAccount = async (req, res) => {
  const { password, confirmEmail } = req.body || {};
  try {
    await ensureHasPasswordColumn().catch(() => {});
    const { rows } = await db.query('SELECT email, password_hash, has_password FROM users WHERE id = $1', [req.user.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const emailMatches = String(confirmEmail || '').trim().toLowerCase() === String(rows[0].email).toLowerCase();
    if (!emailMatches) return res.status(400).json({ error: 'Type your email address exactly to confirm.' });

    if (rows[0].has_password !== false) {
      if (!password) return res.status(400).json({ error: 'Enter your password to confirm.' });
      const ok = await bcrypt.compare(password, rows[0].password_hash);
      if (!ok) return res.status(400).json({ error: 'That password is not right.' });
    }

    // Deliberately not a soft delete. "Deleted" that means "hidden for 30 days"
    // is not what the word means, and not what someone asking for erasure wants.
    await db.query('DELETE FROM users WHERE id = $1', [req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteAccount error:', err);
    res.status(500).json({ error: 'Could not delete your account. Nothing was changed.' });
  }
};
