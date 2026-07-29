import { test, expect } from '@playwright/test';

// Data-driven cross-cutting pass (docs/qa/test-catalog.md Part 1) over a
// representative sample of every archetype. Phase 2 expands ROUTES to the full
// 128 by generating it from app/sitemap.ts. Each row asserts the XC-* basics.

const ROUTES: { path: string; arch: string }[] = [
  { path: '/', arch: 'home' },
  { path: '/tools', arch: 'directory' },
  { path: '/compress-pdf', arch: 'client-tool' },
  { path: '/merge-pdf', arch: 'client-tool' },
  { path: '/pdf-to-excel', arch: 'client-tool' },
  { path: '/word-to-pdf', arch: 'server-tool' },
  { path: '/base64', arch: 'micro-utility' },
  { path: '/json-formatter', arch: 'micro-utility' },
  { path: '/qr-code-generator', arch: 'micro-utility' },
  { path: '/passport-photo', arch: 'image-tool' },
  { path: '/why-diemdesk', arch: 'landing' },
  { path: '/compare', arch: 'landing' },
  { path: '/smallpdf-alternative', arch: 'landing' },
  { path: '/privacy', arch: 'legal' },
  { path: '/pricing', arch: 'info' },
  { path: '/login', arch: 'auth' },
];

for (const { path, arch } of ROUTES) {
  test.describe(`XC ${path} [${arch}]`, () => {
    test('XC-001 loads with an h1, no error boundary', async ({ page }) => {
      const res = await page.goto(path);
      expect(res!.status()).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    });

    test('XC-002 no console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(errors, errors.join('\n')).toHaveLength(0);
    });

    test('XC-003 SEO meta present & within limits', async ({ page }) => {
      await page.goto(path);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(65);
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      if (desc) expect(desc.length).toBeLessThanOrEqual(160);
    });

    test('XC-005 no horizontal scroll at 375 and 1280', async ({ page }) => {
      for (const w of [375, 1280]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(overflow, `horizontal scroll at ${w}px on ${path}`).toBeFalsy();
      }
    });
  });
}
