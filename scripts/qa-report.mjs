#!/usr/bin/env node
/**
 * Assemble the QA report the owner dashboard renders.
 *
 * Everything here is DERIVED from artefacts a run actually produced. Nothing is
 * hand-typed, because a hand-maintained list of "what we test" drifts from
 * reality the first time someone adds a spec and forgets — and a coverage page
 * that lies is worse than no coverage page, since it stops anyone looking.
 *
 * Inputs (all optional; missing ones are reported as missing, not faked):
 *   frontend/tests/.reports/e2e-*.json   Playwright JSON reporter, one per project
 *   frontend/tests/.reports/unit.json    Vitest JSON reporter
 *   frontend/lib/qa-bench.generated.json scripts/qa-bench.mjs
 *
 * Output: frontend/lib/qa-report.generated.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = join(ROOT, 'frontend', 'tests', '.reports');
const OUT = join(ROOT, 'frontend', 'lib', 'qa-report.generated.json');

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

/** Walk Playwright's nested suites into flat scenarios. */
function flattenPlaywright(json) {
  const out = [];
  const walk = (suite, trail) => {
    const path = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs || []) {
      const result = spec.tests?.[0]?.results?.[0];
      out.push({
        // The file is the grouping people think in; the trail is the story.
        file: basename(spec.file || path[0] || ''),
        group: path.slice(1).join(' › ') || path.join(' › '),
        title: spec.title,
        ok: spec.ok === true,
        status: result?.status ?? (spec.ok ? 'passed' : 'unknown'),
        ms: Math.round(result?.duration ?? 0),
      });
    }
    for (const child of suite.suites || []) walk(child, path);
  };
  for (const s of json.suites || []) walk(s, []);
  return out;
}

const projects = [];
if (existsSync(REPORTS)) {
  for (const f of readdirSync(REPORTS).filter((x) => /^e2e-.*\.json$/.test(x))) {
    const json = readJson(join(REPORTS, f));
    if (!json) continue;
    const scenarios = flattenPlaywright(json);
    if (!scenarios.length) continue;
    projects.push({
      project: f.replace(/^e2e-|\.json$/g, ''),
      total: scenarios.length,
      passed: scenarios.filter((s) => s.ok).length,
      failed: scenarios.filter((s) => !s.ok && s.status !== 'skipped').length,
      skipped: scenarios.filter((s) => s.status === 'skipped').length,
      durationMs: Math.round(json.stats?.duration ?? 0),
      scenarios,
    });
  }
}

// Vitest: shape differs from Playwright's, so it is normalised separately.
const unitJson = readJson(join(REPORTS, 'unit.json'));
const unit = unitJson ? {
  total: unitJson.numTotalTests ?? 0,
  passed: unitJson.numPassedTests ?? 0,
  failed: unitJson.numFailedTests ?? 0,
  durationMs: Math.round((unitJson.testResults || []).reduce((n, r) => n + ((r.endTime ?? 0) - (r.startTime ?? 0)), 0)),
  scenarios: (unitJson.testResults || []).flatMap((file) =>
    (file.assertionResults || []).map((t) => ({
      file: basename(file.name || ''),
      group: (t.ancestorTitles || []).join(' › '),
      title: t.title,
      ok: t.status === 'passed',
      status: t.status,
      ms: Math.round(t.duration ?? 0),
    }))),
} : null;

const bench = readJson(join(ROOT, 'frontend', 'lib', 'qa-bench.generated.json'));

/**
 * Trust, but count.
 *
 * Vitest's default threads pool silently DROPPED seven of eight test files when
 * their workers timed out under CPU contention — and still exited 0, reporting
 * 16 tests instead of 127. A dashboard fed that number would have shown a
 * confident, wrong figure, which is the precise failure this whole page exists
 * to prevent. So: compare what the report claims against what is on disk, and
 * refuse to present a partial run as a complete one.
 */
const unitFilesOnDisk = (() => {
  try {
    return readdirSync(join(ROOT, 'frontend', 'tests', 'unit')).filter((f) => /\.test\.tsx?$/.test(f)).length;
  } catch { return 0; }
})();
const unitFilesReported = new Set((unit?.scenarios || []).map((s) => s.file)).size;
const unitIncomplete = unitFilesOnDisk > 0 && unitFilesReported > 0 && unitFilesReported < unitFilesOnDisk;

// Group scenarios by the concern they cover, so the dashboard can answer
// "what do we actually check?" rather than only "did it pass".
const AREAS = [
  { id: 'seo', label: 'SEO & metadata', match: /XC-003|sitemap|canonical|meta/i },
  { id: 'a11y', label: 'Accessibility', match: /XC-006|XC-007|XC-008|axe|contrast|focus|reduced motion|Escape/i },
  { id: 'responsive', label: 'Responsive layout', match: /XC-005|375|768|1280|sideways|scroll|width/i },
  { id: 'engines', label: 'Engines — real files in, real bytes out', match: /engines|round-trip|IHDR|\.ico|convert|extract/i },
  { id: 'regressions', label: 'Named regressions', match: /REG-\d+/i },
  { id: 'account', label: 'Account & billing', match: /account|subscription|session|GDPR|delete/i },
  { id: 'nav', label: 'Navigation & catalogue', match: /menu|toolkit|catalog|tile|sector/i },
];

const allScenarios = [...projects.flatMap((p) => p.scenarios), ...(unit?.scenarios || [])];
const areas = AREAS.map((a) => {
  const hits = allScenarios.filter((s) => a.match.test(`${s.group} ${s.title}`));
  return {
    id: a.id,
    label: a.label,
    count: hits.length,
    passed: hits.filter((s) => s.ok).length,
    failed: hits.filter((s) => !s.ok && s.status !== 'skipped').length,
  };
}).filter((a) => a.count > 0);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    e2e: projects.reduce((n, p) => n + p.total, 0),
    e2ePassed: projects.reduce((n, p) => n + p.passed, 0),
    e2eFailed: projects.reduce((n, p) => n + p.failed, 0),
    unit: unit?.total ?? 0,
    unitPassed: unit?.passed ?? 0,
    unitFailed: unit?.failed ?? 0,
  },
  projects,
  unit,
  bench,
  areas,
  unitFilesOnDisk,
  unitFilesReported,
  missing: [
    ...(unitIncomplete ? [`Unit run was INCOMPLETE — reported ${unitFilesReported} of ${unitFilesOnDisk} test files. Re-run with --pool=forks; the threads pool drops timed-out workers without failing.`] : []),
    ...(projects.length ? [] : ['No Playwright report found — run the E2E suite with --reporter=json.']),
    ...(unit ? [] : ['No unit report found — run vitest with --reporter=json.']),
    ...(bench ? [] : ['No bench found — run node scripts/qa-bench.mjs.']),
  ],
};

writeFileSync(OUT, JSON.stringify(report, null, 2));
process.stdout.write(
  `QA report: ${report.totals.e2e} E2E (${report.totals.e2ePassed} passed), `
  + `${report.totals.unit} unit, ${areas.length} areas, bench ${bench ? 'present' : 'MISSING'}\n`
  + `Wrote ${OUT}\n`,
);
