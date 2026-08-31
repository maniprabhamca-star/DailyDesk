// Live system facts for the owner dashboard.
//
// Everything here is MEASURED at request time. That constraint is the whole
// reason this exists rather than a written page: an audit on 2026-08-30 found
// ufw missing from PATH, every Node process running as root, and a nightly
// backup that never touched the database — none of which a hand-written
// "our hardening" page would have caught, because it would have restated what
// we believed instead of what was true.
//
// So no claim in this file is stored. If a check cannot be performed, it
// reports "unknown" rather than passing by default.

const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

const OWNER_EMAILS = (process.env.OWNER_EMAILS || 'maniprabhamca@gmail.com,mrmanigandan@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// Same gate as the rest of the owner dashboard: admin token, owner bypass key,
// or a logged-in owner account. 404 rather than 403 for everyone else — an
// endpoint that admits it exists is an endpoint worth attacking.
async function isOwnerRequest(req) {
  const token = process.env.ADMIN_API_TOKEN;
  if (token && req.headers['x-admin-token'] === token) return true;
  const bypass = process.env.OWNER_BYPASS_KEY;
  if (bypass && req.headers['x-owner-key'] === bypass) return true;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      const r = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
      const email = r.rows[0] && r.rows[0].email ? r.rows[0].email.toLowerCase() : null;
      return !!email && OWNER_EMAILS.includes(email);
    } catch { /* invalid token → not owner */ }
  }
  return false;
}

const run = (cmd, args, ms = 5000) => new Promise((resolve) => {
  execFile(cmd, args, { timeout: ms, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : String(stdout)));
});

