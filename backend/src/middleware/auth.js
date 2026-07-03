const jwt = require('jsonwebtoken');
const db = require('../db');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Enforce account status set from the admin portal — suspension/deletion
  // takes effect immediately, even while the user holds a valid token.
  try {
    const { rows } = await db.query('SELECT status FROM users WHERE id = $1', [req.user.userId]);
    if (rows[0] && (rows[0].status === 'suspended' || rows[0].status === 'deleted')) {
      return res.status(403).json({ error: 'Account suspended' });
    }
  } catch (e) {
    // Fail open on a DB hiccup so a transient error can't lock everyone out.
    console.error('auth status check failed:', e.message);
  }

  next();
}

module.exports = { requireAuth };
