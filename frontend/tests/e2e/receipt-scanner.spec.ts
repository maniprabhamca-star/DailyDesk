import { test, expect } from '@playwright/test';

/**
 * The receipt scanner, in the mode nothing was testing.
 *
 * Every scanner test until now ran /scan-to-pdf — document mode. Receipt mode
 * is the same component with `long` and `single` set, and those two flags
 * change the three things this file is about. Two regressions reached
 * production through that gap in a single day:
 *
 *   · it opened letterboxed, a strip of picture with black above and below,
 *     where the phone's own camera app fills the screen — and small enough in
 *     the detector's input to sit on the area floor, so the outline often
 *     never appeared at all;
 *   · then the shutter fired by itself on half a receipt, because the trigger
 *     never asked whether the subject was fully inside the picture.
 *
 * The arithmetic behind both lives in unit tests (openingZoom,
 * shouldAutoCapture). What those cannot see is the WIRING — whether this
 * route reaches the scanner with the flags that select those behaviours. That
 * is what is checked here, in a real browser.
 *
 * The gate: /receipt-scanner is 'coming_soon', and the public sees a panel
 * instead of the tool. The owner bypass turns on for localhost, which is where
 * these run, so the real tool renders without anything being stubbed.
 */
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test.describe('Receipt scanner — the mode with no coverage', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'needs the Chromium fake camera');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('dd_cookie_ack', '1'); localStorage.setItem('dd-splash-seen-v1', '1'); } catch { /* private mode */ }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/receipt-scanner', { waitUntil: 'domcontentloaded' });
  });

  const openScanner = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: /scan receipt/i }).click();
    const dialog = page.getByRole('dialog', { name: /receipt scanner/i });
    await expect(dialog).toBeVisible();
    // Wait for pixels, not merely for the element: every measurement below
    // needs the frame's real dimensions.
    await expect
      .poll(async () => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 25_000 })
      .toBeGreaterThan(0);
    return dialog;
  };

  /**
   * How much of the screen the PICTURE covers — not the element.
   *
   * The <video> always spans the viewport; `object-fit: contain` decides how
   * much of it is picture and how much is black, and a CSS transform scales
   * that up. So `offsetHeight` and `getBoundingClientRect()` both report a
   * full-height element while the user is looking at a band — measuring
   * either is how you write a test that passes through the bug. This is the
   * same arithmetic the scanner itself uses.
   */
  const pictureFill = (page: import('@playwright/test').Page) =>
    page.locator('video').evaluate((v: HTMLVideoElement) => {
      const cs = getComputedStyle(v);
      const box = v.getBoundingClientRect();
      const m = new DOMMatrixReadOnly(cs.transform);
      const zoom = m.a || 1;                       // the scale the chips apply
      const boxW = v.offsetWidth, boxH = v.offsetHeight;
      const fit = cs.objectFit;
      // Two ways of expressing the same geometry, and the test has to read
      // whichever is in use: `cover` fills by definition, `contain` fills only
      // as far as the scale takes it. Reading one and assuming the other is
      // how a test passes while the screen is wrong.
      const base = fit === 'cover'
        ? Math.max(boxW / v.videoWidth, boxH / v.videoHeight)
        : Math.min(boxW / v.videoWidth, boxH / v.videoHeight);
      const shownH = v.videoHeight * base * zoom;
      const shownW = v.videoWidth * base * zoom;
      return {
        fit,
        heightFill: Math.min(1, shownH / boxH),
        widthFill: Math.min(1, shownW / boxW),
        frameIsLandscape: v.videoWidth >= v.videoHeight,
        elementSpansScreen: box.height > 0,
        zoom,
      };
    });

  test('fills the screen — a receipt does not get a band with black around it', async ({ page }) => {
    await openScanner(page);

    // Measured ONCE, immediately. Polling here would hide the bug this test
    // exists for: a scanner that opens letterboxed and corrects itself a
    // third of a second later has still shown the person a band.
    const fill = await pictureFill(page);
    // The guard the measurement itself depends on: filling is only the right
    // answer while the frame is wider than the screen, which is the case for
    // any phone camera held upright. If the fake device ever hands back a
    // portrait frame this assertion is measuring something else, and should
    // fail loudly rather than quietly agree.
    expect(fill.frameIsLandscape, 'the camera hands back a landscape frame on an upright screen').toBe(true);

    expect(fill.heightFill, `the picture covers ${(fill.heightFill * 100).toFixed(0)}% of the screen's height`)
      .toBeGreaterThan(0.99);
    // Contained in a 390x844 screen, a 4:3 frame is about a third of the
    // height. That is the state this test exists to keep out.
    expect(fill.heightFill, 'letterboxed is the regression, not the baseline').not.toBeLessThan(0.5);

    // ...and it fills WITHOUT a transform. `contain` + scale(fillZoom) shows
    // the same picture, but it forces the <video> onto its own composited
    // layer, and on older Android that layer renders black while the frames
    // decode fine — a blank viewfinder with the green outline drawn over it.
    expect(fill.fit, 'a filled receipt uses object-fit, not a scale').toBe('cover');
    expect(fill.zoom, 'no transform on the video in the default receipt state').toBeCloseTo(1, 3);
  });

  test('opens in Manual, so the shutter is the user’s to press', async ({ page }) => {
    const dialog = await openScanner(page);
    // One receipt is framed by hand and looked at before it is taken. Auto is
    // for a stack of pages, and it firing on its own while someone is still
    // lining the receipt up is what produced "why immediately its judgeing and
    // capturig the half recept".
    await expect(dialog.getByRole('button', { name: /manual|auto/i })).toHaveText(/manual/i);
  });

  test('the shutter is the only thing that fires, and it does fire', async ({ page }) => {
    const dialog = await openScanner(page);

    // Manual means nothing happens on its own. Watch for a few seconds of
    // steady frames FIRST: under the old trigger this window is where the
    // shutter went off by itself, on whatever it had found.
    await page.waitForTimeout(3_000);
    await expect(dialog, 'nothing may be captured until the shutter is pressed').toBeVisible();

    await dialog.getByRole('button', { name: /capture receipt|capture page/i }).click();

    // A receipt is one shot: the scanner closes and hands the picture to the
    // reader. That handoff is as far as a browser test can follow it — the
    // reader is server-side and there is no server here, so the tool lands on
    // either the review step or a plainly-worded failure to reach it. Both
    // prove the manual path is wired; only an open scanner would mean it is
    // not.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(
      page.getByText(/check the details|could not reach the scanner|could not scan|pro feature|please sign in/i).first(),
      'the capture must reach the reader, or say why it could not',
    ).toBeVisible({ timeout: 20_000 });
  });

  test('the safe preview actually paints, for a phone whose video renders black', async ({ page }) => {
    // One device (a OnePlus 5T) shows a blank viewfinder with the green
    // outline drawn over it. The outline is the proof that frames are
    // arriving: it comes from a canvas reading them through drawImage. So
    // canvas works there and video does not, and this is the way out.
    //
    // The only assertion worth making is that it PAINTS. A fallback that
    // renders its own black rectangle would satisfy every structural check
    // and help nobody, so this reads the pixels.
    const dialog = await openScanner(page);

    const offer = dialog.getByRole('button', { name: /picture not showing/i });
    await expect(offer, 'a device that has never answered must be offered the way out').toBeVisible();
    await offer.click();

    // The <video> stays — it is still where every frame comes from — but it
    // stops being what anyone looks at. `opacity-0` rather than `hidden`,
    // because a display:none video is entitled to stop decoding.
    await expect(page.locator('video')).toHaveClass(/opacity-0/);

    const canvas = page.locator('[data-preview-canvas]');
    await expect(canvas).toBeAttached();

    // Painting happens on animation frames, so poll rather than look once.
    const painted = await expect.poll(async () => canvas.evaluate((c: HTMLCanvasElement) => {
      if (!c.width || !c.height) return 0;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      // A grid of samples across the whole surface: enough to tell a picture
      // from an empty rectangle without reading a megapixel back every poll.
      const seen = new Set<string>();
      for (let y = 1; y < 8; y++) {
        for (let x = 1; x < 8; x++) {
          const px = ctx.getImageData(Math.floor(c.width * x / 8), Math.floor(c.height * y / 8), 1, 1).data;
          if (px[3] > 0) seen.add(`${px[0]},${px[1]},${px[2]}`);
        }
      }
      return seen.size;      // 0 = nothing drawn, 1 = a flat fill, >1 = a picture
    }), 'the fallback has to put a PICTURE on screen, not a rectangle')
      .toBeGreaterThan(1)
      .then(() => canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height })));

    // And it must be sized for the device, or the picture is a blurry upscale.
    expect(painted.w, 'the backing store is sized for the screen').toBeGreaterThan(300);
    expect(painted.h).toBeGreaterThan(600);

    // The choice sticks, so that phone is not asked again every time.
    const stored = await page.evaluate(() => localStorage.getItem('dd-scanner-preview'));
    expect(stored).toBe('canvas');
  });

  test('a device that has answered is not asked again', async ({ page }) => {
    // The offer is a one-time thing per device. Asking every time would be
    // its own small bug — a line of text over the viewfinder, for ever, on
    // every phone that ever saw it.
    const dialog = await openScanner(page);
    await dialog.getByRole('button', { name: /picture not showing/i }).click();
    await expect(page.evaluate(() => localStorage.getItem('dd-scanner-preview'))).resolves.toBe('canvas');

    // Close and reopen: same device, question already answered.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    const again = await openScanner(page);
    await expect(again.getByRole('button', { name: /picture not showing/i })).toBeHidden();
    // And the choice is still in force.
    await expect(page.locator('[data-preview-canvas]')).toBeAttached();
  });

  test('document mode is NOT changed by any of this', async ({ page }) => {
    // The split is the point: a receipt is a strip with empty table either
    // side, so filling costs it nothing; a page is 0.71 wide against the 0.46
    // a filled 4:3 frame leaves, so filling would cut its sides off. If this
    // ever starts filling too, pages are being cropped.
    await page.goto('/scan-to-pdf', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /open scanner/i }).click();
    await expect(page.getByRole('dialog', { name: /document scanner/i })).toBeVisible();
    await expect
      .poll(async () => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 25_000 })
      .toBeGreaterThan(0);

    const fill = await pictureFill(page);
    expect(fill.heightFill, 'a page keeps the whole frame, band and all').toBeLessThan(0.9);
    const dialog = page.getByRole('dialog', { name: /document scanner/i });
    await expect(dialog.getByRole('button', { name: /manual|auto/i }), 'a stack of pages still auto-captures').toHaveText(/auto/i);
  });
});
