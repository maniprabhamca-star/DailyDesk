import { describe, expect, it } from 'vitest';

/* The CSP is assembled in next.config.js and compiled into the build. Two
 * things about it are worth holding down by test rather than by memory.
 *
 * 1. `upgrade-insecure-requests` is switchable — DD_ALLOW_PLAIN_HTTP=1 removes
 *    it, because WebKit applies it to http://localhost and the E2E suite serves
 *    the production bundle over plain http there (see tests/e2e/_global-setup.ts
 *    for the full account). A switch that exists for the test harness is exactly
 *    the kind of thing that later becomes how a directive quietly disappears for
 *    everyone, so: a default build must still carry it.
 *
 * 2. `frame-src blob:` has now been dropped twice, and both times it took every
 *    PDF preview in the product with it — the preview frames a blob: URL built
 *    in the browser, which is what "your file never leaves your device" means in
 *    practice. child-src does not cover it; frame-src overrides child-src for
 *    frames. It is one word and it is load-bearing.
 */

async function policy(env: Record<string, string | undefined>): Promise<string> {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    // require(), deliberately, and it has to stay require().
    //
    // These tests read next.config.js twice with different process.env values,
    // because the whole point is that DD_ALLOW_PLAIN_HTTP changes the CSP the
    // build emits. import() caches by specifier and gives no way to evict, so
    // the second read would return the first result and the test would pass
    // whatever the config did. require.cache can be cleared, which is the only
    // reason this is not an ESM import.
    delete require.cache[require.resolve('../../next.config.js')];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../next.config.js');
    const rules = await config.headers();
    const root = rules.find((r: { source: string }) => r.source === '/:path*');
    return root.headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value;
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

describe('the Content-Security-Policy we ship', () => {
  it('upgrades insecure requests in an ordinary build', async () => {
    const csp = await policy({ DD_ALLOW_PLAIN_HTTP: undefined });
    expect(csp, 'a production build must keep upgrade-insecure-requests').toContain('upgrade-insecure-requests');
  });

  it('drops that one directive, and only that one, for a plain-http test build', async () => {
    const prod = await policy({ DD_ALLOW_PLAIN_HTTP: undefined });
    const test = await policy({ DD_ALLOW_PLAIN_HTTP: '1' });

    expect(test).not.toContain('upgrade-insecure-requests');

    const removed = prod.split('; ').filter((d) => !test.split('; ').includes(d));
    expect(removed, 'the test build must differ by exactly one directive').toEqual(['upgrade-insecure-requests']);
  });

  it('keeps blob: framing, which every PDF preview depends on', async () => {
    const csp = await policy({ DD_ALLOW_PLAIN_HTTP: undefined });
    const frameSrc = csp.split('; ').find((d) => d.startsWith('frame-src'));
    expect(frameSrc, 'frame-src must allow blob: or every PDF preview goes blank').toContain('blob:');
  });

  it('refuses third-party framing while still letting us frame our own blobs', async () => {
    const csp = await policy({ DD_ALLOW_PLAIN_HTTP: undefined });
    // 'self' rather than 'none'. A blob: document inherits this CSP, so 'none'
    // made WebKit refuse to let our own page frame our own blob — which broke
    // Print and every Folder Preview card on Safari. 'self' still blocks every
    // other origin, which is what the directive is for.
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp, "'none' breaks blob framing in WebKit — see next.config.js").not.toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});

