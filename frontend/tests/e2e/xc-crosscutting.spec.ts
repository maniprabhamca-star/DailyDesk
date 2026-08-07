import { test, expect, type Page } from '@playwright/test';
import { ARCHETYPES, allRoutes, isEnvNoise, publicRoutes, gatedRoutes } from './_routes';

// XC-001..XC-005 from docs/qa/test-catalog.md, run data-driven over the routes
// the app itself declares.
//
// Cost control: the FULL sweep (every route) runs on chromium only — it is a
// coverage net, and running ~140 routes × 4 engines would take longer than
// anyone will wait for. Every other browser runs the archetype set, which is
// where cross-engine differences actually show up.

const FULL_SWEEP_PROJECT = 'chromium';

type Meta = {
  status: number;
  title: string;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  jsonLd: string[];
  ogTitle: string | null;
};

async function readMeta(page: Page, path: string): Promise<Meta> {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  const status = res?.status() ?? 0;
  return {
    status,
    title: await page.title(),
    description: await page.locator('meta[name="description"]').first().getAttribute('content').catch(() => null),
    canonical: await page.locator('link[rel="canonical"]').first().getAttribute('href').catch(() => null),
    robots: await page.locator('meta[name="robots"]').first().getAttribute('content').catch(() => null),
    h1Count: await page.locator('h1').count(),
    jsonLd: await page.locator('script[type="application/ld+json"]').allTextContents(),
    ogTitle: await page.locator('meta[property="og:title"]').first().getAttribute('content').catch(() => null),
  };
}

test.describe('XC — cross-cutting, every route', () => {
  const routes = allRoutes();

  for (const { path, kind } of routes) {
    test(`XC ${path} [${kind}]`, async ({ page }, testInfo) => {
      // Full sweep on one engine; the rest cover the archetypes below.
      test.skip(
        testInfo.project.name !== FULL_SWEEP_PROJECT && !ARCHETYPES.some((a) => a.path === path),
        'full sweep runs on chromium; other engines run the archetype set',
      );

      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error' && !isEnvNoise(m.text())) errors.push(m.text()); });
      page.on('pageerror', (e) => { if (!isEnvNoise(e.message)) errors.push(`pageerror: ${e.message}`); });

      const meta = await readMeta(page, path);

      // XC-001 — the page is actually there, and says what it is.
      expect(meta.status, `${path} should return 200`).toBe(200);
      expect(meta.h1Count, `${path} needs exactly one <h1>`).toBe(1);

      // XC-002 — nothing threw. This is the assertion that would have caught a
      // broken engine long before a user rang about it.
      expect(errors, `${path} console errors`).toEqual([]);

      // XC-003 — SEO invariants. Titles over 60 and descriptions over 155 get
      // truncated in results, which is a silent loss of click-through.
      expect(meta.title.length, `${path} title ≤60 ("${meta.title}")`).toBeLessThanOrEqual(60);
      expect(meta.title.length, `${path} has a title`).toBeGreaterThan(5);
      expect(meta.description, `${path} needs a meta description`).toBeTruthy();
      expect((meta.description || '').length, `${path} description ≤155`).toBeLessThanOrEqual(155);
      expect(meta.canonical, `${path} needs a canonical`).toBeTruthy();
      expect(meta.canonical, `${path} canonical must be absolute`).toMatch(/^https?:\/\//);
      expect(meta.ogTitle, `${path} needs an og:title`).toBeTruthy();

      for (const raw of meta.jsonLd) {
        expect(() => JSON.parse(raw), `${path} has invalid JSON-LD`).not.toThrow();
      }

      // XC-004 — indexability matches intent. A gated tool that says "index"
      // gets a thin coming-soon page into Google that then has to earn its way
      // back out.
      if (kind === 'gated') {
        expect(meta.robots || '', `${path} is gated so it must be noindex`).toMatch(/noindex/);
      } else {
        expect(meta.robots || 'index', `${path} is public so it must be indexable`).not.toMatch(/noindex/);
      }
    });
  }
});

test.describe('XC-005 — responsive, no sideways scroll', () => {
  for (const { path, arch } of ARCHETYPES) {
    test(`${path} [${arch}] fits 375 / 768 / 1280`, async ({ page }) => {
      for (const width of [375, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Let fonts and any client layout settle before measuring.
        await page.waitForTimeout(250);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const offenders: string[] = [];
          // Wide content (a comparison table, a code block) is ALLOWED to be
          // wider than the screen as long as it scrolls inside its own
          // container — that's the house rule. What is never allowed is the
          // page body scrolling sideways. So an element only counts as an
          // offender when nothing above it scrolls horizontally.
          const insideScroller = (el: Element) => {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const ox = getComputedStyle(p).overflowX;
              if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
            }
            return false;
          };
          document.querySelectorAll('main *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > window.innerWidth + 1 && !insideScroller(el)) {
              offenders.push(`${el.tagName}.${String(el.className).slice(0, 40)}`);
            }
          });
          return { bodyScrolls: doc.scrollWidth > window.innerWidth + 1, offenders: offenders.slice(0, 5) };
        });

        expect(overflow.bodyScrolls, `${path} at ${width}px scrolls sideways`).toBe(false);
        expect(overflow.offenders, `${path} at ${width}px overflowing elements`).toEqual([]);
      }
    });
  }
});

test.describe('SEO — the sitemap tells the truth', () => {
  test('every advertised URL is real and indexable', async ({ request, baseURL }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length, 'sitemap should not be empty').toBeGreaterThan(50);

    // Sample rather than fetch all of them on every run — the full set is
    // covered by the XC sweep above; this guards the sitemap file itself.
    const sample = urls.filter((_, i) => i % 7 === 0).slice(0, 20);
    for (const url of sample) {
      const path = new URL(url).pathname;
      const r = await request.get(path);
      expect(r.status(), `${path} is in the sitemap but returns ${r.status()}`).toBe(200);
      expect(await r.text(), `${path} is in the sitemap but is noindex`).not.toMatch(/name="robots" content="noindex/);
    }
    expect(baseURL).toBeTruthy();
  });

  test('no gated route is advertised to crawlers', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const leaked = gatedRoutes().filter((p) => xml.includes(`${p}<`) || xml.includes(`${p}</loc>`));
    expect(leaked, 'gated routes must stay out of the sitemap').toEqual([]);
  });

  test('every public route is advertised', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    // A public tool missing from the sitemap is invisible to search — the
    // silent version of shipping nothing at all.
    const missing = publicRoutes().filter((p) => !xml.includes(`${p}</loc>`) && p !== '/');
    expect(missing, 'public routes missing from the sitemap').toEqual([]);
  });
});
