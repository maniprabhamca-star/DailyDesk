const db = require('../db');
const { signToken } = require('../utils/token');

// Re-read the account from the DB and return a FRESH token + user. The frontend
// calls this after returning from Stripe checkout so a plan change (free→pro)
// takes effect immediately without a full re-login.
exports.getMe = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, plan FROM users WHERE id = $1', [req.user.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({ token: signToken(u.id, u.email, u.plan), user: { id: u.id, name: u.name, email: u.email, plan: u.plan } });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Failed to refresh account' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, plan, storage_used_bytes, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const result = await db.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, plan',
      [name, req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
