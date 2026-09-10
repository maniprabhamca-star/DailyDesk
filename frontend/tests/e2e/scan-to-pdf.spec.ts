import { test, expect } from '@playwright/test';

// Scan to PDF, driven with a real MediaStream.
//
// Reported by the owner using their own product on a phone: "the camera is
// literally very small and not able to capture", and "once I click the camera
// button, I don't know whether it's processed or not and no clue and then I
// have to manually scroll down to see if it's added anything."
//
// Three separate faults, none of which any existing test could have caught,
// because nothing in the suite had ever opened the camera:
//
//   1. getUserMedia asked for 2560x1440 — a LANDSCAPE frame — unconditionally.
//      A phone held upright to photograph a document got a wide frame squeezed
//      into a narrow column: about 356x200 on a normal phone, a fifth of the
//      screen, with the document a stamp in the middle. No CSS could fix that;
//      the pixels were not there. Now the request is shaped like the screen.
//   2. The preview box was a hard aspect-[4/3] with object-contain, so even a
//      portrait stream would have been letterboxed back down again.
//   3. Capturing changed nothing you could see. The page joined a list below
//      the fold and that was the only evidence, so a successful capture and a
//      dead button looked identical.
//
// Chromium's fake device gives a genuine MediaStream, so getUserMedia,
// videoWidth and the whole capture path run for real. `--use-fake-ui-for-media-
// stream` auto-accepts the permission prompt.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

// Chromium only: firefox and webkit have no equivalent fake-camera switch, and
// a test that silently does nothing on three of five browsers is worse than one
// that says where it runs.
test.describe('Scan to PDF — the camera is usable', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'needs the Chromium fake camera');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('dd_cookie_ack', '1'); localStorage.setItem('dd-splash-seen-v1', '1'); } catch { /* private mode */ }
    });
  });

  test('the viewfinder is worth pointing at, not a strip', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // an ordinary phone
    await page.goto('/scan-to-pdf', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /use camera/i }).click();

    const video = page.locator('video');
    await expect(video).toBeVisible();
    // Wait for a frame to actually arrive, not just for the element to exist.
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);

    const box = await video.boundingBox();
    const vp = page.viewportSize()!;
    const share = (box!.width * box!.height) / (vp.width * vp.height);

    // Before the fix this was 0.217. The threshold is deliberately well below
    // what it now measures (~0.58): this guards against the strip coming back,
    // not against the layout being tweaked.
    expect(share, `viewfinder is ${Math.round(box!.width)}x${Math.round(box!.height)}, ${(share * 100).toFixed(1)}% of the screen`)
      .toBeGreaterThan(0.4);

    // Taller than it is wide on a portrait screen — the shape of a document.
    expect(box!.height, 'a portrait screen should get a portrait viewfinder').toBeGreaterThan(box!.width);
  });

  test('capturing a page says so without scrolling anywhere', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/scan-to-pdf', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /use camera/i }).click();

    const video = page.locator('video');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);

    const surface = video.locator('..');
    await expect(surface.locator('img'), 'nothing captured yet, so no thumbnail').toHaveCount(0);

    await page.getByRole('button', { name: /capture page/i }).click();

    // The count and the thumbnail both live ON the viewfinder, which is the
    // whole point — the answer to "did that work?" must not be "scroll down".
    await expect(surface.getByText(/^1 page$/)).toBeVisible({ timeout: 10_000 });
    await expect(surface.locator('img'), 'the page just taken should be shown back').toHaveCount(1);

    // And it must be reachable without scrolling: the badge sits inside the
    // viewport the moment it appears.
    const badge = await surface.getByText(/^1 page$/).boundingBox();
    expect(badge!.y + badge!.height, 'the confirmation must be on screen, not below the fold')
      .toBeLessThanOrEqual(page.viewportSize()!.height);

    // A second capture must move the count, not silently replace the first.
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(surface.getByText(/^2 pages$/)).toBeVisible({ timeout: 10_000 });
  });

  test('a screen-reader is told the count, not just shown it', async ({ page }) => {
    await page.goto('/scan-to-pdf', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /use camera/i }).click();
    const video = page.locator('video');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);

    const live = page.locator('[role="status"][aria-live="polite"]');
    await expect(live).toHaveText(/no pages captured yet/i);
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(live).toHaveText(/1 page captured/i, { timeout: 10_000 });
  });
});
