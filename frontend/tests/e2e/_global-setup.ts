import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/* Fail the run in one legible line rather than fifty illegible ones.
 *
 * The suite serves the production bundle over plain http on localhost, and the
 * production CSP carries `upgrade-insecure-requests`. Chromium exempts
 * localhost from that directive; WebKit does not — it rewrites every script,
 * stylesheet and manifest URL to https://localhost:3100, every one fails with
 * an SSL connect error, and no JavaScript runs at all. The pages still render,
 * because Next already sent the server HTML, so nothing announces itself as
 * broken. What you get instead is around fifty webkit failures that each look
 * like their own bug: a splash that never lifts, a file input that never
 * appears, an account page stuck on "Loading…", dark theme never applying.
 * That is precisely the shape of a failure that gets labelled engine flake and
 * waived, which is what happened to it for months.
 *
 * next compiles headers() into routes-manifest.json at BUILD time, so this
 * cannot be fixed by the test runner at boot — the build itself has to be made
 * with DD_ALLOW_PLAIN_HTTP=1. Checking the built artifact is the only honest
 * way to know it was, so check it here and say so plainly. */
export default function globalSetup() {
  // Respect NEXT_DIST_DIR, because next.config.js does: `distDir` is
  // `process.env.NEXT_DIST_DIR || '.next'` so that several preview servers can
  // build side by side. Hardcoding '.next' here would make this check silently
  // pass against a build it never looked at — a guard that cannot fail is worse
  // than no guard, because it is also reassuring.
  const distDir = process.env.NEXT_DIST_DIR || '.next';
  const manifest = path.join(process.cwd(), distDir, 'routes-manifest.json');
  if (!existsSync(manifest)) return; // no build yet; webServer will report that far better than we can
  if (!readFileSync(manifest, 'utf8').includes('upgrade-insecure-requests')) return;

  throw new Error(
    [
      '',
      'This .next build carries `upgrade-insecure-requests` in its CSP.',
      '',
      'The suite serves it over http://localhost, and WebKit will upgrade every',
      'asset request to https, fail all of them, and run no JavaScript — so every',
      'webkit test fails against an unhydrated shell for reasons that look unrelated.',
      '',
      'Rebuild for testing:    DD_ALLOW_PLAIN_HTTP=1 npm run build',
      '',
      '(A production build sets nothing and keeps the directive, which is the point.',
      ' tests/unit/csp.test.ts holds that end of the guarantee.)',
      '',
    ].join('\n'),
  );
}
