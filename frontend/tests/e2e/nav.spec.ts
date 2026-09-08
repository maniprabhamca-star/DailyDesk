import { test, expect } from '@playwright/test';

// The Tools mega-menu. It used to be a 920px dropdown anchored under the button:
// the whole catalogue crammed into four narrow columns behind an inner
// scrollbar, so you had to scroll a *menu* to find out what the product does.
// It is now full-bleed, and these guard the three properties that make it
// worth the change — anything less and it quietly regresses to a dropdown.
const SIZES = [
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

/**
 * Open the mega-menu: wait for hydration, then click once.
 *
 * The history is worth keeping, because the fix twice made things worse. These
 * tests originally clicked once and assumed, and passed for a bad reason — the
 * first-visit splash was playing over the page, so Playwright waited for the
 * overlay to lift before the button became actionable, roughly two seconds,
 * which happened to be long enough for React to hydrate. Fixing the splash
 * removed that accidental pause and the click started landing on a button whose
 * handler was not attached yet.
 *
 * The next version wrapped the click in `toPass`, on the reasoning that a click
 * which DID register makes the assertion pass so no retry happens. That is only
 * true when the first click works. This button is a TOGGLE, so once a click does
 * register late, every retry flips it back — open, closed, open — and whether
 * the run passes depends on which phase the assertion happens to sample. It held
 * on a quiet machine and fell over inside a 974-test run, which is the signature
 * of a race, not of a broken menu. Verified: the three failures reproduce only in
 * the full suite, and all ten specs pass on their own.
 *
 * Never retry a toggle. `window.__ddHydrated` is set by the file-picker rescue
 * once React owns the page — the marker the previous comment said did not exist —
 * so wait for the real condition and click exactly once.
 */
async function openToolsMenu(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => (window as unknown as { __ddHydrated?: boolean }).__ddHydrated === true,
    null,
    { timeout: 30_000 },
  );
  const button = page.getByRole('button', { name: /^tools$/i });
  const panel = page.locator('#dd-tools-menu');
  await button.click();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  return panel;
}

test.describe('the Tools menu shows everything at once', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('dd_cookie_ack', '1');
        localStorage.setItem('dd-splash-seen-v1', '1');
      } catch { /* private mode */ }
    });
  });

  for (const { w, h } of SIZES) {
    test(`at ${w}×${h}: full width, no inner scrollbar, aligned to the logo`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await openToolsMenu(page);

      const m = await page.evaluate(() => {
        const sc = document.querySelector('#dd-tools-menu') as HTMLElement;
        const cols = sc.querySelector('[class*="columns-"]') as HTMLElement;
        const firstGroup = cols.firstElementChild as HTMLElement;
        const logo = document.querySelector('header a[href="/"]') as HTMLElement;
        return {
          panelW: Math.round(sc.getBoundingClientRect().width),
          overflow: sc.scrollHeight - sc.clientHeight,
          groupLeft: Math.round(firstGroup.getBoundingClientRect().left),
          logoLeft: Math.round(logo.getBoundingClientRect().left),
        };
      });

      expect(m.panelW, 'the panel must span the viewport').toBe(w);
      // The point of going full-bleed was to stop making people scroll a menu.
      expect(m.overflow, `menu scrolls by ${m.overflow}px — it no longer fits`).toBeLessThanOrEqual(1);
      // Content lines up under the logo rather than starting at the raw edge.
      expect(m.groupLeft, 'first column should align with the logo').toBe(m.logoLeft);
    });
  }

  test('the X closes it, and so does Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('#dd-tools-menu');

    await openToolsMenu(page);
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: /close the tools menu/i }).click();
    await expect(panel).toBeHidden();

    await openToolsMenu(page);
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('clicking a tool inside the panel navigates rather than closing it dead', async ({ page }) => {
    // The panel is no longer a child of the button's wrapper, so a naive
    // outside-click check would swallow the click on the way to the link.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openToolsMenu(page);
    await page.locator('#dd-tools-menu').getByRole('link', { name: /^Merge PDF$/ }).click();
    await expect(page).toHaveURL(/\/merge-pdf$/);
  });
});

// The sector pages answer "which of these 102 tools are mine?" — the first
// version didn't, and sent the reader to the whole catalogue instead. These
// guard the answer, and the fact that a curated list of names silently drops
// any entry that stops matching the catalogue.
const SECTOR_SLUGS = ['legal', 'accountants', 'healthcare', 'schools'];

test.describe('sector pages point at a real, specific toolkit', () => {
  for (const slug of SECTOR_SLUGS) {
    test(`/for/${slug} lists its toolkit and every entry opens`, async ({ page, request }) => {
      await page.goto(`/for/${slug}`, { waitUntil: 'domcontentloaded' });
      const toolkit = page.locator('section', { has: page.getByRole('heading', { name: 'Your toolkit' }) });
      await expect(toolkit).toBeVisible();

      // The curated list drops names that no longer match the catalogue, so a
      // short list is the symptom of drift. Twelve are declared per sector.
      const entries = toolkit.locator('a, div.cursor-default').filter({ hasNot: page.locator('section') });
      const count = await toolkit.locator('> div > *').count();
      expect(count, 'toolkit entries lost to a renamed catalogue tool').toBe(12);

      // Every linked tool must be a real page, not a 404 left by a rename.
      const hrefs = await toolkit.locator('a[href^="/"]').evaluateAll(
        (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!),
      );
      expect(hrefs.length, 'no live tools linked').toBeGreaterThan(0);
      for (const href of hrefs) {
        const res = await request.get(href, { maxRedirects: 0 });
        expect(res.status(), `${href} is linked from /for/${slug} but does not resolve`).toBe(200);
      }
      void entries;
    });
  }

  test('the main CTA opens a tool, not the whole catalogue', async ({ page }) => {
    await page.goto('/for/legal', { waitUntil: 'domcontentloaded' });
    // Highest-intent action for this reader, not a shrug at /#tools.
    await page.getByRole('link', { name: /start redacting/i }).click();
    await expect(page).toHaveURL(/\/redact-pdf$/);
  });
});
