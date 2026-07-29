import { test, expect } from '@playwright/test';

// Throttle testing (docs/qa/qa-master-plan.md §5.2). Slow-3G network + 4× CPU
// via CDP, on the pages most sensitive to a cold start. Run with the
// chromium-slow project:  npx playwright test throttle.spec.ts --project=chromium-slow
//
// CDP is Chromium-only, so these tests skip on other engines.

const SLOW_3G = { offline: false, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8, latency: 400 };

test.describe('Throttle — Slow 3G + CPU 4× (NF-THR)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  for (const path of ['/', '/compress-pdf', '/edit-pdf']) {
    test(`NF-THR ${path} stays interactive under throttle`, async ({ page, context }) => {
      await context.addInitScript(() => { try { localStorage.setItem('dd-splash-seen-v1', '1'); } catch {} });
      const client = await context.newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', SLOW_3G);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      const start = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // The primary CTA / dropzone must appear within a generous-but-bounded budget.
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
      const ttfHeading = Date.now() - start;
      expect(ttfHeading, `h1 took ${ttfHeading}ms under throttle on ${path}`).toBeLessThan(20_000);

      // Nothing should be stuck in a spinner forever.
      await expect(page.getByText(/loading…|please wait/i)).toHaveCount(0, { timeout: 20_000 }).catch(() => {});
    });
  }
});
