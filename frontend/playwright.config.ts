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
  // Generous on purpose: these journeys run real engines (pdf.js, WASM, canvas)
  // on a cold cache, and a laptop mid-build is slower than CI.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One worker locally — several headless Chromes each decoding a PDF is what
  // turns a real pass into a flaky one on a developer machine.
  workers: process.env.CI ? 2 : 1,
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
    // Edge is Chromium underneath but ships its own build, and a real slice of
    // Windows users never leave it — worth proving rather than assuming.
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    // Throttled project for tests/e2e/throttle.spec.ts (Slow-3G + CPU 4×, applied in-test via CDP).
    { name: 'chromium-slow', use: { ...devices['Desktop Chrome'] } },
  ],
  // CI builds then serves the prod bundle; locally reuse an already-running :3100.
  //
  // ⚠ `reuseExistingServer` will happily reuse a server started from an OLDER
  // build — `next start` serves whatever .next held when it booted, so a rebuild
  // does not reach it. If a fix "doesn't take", kill the process on :3100 and
  // rerun; set E2E_FRESH_SERVER=1 to force a new one.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run start -- -p ' + PORT,
        url: BASE,
        reuseExistingServer: !process.env.CI && !process.env.E2E_FRESH_SERVER,
        timeout: 120_000,
      },
});
