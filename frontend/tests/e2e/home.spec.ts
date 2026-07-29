import { test, expect } from '@playwright/test';

// Home page — including the regressions the owner raised (see
// docs/qa/regression-issues.md REG-001..005). These fail on the OLD behaviour.

const SEEN = 'dd-splash-seen-v1';

test.describe('First-visit splash (REG-001/002/003)', () => {
  test('SPLASH-001: overlay is in the home HTML so it covers from the first paint', async ({ page }) => {
    // A genuine first-timer: the server HTML itself must contain the overlay,
    // otherwise home paints first and we get the home→splash→home flash.
    const res = await page.goto('/');
    const html = (await res!.text());
    expect(html).toContain('id="dd-first-splash"');
    expect(html).toContain("classList.add('dd-splash-seen')"); // pre-paint guard
  });

  test('SPLASH-001b: overlay is NOT present on a tool page (home only)', async ({ page }) => {
    const res = await page.goto('/compress-pdf');
    expect(await res!.text()).not.toContain('id="dd-first-splash"');
  });

  test('SPLASH-002: first-timer sees it, then it lifts; a key skips it', async ({ page, context }) => {
    await context.addInitScript((k) => { try { localStorage.removeItem(k); } catch {} }, SEEN);
    await page.goto('/');
    const overlay = page.locator('#dd-first-splash');
    await expect(overlay).toBeVisible();
    await expect(page.getByText('Your files stay yours.')).toBeVisible();
    await page.keyboard.press('Escape');            // skip
    await expect(overlay).toBeHidden({ timeout: 2000 });
    expect(await page.evaluate((k) => localStorage.getItem(k), SEEN)).toBe('1');
  });

  test('SPLASH-003: returning visitor never sees it', async ({ page, context }) => {
    await context.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch {} }, SEEN);
    await page.goto('/');
    // Guard class hides it pre-paint; React unmounts it. Either way: never visible.
    await expect(page.locator('#dd-first-splash')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('SPLASH-003b: reduced-motion visitor never sees it', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch {} }, SEEN);
    await page.goto('/');
    await expect(page.locator('#dd-first-splash')).toBeHidden();
    await ctx.close();
  });
});

test.describe('Mobile home tweaks (REG-004/005)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('HOME-M-001: trust chips are centered on mobile', async ({ page, context }) => {
    await context.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch {} }, SEEN); // skip splash
    await page.goto('/');
    const chip = page.getByText('No file uploads', { exact: false }).first();
    const row = chip.locator('xpath=..');
    await expect(row).toHaveCSS('justify-content', 'center');
  });

  test('HOME-M-002: no "+N more" tile on mobile', async ({ page, context }) => {
    await context.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch {} }, SEEN);
    await page.goto('/');
    const more = page.getByRole('button', { name: /\+\s*\d+\s*more/ });
    await expect(more.first()).toBeHidden();
  });
});

test.describe('Home basics', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch {} }, SEEN);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('hero + primary CTA present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /start free|pick a tool|choose a pdf/i }).first()).toBeVisible();
  });
});
