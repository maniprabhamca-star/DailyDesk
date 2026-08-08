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

test.describe('the Tools menu shows everything at once', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('dd_cookie_ack', '1');
        localStorage.setItem('dd_splash_seen', '1');
      } catch { /* private mode */ }
    });
  });

  for (const { w, h } of SIZES) {
    test(`at ${w}×${h}: full width, no inner scrollbar, aligned to the logo`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /^tools$/i }).click();

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

    await page.getByRole('button', { name: /^tools$/i }).click();
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: /close the tools menu/i }).click();
    await expect(panel).toBeHidden();

    await page.getByRole('button', { name: /^tools$/i }).click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('clicking a tool inside the panel navigates rather than closing it dead', async ({ page }) => {
    // The panel is no longer a child of the button's wrapper, so a naive
    // outside-click check would swallow the click on the way to the link.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^tools$/i }).click();
    await page.locator('#dd-tools-menu').getByRole('link', { name: /^Merge PDF$/ }).click();
    await expect(page).toHaveURL(/\/merge-pdf$/);
  });
});
