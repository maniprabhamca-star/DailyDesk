import { defineConfig, devices } from '@playwright/test';

// DiemDesk E2E — see docs/qa/qa-master-plan.md.
// Runs against the PRODUCTION build (next start on :3100), the reliable verifier;
// the dev server's service worker caches a stale shell and must not be trusted.
//
// One-time setup:
//   npm i -D @playwright/test @axe-core/playwright
//   npx playwright install --with-deps chromium firefox webkit
// Then: npm run test:e2e

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Start every test with a clean slate so first-visit / gating logic is deterministic.
    storageState: undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Throttled project for tests/e2e/throttle.spec.ts (Slow-3G + CPU 4×, applied in-test via CDP).
    { name: 'chromium-slow', use: { ...devices['Desktop Chrome'] } },
  ],
  // CI builds then serves the prod bundle; locally reuse an already-running :3100.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run start -- -p ' + PORT,
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
