#!/usr/bin/env node
/* Generates public/sw.js from public/sw.template.js with a build-stamped id.
 *
 * WHY THIS EXISTS: the service worker that caused the July 2026 stale-shell
 * incident carried `const VERSION = 'v1'`, hand-maintained. Commit 8fde731
 * edited that file for the rebrand and left VERSION untouched — so the only
 * cache-eviction path in the worker never fired. A hand-maintained constant is
 * not a mechanism. This script makes the id impossible to forget.
 *
 * The id also guarantees the emitted sw.js differs byte-wise every build, which
 * is what makes browsers install the new worker at all.
 *
 * Wired as `prebuild` + `predev` in package.json, so it runs on the VPS deploy
 * (`npm run build`) without anyone remembering to invoke it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TEMPLATE = new URL('../public/sw.template.js', import.meta.url);
const OUT = new URL('../public/sw.js', import.meta.url);

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'nogit'; // building from a tarball / no git — still unique via the suffix
  }
}

const id = `${process.env.BUILD_ID || gitSha()}-${Date.now().toString(36)}`;

const src = readFileSync(TEMPLATE, 'utf8');
if (!src.includes('__BUILD_ID__')) {
  console.error('gen-sw: __BUILD_ID__ placeholder missing from sw.template.js — refusing to emit.');
  process.exit(1);
}

writeFileSync(OUT, src.replace('__BUILD_ID__', id));
console.log(`gen-sw: public/sw.js built (${id})`);
