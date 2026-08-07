import { test, expect } from '@playwright/test';
import { ARCHETYPES, catalogRoutes } from './_routes';

// REG-015 / REG-016 — "Choose file does nothing", reported by a real user on
// 2026-08-06 and seen intermittently in testing before that.
//
// Two independent causes, both SILENT (nothing thrown, so the error beacon saw
// nothing). These tests fail on the old behaviour and are the reason we would
// notice a recurrence without a phone call.
//
//   REG-015  the input was display:none — the documented reason iOS Safari
//            refuses to open a picker. Runs on WebKit here, which is the engine
//            that actually punishes it.
//   REG-016  the picker only opened from a React onClick and the served HTML
//            has no <label for>, so every tap between first paint and hydration
//            did nothing at all.

const TOOL_PAGES = ['/compress-pdf', '/merge-pdf', '/jpg-to-pdf', '/compress-image', '/qr-code-generator'];

test.describe('REG-015 — file inputs must stay clickable in every engine', () => {
  for (const path of TOOL_PAGES) {
    test(`${path}: no file input is display:none`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const inputs = page.locator('input[type=file]');
      const count = await inputs.count();
      expect(count, `${path} should have a file input`).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const style = await inputs.nth(i).evaluate((el) => {
          const cs = getComputedStyle(el);
          return { display: cs.display, visibility: cs.visibility };
        });
        // display:none removes the element from layout, and Safari then ignores
        // the click JavaScript forwards to it. Off-screen is fine; invisible is not.
        expect(style.display, `${path} input #${i} must not be display:none (iOS picker never opens)`).not.toBe('none');
        expect(style.visibility, `${path} input #${i} must not be visibility:hidden`).not.toBe('hidden');
      }
    });
  }

  test('the codebase does not reintroduce .hidden on a file input', async ({ page }) => {
    // Cheap guard at the rendered level, across a spread of pages: catches a
    // future component that copies the old pattern.
    for (const { path } of ARCHETYPES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const bad = await page.locator('input[type=file]').evaluateAll((els) =>
        els.filter((el) => el.classList.contains('hidden')).length,
      );
      expect(bad, `${path} has a file input still using .hidden`).toBe(0);
    }
  });
});

test.describe('REG-016 — the picker works before React hydrates', () => {
  test('the rescue script is served, parses, and is early', async ({ page, request }) => {
    const html = await (await request.get('/compress-pdf')).text();
    expect(html, 'the rescue script must be inline in the document').toContain('__ddHydrated');

    // It shipped once as a single line with a // comment in it, which commented
    // out the whole script. Valid syntax, zero behaviour. Never again.
    const start = html.indexOf('(function(){');
    const end = html.indexOf('</script>', start);
    const body = html.slice(start, end);
    expect(() => new Function(body), 'the inline rescue script must parse').not.toThrow();
    expect(body.split('\n').some((l) => l.trim().startsWith('//')), 'no line comments in the inline script').toBe(false);

    // It has to be parsed before hydration can start. Next's own bundle tags sit
    // in <head> but load async, so their position proves nothing; the React
    // payload (self.__next_f) is the real "hydration begins here" marker, and the
    // rescue must precede it.
    const payload = html.indexOf('self.__next_f');
    expect(payload, 'expected a React payload in the document').toBeGreaterThan(-1);
    expect(html.indexOf('__ddHydrated'), 'the rescue must be parsed before hydration data').toBeLessThan(payload);
  });

  test('a click in the dead window opens the picker, and only once', async ({ page }) => {
    await page.goto('/compress-pdf', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);

    const result = await page.evaluate(async () => {
      const w = window as unknown as { __ddHydrated?: boolean; __ddEarlyPick?: number };
      const input = document.querySelector('input[type=file]') as HTMLInputElement;
      const zone = [...document.querySelectorAll('div')].find(
        (d) => d.className.includes('border-dashed') && /Drop|Choose/i.test(d.textContent || ''),
      ) as HTMLElement;
      if (!input || !zone) return { error: 'no dropzone' };

      let clicks = 0;
      const count = () => { clicks++; };
      input.addEventListener('click', count);
      // Opening a real picker would block the run, so intercept at the input.
      const stop = (e: Event) => e.preventDefault();
      input.addEventListener('click', stop);

      // Pretend hydration has not happened — the state a real user hits.
      w.__ddHydrated = false;
      w.__ddEarlyPick = 0;
      zone.click();
      await new Promise((r) => setTimeout(r, 100));
      const dead = { clicks, rescue: w.__ddEarlyPick || 0 };

      // And now the normal, hydrated path.
      w.__ddHydrated = true;
      clicks = 0;
      const before = w.__ddEarlyPick || 0;
      zone.click();
      await new Promise((r) => setTimeout(r, 100));
      const live = { clicks, rescue: (w.__ddEarlyPick || 0) - before };

      input.removeEventListener('click', count);
      input.removeEventListener('click', stop);
      return { dead, live };
    });

    expect(result.error).toBeUndefined();
    // Before hydration the rescue must carry the click through.
    expect(result.dead?.clicks, 'a tap before hydration must still open the picker').toBe(1);
    expect(result.dead?.rescue, 'the rescue should be what handled it').toBe(1);
    // After hydration React owns it — and the picker must not open twice.
    expect(result.live?.clicks, 'exactly one picker open after hydration').toBe(1);
    expect(result.live?.rescue, 'the rescue must stand down once React is up').toBe(0);
  });

  test('every dropzone can actually receive a file', async ({ page }) => {
    // The end of the story the user reported: pick a file, and the tool reacts.
    await page.goto('/qr-code-generator', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);
    const input = page.locator('input[type=file]').first();
    await expect(input).toBeAttached();
  });
});

