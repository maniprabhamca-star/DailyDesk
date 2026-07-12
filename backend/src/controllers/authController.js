const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { trackEvent } = require('../utils/trackEvent');
const { sendMail } = require('../utils/mailer');

const FRONTEND = process.env.FRONTEND_URL || 'https://diemdesk.com';

function signToken(userId, email, plan) {
  return jwt.sign(
    { userId, email, plan },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, plan) VALUES ($1, $2, $3, $4) RETURNING id, name, email, plan',
      [name, email, hash, 'free']
    );

    const user = result.rows[0];
    const token = signToken(user.id, user.email, user.plan);
    trackEvent(req, 'signup', { userId: user.id });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await db.query('SELECT id, name, email, password_hash, plan, status FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Blocked accounts (set from the admin portal) cannot sign in
    if (user.status === 'suspended' || user.status === 'deleted') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    const token = signToken(user.id, user.email, user.plan);
    db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]).catch(() => {});
    trackEvent(req, 'login', { userId: user.id });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Forgot password: email a one-hour, single-use reset link. We store only a
// SHA-256 hash of the token (never the raw token) and ALWAYS return the same
// response whether or not the email exists, so this can't be used to discover
// which addresses are registered.
exports.forgotPassword = async (req, res) => {
  const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const generic = { ok: true, message: 'If that email is registered, a reset link is on its way.' };
  try {
    const { rows } = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (rows.length) {
      const user = rows[0];
      const raw = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.query('UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3', [hash, expires, user.id]);
      const link = `${FRONTEND}/reset-password?token=${raw}`;
      const text = `Hi ${user.name || 'there'},\n\nWe got a request to reset your DiemDesk password. Open this link to choose a new one (it works for 1 hour):\n\n${link}\n\nIf you didn't ask for this, just ignore this email — your password stays the same.\n\n— DiemDesk`;
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
  <p>Hi ${user.name || 'there'},</p>
  <p>We got a request to reset your DiemDesk password. Choose a new one with the button below — it works for <strong>1 hour</strong>.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#4F46E5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Reset my password</a></p>
  <p style="font-size:13px;color:#64748b">Or paste this link into your browser:<br><a href="${link}" style="color:#4F46E5">${link}</a></p>
  <p style="font-size:13px;color:#64748b">If you didn't ask for this, just ignore this email — your password stays the same.</p>
  <p style="font-size:13px;color:#64748b">— DiemDesk</p>
</div>`;
      try { await sendMail({ to: user.email, subject: 'Reset your DiemDesk password', text, html }); }
      catch (e) { console.error('Password reset email failed:', e.message); }
    }
    res.json(generic);
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Could not process the request. Please try again.' });
  }
};

// Reset password: verify the (hashed) token is valid and unexpired, set the new
// password, and clear the token so the link can't be reused.
exports.resetPassword = async (req, res) => {
  const token = req.body && req.body.token ? String(req.body.token) : '';
  const password = req.body && req.body.password ? String(req.body.password) : '';
  if (!token || !password) return res.status(400).json({ error: 'Reset token and new password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await db.query(
      'SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
      [hash]
    );
    if (!rows.length) return res.status(400).json({ error: 'This reset link is invalid or has expired — please request a new one.' });
    const pwHash = await bcrypt.hash(password, 12);
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      [pwHash, rows[0].id]
    );
    res.json({ ok: true, message: 'Your password has been reset. You can sign in with it now.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Could not reset the password. Please try again.' });
  }
};

exports.refresh = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const newToken = signToken(decoded.userId, decoded.email, decoded.plan);
    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