// npm audit exits non-zero whenever it finds anything, so the JSON on stdout is
// the result even in the "error" case — discarding it would report every
// vulnerable install as "audit unavailable".
const runIn = (cwd, cmd, args, ms = 60000) => new Promise((resolve) => {
  execFile(cmd, args, { cwd, timeout: ms, maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32' },
    (err, stdout) => resolve(stdout && String(stdout).trim() ? String(stdout) : null));
});

/** A single check. `state` is pass | warn | fail | unknown — never a default pass. */
const check = (id, label, state, detail, action) => ({ id, label, state, detail, action: action || null });

// ── security ────────────────────────────────────────────────────────────────

async function securityChecks() {
  const out = [];

  // Headers, read from the live site rather than from our own config — the
  // config is what we asked for, the response is what visitors actually get.
  try {
    const res = await fetch('https://diemdesk.com/', { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    const want = {
      'content-security-policy': 'Content-Security-Policy',
      'strict-transport-security': 'HSTS',
      'x-content-type-options': 'X-Content-Type-Options',
      'x-frame-options': 'X-Frame-Options',
      'referrer-policy': 'Referrer-Policy',
      'permissions-policy': 'Permissions-Policy',
    };
    for (const [h, label] of Object.entries(want)) {
      const v = res.headers.get(h);
      out.push(check(`hdr-${h}`, label, v ? 'pass' : 'fail',
        v ? String(v).slice(0, 120) : 'not sent',
        v ? null : 'Add it in frontend/next.config.js or the nginx security.conf'));
    }
  } catch {
    out.push(check('hdr', 'Security headers', 'unknown', 'Could not reach the live site to read them'));
  }

  // SSH. Password auth being off is what makes a known IP survivable.
  const sshd = await run('sshd', ['-T']);
  if (sshd) {
    const pw = /^passwordauthentication\s+yes/im.test(sshd);
    const rootLogin = (sshd.match(/^permitrootlogin\s+(\S+)/im) || [])[1];
    out.push(check('ssh-pw', 'SSH password auth', pw ? 'fail' : 'pass',
      pw ? 'enabled — a leaked IP becomes brute-forceable' : 'disabled, keys only'));
    out.push(check('ssh-root', 'SSH root login', rootLogin === 'yes' ? 'warn' : 'pass',
      rootLogin || 'unknown'));
  } else {
    out.push(check('ssh', 'SSH configuration', 'unknown', 'sshd -T not readable from this process'));
  }

  const f2b = await run('systemctl', ['is-active', 'fail2ban']);
  out.push(check('fail2ban', 'fail2ban', f2b && f2b.trim() === 'active' ? 'pass' : 'warn',
    f2b ? f2b.trim() : 'not detected'));

  // Origin lock. If the origin answers directly, Cloudflare is decorative.
  const ipt = await run('iptables', ['-L', 'INPUT', '-n']);
  out.push(check('origin-lock', 'Origin locked to Cloudflare',
    ipt == null ? 'unknown' : (/CF-ONLY/.test(ipt) ? 'pass' : 'fail'),
    ipt == null ? 'iptables not readable' : (/CF-ONLY/.test(ipt) ? 'CF-ONLY rule present on 80/443' : 'no CF-ONLY rule — the IP may be reachable directly')));

  // The env file holds every credential the app has.
  try {
    const mode = (fs.statSync(path.join(__dirname, '..', '..', '.env')).mode & 0o777).toString(8);
    out.push(check('env-perms', 'backend/.env permissions', mode === '600' ? 'pass' : 'warn', mode,
      mode === '600' ? null : 'chmod 600 backend/.env'));
  } catch {
    out.push(check('env-perms', 'backend/.env permissions', 'unknown', 'not readable'));
  }

  // Privilege. Known-bad today, and stated rather than hidden.
  const asRoot = typeof process.getuid === 'function' ? process.getuid() === 0 : null;
  out.push(check('privilege', 'App process privilege',
    asRoot === null ? 'unknown' : (asRoot ? 'fail' : 'pass'),
    asRoot === null ? 'not determinable on this platform' : (asRoot ? 'running as root — any RCE is instant root' : `uid ${process.getuid()}`),
    asRoot ? 'Create a service user and set uid in the pm2 ecosystem file' : null));

  return out;
}

// ── backups ─────────────────────────────────────────────────────────────────

async function backupChecks() {
  const out = [];
  const dir = process.env.BACKUP_DIR || '/root/backups';

  // Ours, specifically. The box is shared with another project, and its
  // unrelated dump in the same directory was being read as evidence that we
  // had a backup — turning a hard fail into a reassuring warn. A status page
  // that reports somebody else's backup as yours is worse than one that
  // reports nothing at all.
  const dbName = process.env.DB_NAME || 'dailydesk';
  const mine = new RegExp('^' + dbName.replace(/[^a-z0-9_]/gi, '') + '[-_.]', 'i');

  let dbDump = null;
  try {
    dbDump = fs.readdirSync(dir).filter((f) => /\.(dump|sql|sql\.gz)$/i.test(f) && mine.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtime, size: fs.statSync(path.join(dir, f)).size }))
      .sort((a, b) => b.t - a.t)[0] || null;
  } catch { /* directory may not exist */ }

  const ageHrs = dbDump ? (Date.now() - dbDump.t.getTime()) / 36e5 : null;
  out.push(check('db-dump', 'Database backup',
    !dbDump ? 'fail' : (ageHrs > 48 ? 'warn' : 'pass'),
    !dbDump ? 'no database dump found — users, notes, expenses and tokens are unbacked'
      : `${dbDump.f} · ${(dbDump.size / 1048576).toFixed(1)} MB · ${ageHrs.toFixed(0)}h old`,
    !dbDump ? 'The nightly job tars /var/www but never runs pg_dump' : null));

  // A backup on the same disk as the thing it protects is not a backup.
  const offsite = !!(process.env.R2_BUCKET || process.env.BACKUP_REMOTE);
  out.push(check('offsite', 'Off-site copy', offsite ? 'pass' : 'fail',
    offsite ? `configured (${process.env.R2_BUCKET || process.env.BACKUP_REMOTE})`
      : 'backups stay on the same machine they protect',
    offsite ? null : 'Ship dumps to Cloudflare R2'));

  try {
    const { rows } = await db.query('SELECT pg_size_pretty(pg_database_size(current_database())) AS s');
    out.push(check('db-size', 'Database size', 'pass', rows[0].s));
  } catch {
    out.push(check('db-size', 'Database size', 'unknown', 'could not query'));
  }

  return out;
}

// ── dependencies ────────────────────────────────────────────────────────────

/** Read installed versions from a lockfile — what is deployed, not what is asked for. */
function installed(appDir) {
  const pkgPath = path.join(appDir, 'package.json');
  const lockPath = path.join(appDir, 'package-lock.json');
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')).packages || {}; } catch { /* no lock */ }
  const deps = Object.entries(pkg.dependencies || {}).map(([name, wanted]) => ({
    name,
    wanted,
    installed: (lock[`node_modules/${name}`] || {}).version || null,
  }));
  return { name: pkg.name, count: deps.length, deps: deps.sort((a, b) => a.name.localeCompare(b.name)) };
}

// npm audit shells out and is slow, so the result is cached briefly. The number
// is allowed to be a few minutes stale; it is not allowed to be invented.
let auditCache = { at: 0, data: null };
async function auditFor(appDir) {
  if (Date.now() - auditCache.at < 10 * 60 * 1000 && auditCache.data) return auditCache.data;
  const raw = await runIn(appDir, 'npm', ['audit', '--omit=dev', '--json'], 90000);
  let data = { error: 'audit unavailable' };
  if (raw) {
    try {
      const j = JSON.parse(raw);
      data = {
        totals: j.metadata ? j.metadata.vulnerabilities : null,
        items: Object.entries(j.vulnerabilities || {})
          .filter(([, v]) => v.severity === 'high' || v.severity === 'critical')
          .map(([name, v]) => ({ name, severity: v.severity, range: v.range, title: (v.via && v.via[0] && v.via[0].title) || null, direct: !!v.isDirect })),
      };
    } catch { /* keep the error shape */ }
  }
  auditCache = { at: Date.now(), data };
  return data;
}

router.get('/', async (req, res) => {
  if (!(await isOwnerRequest(req))) return res.status(404).json({ error: 'Not found' });
  try {
    const root = path.join(__dirname, '..', '..', '..');
    const [security, backups, audit] = await Promise.all([
      securityChecks(),
      backupChecks(),
      auditFor(path.join(root, 'frontend')),
    ]);
    return res.json({
      measuredAt: new Date().toISOString(),
      security,
      backups,
      dependencies: {
        frontend: installed(path.join(root, 'frontend')),
        backend: installed(path.join(root, 'backend')),
        mcp: installed(path.join(root, 'mcp')),
        audit,
      },
      runtime: { node: process.version, uptimeHours: +(process.uptime() / 3600).toFixed(1) },
    });
  } catch (e) {
    console.error('system report:', e.message);
    return res.status(500).json({ error: 'server', message: 'Could not build the report.' });
  }
});

module.exports = router;
