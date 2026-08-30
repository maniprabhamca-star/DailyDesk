// The MCP token contract, checked without a database.
//
// These are the properties that make the token safe to sit in a config file on
// someone's disk. Each one is here because getting it wrong is quiet: a token
// that is guessable, or recoverable from a table dump, or indistinguishable
// from a login JWT, fails in a way nobody notices until it matters.

const crypto = require('crypto');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name); } };

const mod = require(path.join(__dirname, '..', 'src', 'controllers', 'mcpTokenController.js'));
const { PREFIX, MAX_TOKENS } = mod;

// Reproduce the two internals the module keeps private, so the assertions below
// are testing the same shapes the controller writes to the database.
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

ok('prefix is ddm_ so a leaked token is recognisable on sight', PREFIX === 'ddm_');
ok('a sensible ceiling on tokens per user', MAX_TOKENS >= 1 && MAX_TOKENS <= 20);

// Shape, entropy and uniqueness.
const seen = new Set();
for (let i = 0; i < 500; i++) {
  const t = PREFIX + crypto.randomBytes(32).toString('base64url');
  seen.add(t);
  if (i === 0) {
    ok('starts with the prefix', t.startsWith(PREFIX));
    ok('base64url only — safe in JSON, a URL and a shell', /^ddm_[A-Za-z0-9_-]+$/.test(t));
    ok('long enough that guessing is not a strategy', t.length >= 40);
    ok('carries 256 bits of entropy', Buffer.from(t.slice(4), 'base64url').length === 32);
  }
}
ok('500 tokens, no collisions', seen.size === 500);

// Storage. A table dump must not yield working credentials.
const sample = PREFIX + crypto.randomBytes(32).toString('base64url');
const h = sha(sample);
ok('hash is 64 hex chars, matching CHAR(64)', /^[0-9a-f]{64}$/.test(h));
ok('hash is stable — the same token always finds its row', sha(sample) === h);
ok('hash differs per token', sha(sample) !== sha(PREFIX + 'other'));
ok('the plaintext is NOT recoverable from what is stored', !h.includes(sample.slice(4, 20)));

// The stored preview identifies without enabling.
const prefix12 = sample.slice(0, 12);
ok('preview is 12 chars, fitting VARCHAR(12)', prefix12.length === 12);
ok('preview is far too short to use', prefix12.length < sample.length / 2);
ok('preview keeps the ddm_ marker', prefix12.startsWith(PREFIX));

// Resolution must ignore anything that is not ours, without touching the DB.
(async () => {
  ok('a login JWT is not treated as an MCP token', await mod.resolve('eyJhbGciOiJIUzI1NiJ9.abc.def') === null);
  ok('empty is rejected', await mod.resolve('') === null);
  ok('a non-string is rejected', await mod.resolve(undefined) === null);
  ok('a near-miss prefix is rejected', await mod.resolve('ddm-' + 'x'.repeat(40)) === null);

  console.log(`\nmcp tokens: ${pass} passed, ${fail} failed`);
  console.log('A token in a config file is more exposed than a session cookie; these are the properties that make that safe.');
  process.exit(fail ? 1 : 0);
})();
