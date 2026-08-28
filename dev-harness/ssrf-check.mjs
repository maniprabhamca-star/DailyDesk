/**
 * The SSRF guard is the only thing standing between "render this URL" and
 * "read our own cloud metadata endpoint", so it gets tested against the actual
 * bypasses rather than the obvious ones.
 *
 * Run: node dev-harness/ssrf-check.mjs   (from the repo root)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { validateTarget, _internals } = require('../backend/src/utils/ssrfGuard.js');
const { isPrivateAddress, normalizeIPv4, checkUrlShape } = _internals;

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

// --- addresses that must be treated as private ------------------------------
const PRIVATE = [
  '127.0.0.1', '127.1.1.1', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.1',
  '192.168.1.1', '169.254.169.254',            // AWS/GCP metadata — the classic target
  '0.0.0.0', '100.64.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
  '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
  '::ffff:127.0.0.1', '::ffff:169.254.169.254', '2002:7f00:1::', '64:ff9b::7f00:1',
  // Same loopback, written to dodge a naive string check.
  '2130706433', '0x7f000001', '0177.0.0.1',
];
for (const ip of PRIVATE) {
  check(`private: ${ip}`, isPrivateAddress(ip) === true);
}

// --- addresses that must be allowed -----------------------------------------
for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']) {
  check(`public: ${ip}`, isPrivateAddress(ip) === false);
}

// --- decimal/hex/octal normalisation ----------------------------------------
check('decimal 2130706433 → 127.0.0.1', normalizeIPv4('2130706433') === '127.0.0.1', String(normalizeIPv4('2130706433')));
check('hex 0x7f000001 → 127.0.0.1', normalizeIPv4('0x7f000001') === '127.0.0.1', String(normalizeIPv4('0x7f000001')));
check('octal 0177.0.0.1 → 127.0.0.1', normalizeIPv4('0177.0.0.1') === '127.0.0.1', String(normalizeIPv4('0177.0.0.1')));
check('a real hostname is not an IP', normalizeIPv4('example.com') === null);

// --- URL shapes that must be refused ----------------------------------------
const BAD_SHAPES = [
  ['file:///etc/passwd', 'file scheme'],
  ['gopher://evil/_', 'gopher scheme'],
  ['data:text/html,<h1>x', 'data scheme'],
  ['javascript:alert(1)', 'javascript scheme'],
  ['http://user:pass@example.com', 'credentials in the URL'],
  ['http://localhost:4000/', 'localhost by name'],
  ['http://LOCALHOST:4000/', 'localhost, shouted'],
  ['http://foo.localhost/', 'a .localhost subdomain'],
  ['http://box.internal/', '.internal'],
  ['http://printer.local/', '.local (mDNS)'],
  ['http://127.0.0.1:9222/json', 'the debugging port by IP'],
  ['http://[::1]:9222/json', 'the debugging port over IPv6'],
  ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
  ['http://2130706433/', 'loopback in decimal'],
  ['not a url at all', 'nonsense'],
  ['', 'empty'],
];
for (const [url, why] of BAD_SHAPES) {
  const r = checkUrlShape(url);
  check(`refused: ${why}`, r.ok === false, r.ok ? 'ALLOWED' : '');
}

// --- URL shapes that must be accepted ---------------------------------------
for (const url of ['https://example.com', 'http://example.com/a/b?c=d#e', 'https://example.com:8443/path']) {
  const r = checkUrlShape(url);
  check(`accepted: ${url}`, r.ok === true, r.ok ? '' : r.reason);
}

// --- the full path, including DNS -------------------------------------------
{
  const r = await validateTarget('http://localhost/');
  check('validateTarget refuses localhost', r.ok === false, r.reason || '');
}
{
  const r = await validateTarget('https://example.com/');
  check('validateTarget allows a real public site', r.ok === true, r.ok ? '' : r.reason);
}
{
  // A name that resolves to loopback is the case a string check cannot catch.
  const r = await validateTarget('http://localtest.me/');
  check('validateTarget refuses a public NAME that resolves to 127.0.0.1',
    r.ok === false, r.ok ? 'ALLOWED — resolves to loopback' : r.reason);
}
{
  const r = await validateTarget('https://no-such-host-hopefully-xyzzy-12345.example/');
  check('an unresolvable host is refused, not rendered', r.ok === false, r.reason || '');
}

// --- no internal detail leaks in the messages -------------------------------
{
  const r = await validateTarget('http://127.0.0.1:4000/api/admin');
  const msg = (r.reason || '').toLowerCase();
  check('the refusal message gives nothing away',
    !msg.includes('127.0.0.1') && !msg.includes('4000') && !msg.includes('admin'), r.reason);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