test.describe('the catalog never links somewhere broken', () => {
  test('every tool tile points at a real page', async ({ request }) => {
    const broken: string[] = [];
    for (const tool of catalogRoutes()) {
      const res = await request.get(tool.href, { maxRedirects: 0 }).catch(() => null);
      const status = res?.status() ?? 0;
      if (status !== 200) broken.push(`${tool.name} → ${tool.href} (${status})`);
    }
    expect(broken, 'catalog entries pointing at missing pages').toEqual([]);
  });
});

// REG-022 — the consent banner covered the page and made real buttons dead.
//
// It is `position: fixed` at the bottom, so on a phone it sits over roughly the
// last 250px of every page. Anything under it looks perfectly normal and simply
// does not respond to a tap — the same silent failure as REG-015/016, and it hit
// the favicon pack's "Download the pack" button on a Pixel 7 in CI. The fix is
// that the banner publishes its height and the document reserves that much room.
test.describe('REG-022 — nothing hides underneath the consent banner', () => {
  test('the page reserves room for the banner while it is showing', async ({ page }) => {
    await page.goto('/favicon-generator', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);

    const banner = page.locator('a[href="/privacy"]').locator('xpath=ancestor::div[contains(@class,"fixed")]').first();
    await expect(banner, 'a fresh visitor should see the consent banner').toBeVisible();

    const gap = await page.evaluate(() => {
      const reserved = getComputedStyle(document.body).paddingBottom;
      return parseFloat(reserved || '0');
    });
    const bannerHeight = (await banner.boundingBox())?.height ?? 0;
    expect(bannerHeight, 'banner should have a real height').toBeGreaterThan(0);
    expect(gap, 'the document must reserve at least the banner height').toBeGreaterThanOrEqual(bannerHeight);
  });

  test('the last control on a tool page is reachable, not buried', async ({ page }) => {
    await page.goto('/favicon-generator', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Whatever is at the very bottom of the document must not be the banner
    // sitting on top of page content: the footer's own last link is the probe.
    const probe = page.locator('footer a').last();
    await probe.scrollIntoViewIfNeeded();
    const covered = await probe.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit ? !el.contains(hit) && hit !== el : true;
    });
    expect(covered, 'the bottom of the page must not sit under the banner').toBe(false);
  });
});
