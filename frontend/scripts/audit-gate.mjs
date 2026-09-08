// Fail the build on a high or critical advisory in anything that ships.
//
// `npm audit --audit-level=high` cannot express "everything except this one
// known thing", so the only ways to use it directly are to fail the build
// permanently on debt we have already decided about, or to lower the bar to
// critical and miss the next real one. Both are worse than thirty lines here.
//
// The allowlist is the point: every entry needs a reason and a date, and it
// expires. An exception nobody has looked at in three months should start
// failing again, because by then it is not an exception, it is a decision that
// was never revisited.

import { execSync } from 'node:child_process';

const ALLOW = [
  // Empty, and that is the point.
  //
  // This held two waivers — next and postcss, both high, both reachable only
  // through the Next build pipeline, both resolving at Next 16 — with an expiry
  // of 2026-11-30 so that nobody could renew them by reflex. The Next 14 -> 16
  // upgrade cleared both, so they are deleted rather than left as tidy-looking
  // dead entries. A waiver list that still names advisories which no longer
  // exist teaches you to skim it.
];

let report;
try {
  report = JSON.parse(execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch (e) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  try { report = JSON.parse(e.stdout); } catch { console.error('Could not parse npm audit output.'); process.exit(1); }
}

const serious = Object.entries(report.vulnerabilities || {})
  .filter(([, v]) => v.severity === 'high' || v.severity === 'critical');

const today = new Date().toISOString().slice(0, 10);
const expired = ALLOW.filter((a) => a.expires < today);
const allowed = new Set(ALLOW.filter((a) => a.expires >= today).map((a) => a.name));

const blocking = serious.filter(([name]) => !allowed.has(name));
const waived = serious.filter(([name]) => allowed.has(name));

for (const [name, v] of waived) {
  const a = ALLOW.find((x) => x.name === name);
  console.log(`~ WAIVED  ${name} (${v.severity}) — expires ${a.expires}\n    ${a.reason}`);
}

if (expired.length) {
  console.error('\nThese waivers have expired and must be re-decided, not renewed by reflex:');
  for (const a of expired) console.error(`  ${a.name} — waived ${a.added}, expired ${a.expires}`);
  process.exit(1);
}

if (blocking.length) {
  console.error(`\n${blocking.length} unwaived high/critical advisory in shipping dependencies:`);
  for (const [name, v] of blocking) {
    console.error(`  ${v.severity.toUpperCase()} ${name} ${v.range}`);
    console.error(`    ${v.via?.[0]?.title || '(no title)'}`);
  }
  console.error('\nFix with `npm audit fix`, or add a waiver in scripts/audit-gate.mjs with a reason and an expiry.');
  process.exit(1);
}

console.log(`\nNo unwaived high/critical advisories in shipping dependencies (${waived.length} waived).`);
