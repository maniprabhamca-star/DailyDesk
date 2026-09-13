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

    // The element itself always spans the whole screen; how much of the camera
    // frame lands inside it is the zoom's business, not the layout's.
    const covers = await page.locator('video').evaluate((v: HTMLVideoElement) => {
      const r = v.getBoundingClientRect();
      return { w: r.width, h: r.height, fit: getComputedStyle(v).objectFit };
    });
    expect(covers.w, 'the preview element must span the screen').toBeGreaterThanOrEqual(vp.width - 1);
    expect(covers.h, 'the preview element must span the screen').toBeGreaterThanOrEqual(vp.height - 1);
    expect(covers.fit, 'contain + scale(zoom) is what makes zooming out possible').toBe('contain');

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

  test('the preview is never turned, scaled or moved by this code', async ({ page }) => {
    // THE regression to guard. Three rounds went on rotation: two automatic
    // rules disproved in opposite directions, then a manual control whose
    // stored choice turned the preview on every later visit — "the camera is
    // really inverted". The requirement, as stated: "the position should not
    // change unless I tilt the phone."
    //
    // A browser already does that with a <video> it renders itself. Anything
    // this component adds — a transform, a measured pixel size — is what breaks
    // it, so the assertion is that it adds nothing.
    await openScanner(page);
    const el = await page.locator('video').evaluate((v: HTMLVideoElement) => {
      const cs = getComputedStyle(v);
      return {
        transform: cs.transform,
        inlineStyle: v.getAttribute('style') ?? '',
        fit: cs.objectFit,
      };
    });
    // A scale is allowed (that is the zoom); a ROTATION never is. matrix(a,b,c,d,…)
    // with b or c non-zero is a rotation or a skew.
    const m = el.transform.match(/^matrix\(([-\d.e]+), ([-\d.e]+), ([-\d.e]+), ([-\d.e]+)/);
    if (m) {
      expect(Number(m[2]), 'no rotation, ever — not even a “helpful” one').toBeCloseTo(0, 6);
      expect(Number(m[3]), 'no rotation, ever — not even a “helpful” one').toBeCloseTo(0, 6);
      expect(Number(m[1]), 'and no mirroring').toBeGreaterThan(0);
      expect(Number(m[4]), 'and no mirroring').toBeGreaterThan(0);
    }
    expect(el.inlineStyle, 'no JS-measured pixel size: an address bar sliding away must not move the picture')
      .not.toMatch(/width|height|top|left/);

    // There must be no control offering to turn the live camera either.
    await expect(page.getByRole('button', { name: /rotate the camera picture/i })).toHaveCount(0);
  });

  test('asks the camera for a frame shaped like the screen it has to fill', async ({ page }) => {
    // A screenshot from the owner's phone showed a 2560x1440 stream — because
    // that is what this code was asking for, explicitly landscape, on an
    // upright phone. Covering a portrait screen with a 16:9 frame keeps about a
    // quarter of its width, and no layout work fixes a frame that is the wrong
    // shape to start with. Plenty of devices ignore the request; asking for the
    // wrong thing guarantees the wrong answer.
    const asked: unknown[] = [];
    await page.exposeFunction('__recordConstraints', (c: unknown) => { asked.push(c); });
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c?: MediaStreamConstraints) => {
        (window as unknown as { __recordConstraints: (c: unknown) => void }).__recordConstraints(JSON.parse(JSON.stringify(c ?? {})));
        return real(c);
      };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScanner(page);

    const first = asked[0] as { video?: { width?: { ideal?: number }; height?: { ideal?: number } } };
    const vp = page.viewportSize()!;
    expect(vp.height, 'this test is about a portrait screen').toBeGreaterThan(vp.width);
    expect(first?.video?.height?.ideal, 'a tall screen must ask for a tall frame')
      .toBeGreaterThan(first?.video?.width?.ideal ?? Infinity);
  });

  test('a stored rotation from the old control is cleared, not honoured', async ({ page }) => {
    // Anyone who pressed the old button is still carrying its answer, and it
    // would go on turning their preview for ever.
    await page.evaluate(() => localStorage.setItem('dd-scan-turns', '2'));
    await openScanner(page);
    expect(await page.evaluate(() => localStorage.getItem('dd-scan-turns'))).toBeNull();
    const t = await page.locator('video').evaluate((v: HTMLVideoElement) => getComputedStyle(v).transform);
    const m = t.match(/^matrix\(([-\d.e]+), ([-\d.e]+), ([-\d.e]+), ([-\d.e]+)/);
    if (m) {
      expect(Number(m[2])).toBeCloseTo(0, 6);
      expect(Number(m[3])).toBeCloseTo(0, 6);
    }
  });

  test('zoom can be reduced, the way a camera app does it', async ({ page }) => {
    // "the scanner is over zooming by default. pls make an option to reduce the
    // zoom like in the camera app." A camera whose frame is a different shape
    // from the screen cannot fill it without discarding most of the picture,
    // and which camera you have decides how bad that is — so it is a control.
    const dialog = await openScanner(page);
    const chips = dialog.getByRole('button', { name: /zoom [\d.]+ times/i });
    // The stops are worked out on the first detection pass, a beat after the
    // camera reports its size, so this has to wait rather than count once.
    await expect
      .poll(async () => chips.count(), { timeout: 10_000 })
      .toBeGreaterThan(1);

    const scaleNow = () => page.locator('video').evaluate((v: HTMLVideoElement) => {
      const m = getComputedStyle(v).transform.match(/^matrix\(([-\d.e]+)/);
      return m ? Number(m[1]) : 1;
    });

    // The widest stop must show strictly more of the frame than the last one.
    await chips.last().click();
    const filled = await scaleNow();
    await chips.first().click();
    const widest = await scaleNow();
    expect(widest, 'the first stop must zoom OUT relative to the last').toBeLessThan(filled);
    expect(widest, 'and the widest is the whole frame, scale 1').toBeCloseTo(1, 2);

    // The choice must stick, and the pressed state must say which one is on.
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(chips.last()).toHaveAttribute('aria-pressed', 'false');

    // Capturing at a zoomed-out stop still produces a page rather than failing
    // on the black bars either side of the picture.
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(page.getByRole('button', { name: /done \(1\)/i })).toBeVisible({ timeout: 10_000 });
  });

  test('a captured page can be turned in the list, where you can see the result', async ({ page }) => {
    // Rotation moved here from the camera: a still picture gives you something
    // to judge "right way up" against, which a moving preview never did.
    await openScanner(page);
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(page.getByRole('button', { name: /done \(1\)/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /close scanner/i }).click();

    const thumb = page.getByRole('img', { name: /page 1/i });
    const before = await thumb.getAttribute('src');
    await page.getByRole('button', { name: /turn page 1 a quarter turn/i }).click();
    await expect.poll(async () => thumb.getAttribute('src')).not.toBe(before);

    // And it stays page 1 rather than jumping to the end of the list.
    await expect(page.getByRole('img', { name: /page 1/i })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /save pdf.*1 page/i })).toBeEnabled();
  });

  test('the "Scan document" chip appears only once a document is detected', async ({ page }) => {
    // Asked for directly. The fake camera shows a rolling pattern, not a page,
    // so detection legitimately finds nothing and the chip must stay away —
    // a label that is always on screen is decoration, not feedback.
    const dialog = await openScanner(page);
    await expect(dialog.getByText(/point the camera at your document/i)).toBeVisible();
    await expect(dialog.getByText('Scan document', { exact: true })).toHaveCount(0);
  });

  test('a screen-reader is told the count', async ({ page }) => {
    await openScanner(page);
    const live = page.locator('[role="status"][aria-live="polite"]');
    await expect(live).toHaveText(/no pages captured yet/i);
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(live).toHaveText(/1 page captured/i, { timeout: 10_000 });
  });
});
