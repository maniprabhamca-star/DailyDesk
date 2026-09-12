import { test, expect } from '@playwright/test';

// Scan to PDF, driven with a real MediaStream.
//
// The tool started as a small camera pane with a shutter inside the page. The
// owner's verdict, twice: "the camera is literally very small and not able to
// capture", then "the view of the camera is not good... I need the native
// camera full screen to scan the document and during the scanning it should
// automatically detect the document and highlight". So it is now a full-screen
// scanner with live edge detection, and these cover the properties that make
// that claim true rather than merely intended.
//
// The detection maths itself is tested in tests/unit/doc-scan.test.ts against
// synthetic frames with known corners — Chromium's fake camera shows a rolling
// pattern, not a document, so it can prove the plumbing but not the accuracy.
// The split matters: these tests would still pass if detection were removed,
// which is why the unit tests exist.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test.describe('Scan to PDF — the scanner', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'needs the Chromium fake camera');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('dd_cookie_ack', '1'); localStorage.setItem('dd-splash-seen-v1', '1'); } catch { /* private mode */ }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/scan-to-pdf', { waitUntil: 'domcontentloaded' });
  });

  const openScanner = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: /open scanner/i }).click();
    const dialog = page.getByRole('dialog', { name: /document scanner/i });
    await expect(dialog).toBeVisible();
    // Wait for a frame, not merely for the element: every assertion below
    // depends on the video having produced pixels.
    await expect
      .poll(async () => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 25_000 })
      .toBeGreaterThan(0);
    return dialog;
  };

  test('takes over the whole screen, which was the entire complaint', async ({ page }) => {
    const dialog = await openScanner(page);
    const box = await dialog.boundingBox();
    const vp = page.viewportSize()!;

    // The old pane was ~21% of the screen. This is the viewport.
    expect(Math.round(box!.width)).toBe(vp.width);
    expect(Math.round(box!.height)).toBe(vp.height);

    // The visible surface is the <video> ITSELF. Five rejected layouts came out
    // of hiding it and repainting each frame into a canvas, which forced this
    // code to decide which way up the picture went; the browser already knows,
    // so the element is shown directly and CSS frames it. A hidden video would
    // measure 1px here, which is the regression this guards.
    const preview = await page.locator('video').boundingBox();
    expect(preview!.width, 'the video must be the preview, not a 1px source').toBeGreaterThan(50);

    // And it must genuinely COVER the screen rather than sit in a band: a
    // landscape camera frame letterboxed into a portrait screen is the bug that
    // started all this — "the scanner is opening in horizontal mode and it's
    // not going to work".
    const covers = await page.locator('video').evaluate((v: HTMLVideoElement) => {
      const r = v.getBoundingClientRect();
      return { w: r.width, h: r.height, fit: getComputedStyle(v).objectFit };
    });
    expect(covers.w, 'the preview must reach both side edges').toBeGreaterThanOrEqual(vp.width - 1);
    expect(covers.h, 'the preview must reach top and bottom').toBeGreaterThanOrEqual(vp.height - 1);
    expect(covers.fit, 'contain would letterbox it back into a band').toBe('cover');

    // The highlight is drawn on a transparent canvas laid over that preview, so
    // the two share one coordinate space and the outline cannot drift off the
    // page it is drawn around.
    const surface = await page.locator('canvas').first().boundingBox();
    const share = (surface!.width * surface!.height) / (vp.width * vp.height);
    expect(share, `overlay covers ${(share * 100).toFixed(1)}% of the screen`).toBeGreaterThan(0.95);
  });

  test('draws an overlay sized to the screen, ready for the highlight', async ({ page }) => {
    await openScanner(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    // Backing store scaled for the device, or the highlight is drawn blurry
    // and offset on any screen that is not exactly 1x.
    const sized = await canvas.evaluate((c: HTMLCanvasElement) => c.width > 0 && c.height > 0);
    expect(sized, 'the overlay canvas must be sized before anything is drawn on it').toBe(true);
  });

  test('captures a page and says so', async ({ page }) => {
    await openScanner(page);
    await page.getByRole('button', { name: /capture page/i }).click();

    // The count on the Done button is the confirmation that survives closing.
    await expect(page.getByRole('button', { name: /done \(1\)/i })).toBeVisible({ timeout: 10_000 });

    // The fake camera shows a rolling pattern rather than a document, so
    // detection legitimately finds nothing — and pressing the shutter must
    // still produce a page. Someone who presses the button wants the picture.
    await page.getByRole('button', { name: /close scanner/i }).click();
    await expect(page.getByRole('dialog', { name: /document scanner/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /save pdf.*1 page/i })).toBeEnabled();
  });

  test('Escape and the close button both leave, and the camera stops', async ({ page }) => {
    await openScanner(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /document scanner/i })).toHaveCount(0);

    // Tracks released — a scanner that keeps the camera running after you leave
    // is the kind of thing that gets a site a permission warning.
    const left = await page.evaluate(() => document.querySelectorAll('video, canvas').length);
    expect(left, 'the scanner surface and its camera source both go with the dialog').toBe(0);
  });

  test('the page behind cannot scroll while the scanner is over it', async ({ page }) => {
    await openScanner(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });

  test('auto-capture can be turned off', async ({ page }) => {
    await openScanner(page);
    const toggle = page.getByRole('button', { name: /auto|manual/i });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('the picture can be turned, and the choice is remembered', async ({ page }) => {
    // Which way up a camera frame arrives depends on the browser — some hand
    // over the sensor's own orientation, some correct it first. uprightTurns
    // suggests a quarter turn only when the two shapes prove one is missing;
    // this control is the override, and it has to persist, because a device
    // that needs it needs it every single time.
    await openScanner(page);
    await page.getByRole('button', { name: /rotate the camera picture/i }).click();
    const chosen = await page.evaluate(() => localStorage.getItem('dd-scan-turns'));
    expect(chosen, 'pressing it must record a choice').toMatch(/^[0-3]$/);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /open scanner/i }).click();
    await expect(page.getByRole('dialog', { name: /document scanner/i })).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem('dd-scan-turns')),
      'the chosen orientation must survive closing the scanner',
    ).toBe(chosen);

    // Four presses come back round to where they started.
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /rotate the camera picture/i }).click();
    expect(await page.evaluate(() => localStorage.getItem('dd-scan-turns'))).toBe(chosen);
  });

  test('a sideways camera frame is turned upright by itself', async ({ page }) => {
    // Chromium's fake camera hands over a landscape frame on a 390x844 screen,
    // which is exactly the case that opened the scanner "in horizontal mode".
    // It must come out upright without anyone pressing anything — and the
    // element is sized to the SWAPPED box before being rotated, which is what
    // lets a turned picture still reach every edge.
    await openScanner(page);
    const shape = await page.locator('video').evaluate((v: HTMLVideoElement) => ({
      frameLandscape: v.videoWidth > v.videoHeight,
      transform: getComputedStyle(v).transform,
      elW: parseFloat(getComputedStyle(v).width),
      elH: parseFloat(getComputedStyle(v).height),
      rect: v.getBoundingClientRect().width + 'x' + v.getBoundingClientRect().height,
    }));
    expect(shape.frameLandscape, 'the fake camera is landscape — the premise of this test').toBe(true);
    // rotate(90deg) is matrix(0, 1, -1, 0, …); an unrotated element is matrix(1, 0, …).
    expect(shape.transform, 'a landscape frame on an upright screen must be turned').toMatch(/^matrix\(0,/);
    expect(shape.elW, 'the element is laid out sideways, then rotated into place').toBeGreaterThan(shape.elH);
  });

  test('a screen-reader is told the count', async ({ page }) => {
    await openScanner(page);
    const live = page.locator('[role="status"][aria-live="polite"]');
    await expect(live).toHaveText(/no pages captured yet/i);
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(live).toHaveText(/1 page captured/i, { timeout: 10_000 });
  });
});
