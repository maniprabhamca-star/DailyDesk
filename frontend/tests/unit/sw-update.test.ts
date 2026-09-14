import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* The service worker's update path, pinned in both directions.
 *
 * This has now failed in BOTH directions on the same product, a month apart:
 *
 *   - Automatic skipWaiting swapped the worker under live tabs and took their
 *     already-loaded chunks with it. That is the stale-shell incident the
 *     worker was rewritten to prevent.
 *   - Removing it entirely meant a phone with the tab left open kept build N
 *     while N+1 and N+2 queued behind it. Fixes that were live on the server
 *     were invisible on the device for a day, and the reports read "you still
 *     haven't fixed it".
 *
 * The settlement is: never on install, always on request. Both halves are load
 * bearing, and a future tidy-up that deletes either one re-opens an incident,
 * so both are asserted here against the template's source.
 */

const root = resolve(__dirname, '../..');
const template = readFileSync(resolve(root, 'public/sw.template.js'), 'utf8');
const register = readFileSync(resolve(root, 'components/pwa-register.tsx'), 'utf8');

/** The source with comments stripped, so prose about skipWaiting is not evidence of it. */
const code = template
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('service worker update path', () => {
  it('never calls skipWaiting on install — live tabs keep their chunks', () => {
    const install = code.match(/addEventListener\(\s*'install'[\s\S]*?\n\}\);/);
    expect(install, 'the install handler must still exist').not.toBeNull();
    expect(install![0], 'an install-time skipWaiting is the stale-shell incident')
      .not.toMatch(/skipWaiting/);
  });

  it('does call skipWaiting when a tab explicitly asks', () => {
    // Without this the Reload button has nothing to talk to, and a phone that
    // never closes its tabs never sees a new build.
    expect(code).toMatch(/DD_SKIP_WAITING/);
    const msg = code.match(/addEventListener\(\s*'message'[\s\S]*?\n\}\);/);
    expect(msg, 'the message handler must exist').not.toBeNull();
    expect(msg![0]).toMatch(/DD_SKIP_WAITING[\s\S]*skipWaiting\(\)/);
  });

  it('claims clients on activate, or the new worker controls nothing', () => {
    expect(code).toMatch(/clients\.claim\(\)/);
  });

  it('the app offers the update rather than waiting to be discovered', () => {
    // The three pieces that make the banner work at all.
    expect(register, 'must notice a worker that installed behind the current one')
      .toMatch(/updatefound/);
    expect(register, 'must ask the waiting worker to take over').toMatch(/DD_SKIP_WAITING/);
    expect(register, 'must reload once it has').toMatch(/controllerchange/);
  });

  it('only reloads for a takeover the person asked for', () => {
    // controllerchange also fires the first time any worker claims a page.
    // Reloading then would bounce every first-time visitor.
    expect(register).toMatch(/askedRef/);
    const handler = register.match(/const onControllerChange[\s\S]*?\n {4}\};/);
    expect(handler, 'the controllerchange handler must exist').not.toBeNull();
    expect(handler![0]).toMatch(/if \(!askedRef\.current\) return;/);
  });
});
