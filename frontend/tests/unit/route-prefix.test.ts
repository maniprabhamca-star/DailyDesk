import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FORM_LIBRARIES } from '@/components/app/form-library-links';

// In production nginx proxies the ENTIRE /api/ prefix to the Express backend on
// :4000. A Next route handler at app/api/<anything>/route.ts therefore works
// perfectly in dev, passes the build, passes every test — and 404s on the live
// site only. That shipped once, on the forms fetch, and was caught by curling
// production after the deploy rather than by anything in this suite.
//
// Next route handlers live under app/forms-api/ (or any other prefix the repo
// owns). If a handler genuinely has to sit under /api/, the nginx config on the
// server has to gain a matching exception FIRST — and that config is not in
// this repo, which is the whole reason to avoid the prefix.

const APP = join(process.cwd(), 'app');

function routeHandlersUnder(dir: string, rel = ''): string[] {
  let found: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return found; }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found = found.concat(routeHandlersUnder(full, `${rel}/${name}`));
    else if (name === 'route.ts' || name === 'route.tsx') found.push(`app${rel}/${name}`);
  }
  return found;
}

describe('route handler prefixes', () => {
  it('puts no Next route handler under /api/ — nginx sends that to the backend', () => {
    const stranded = routeHandlersUnder(join(APP, 'api'), '/api');
    expect(
      stranded,
      `These would 404 in production only:\n  ${stranded.join('\n  ')}\nMove them off /api/, or add the nginx exception on the server first.`,
    ).toEqual([]);
  });

  it('still has the form routes where the client expects them', () => {
    const handlers = routeHandlersUnder(APP);
    expect(handlers).toContain('app/forms-api/index/route.ts');
    expect(handlers).toContain('app/forms-api/file/[slug]/route.ts');
  });
});

describe('form library entry points', () => {
  it('links only pages that exist', () => {
    // This list is rendered in the Tools mega-menu, the mobile menu and at the
    // foot of /tools. The last batch of pages like these shipped linked from
    // nowhere, which is why they come from one export now — and why a typo in
    // it must fail here rather than become a 404 in the navigation.
    for (const l of FORM_LIBRARIES) {
      const segments = l.href.replace(/^\//, '').split('/');
      const direct = join(APP, ...segments, 'page.tsx');
      // /for/accountants is served by app/for/[sector]/page.tsx, so a dynamic
      // sibling counts as the page too.
      const parent = join(APP, ...segments.slice(0, -1));
      const viaDynamic =
        segments.length > 1 &&
        existsSync(parent) &&
        readdirSync(parent).some((d) => d.startsWith('[') && existsSync(join(parent, d, 'page.tsx')));

      expect(
        existsSync(direct) || viaDynamic,
        `"${l.label}" points at ${l.href}, which has no page`,
      ).toBe(true);
    }
  });

  it('includes both form libraries', () => {
    const hrefs = FORM_LIBRARIES.map((l) => l.href);
    expect(hrefs).toContain('/us-forms');
    expect(hrefs).toContain('/india-forms');
  });
});
