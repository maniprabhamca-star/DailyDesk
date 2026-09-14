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

  test('turning the phone re-frames the scanner instead of staying portrait', async ({ page }) => {
    // "if i tilt the phone horizontally the scanner is not turning up" — the
    // zoom range was worked out once, on the shape the screen had when the
    // scanner opened, and then frozen. Turning the phone changes that shape
    // completely: a 16:9 camera needs ~3.8x to fill an upright screen and ~1.2x
    // to fill the same screen on its side, so the old range and the old chosen
    // stop are both meaningless afterwards.
    const dialog = await openScanner(page);
    const chips = dialog.getByRole('button', { name: /zoom [\d.]+ times/i });
    await expect.poll(async () => chips.count(), { timeout: 10_000 }).toBeGreaterThan(0);
    const portraitStops = await chips.allInnerTexts();

    // Watch what the camera track is asked for. The layout turning is not the
    // fix and never was: the scanner's controls moved to the sides of a
    // landscape screen while the camera went on shooting the TALL frame it was
    // asked for at open, and a 9:16 picture in a 16:9 screen is a strip down
    // the middle — reported as "the scanner is still in vertical".
    await page.evaluate(() => {
      const w = window as unknown as { __applied: unknown[] };
      w.__applied = [];
      const proto = MediaStreamTrack.prototype as unknown as {
        applyConstraints: (c?: MediaTrackConstraints) => Promise<void>;
      };
      const real = proto.applyConstraints;
      proto.applyConstraints = function (c?: MediaTrackConstraints) {
        w.__applied.push(JSON.parse(JSON.stringify(c ?? {})));
        return real.call(this, c);
      };
    });

    // Turn the phone.
    await page.setViewportSize({ width: 844, height: 390 });

    // The camera must be asked for a WIDE frame now.
    const asked = await page.waitForFunction(() => {
      const w = window as unknown as { __applied: { width?: { ideal?: number }; height?: { ideal?: number } }[] };
      const last = w.__applied[w.__applied.length - 1];
      return last && (last.width?.ideal ?? 0) > (last.height?.ideal ?? 0) ? last : null;
    }, undefined, { timeout: 10_000 }).then((h) => h.jsonValue());
    expect(asked, 'turning the phone must re-ask the camera, not just move the buttons').toBeTruthy();

    // The preview element must still span the (now landscape) screen. Measured
    // with offsetWidth, NOT getBoundingClientRect: the rect includes the zoom
    // transform, so a scaled element reports 844*zoom and the assertion reads
    // as a layout failure when nothing is wrong.
    await expect.poll(async () => page.locator('video').evaluate((v: HTMLVideoElement) =>
      v.offsetWidth + 'x' + v.offsetHeight), { timeout: 10_000 }).toBe('844x390');

    // ...and the stops must have been rebuilt for it. Filling a landscape
    // screen with a landscape camera is nearly free, so the range collapses —
    // which is exactly why carrying the portrait one over was wrong.
    await expect
      .poll(async () => (await chips.allInnerTexts()).join(','), { timeout: 10_000 })
      .not.toBe(portraitStops.join(','));

    // Whatever stop it lands on must be one that exists, or the row shows
    // nothing selected and the control looks broken.
    const pressed = await dialog.getByRole('button', { name: /zoom [\d.]+ times/i, pressed: true }).count();
    const remaining = await chips.count();
    expect(pressed === 1 || remaining === 0, 'a live stop row must have exactly one stop selected').toBe(true);

    // And it still works: the shutter must produce a page in landscape.
    await page.getByRole('button', { name: /capture page/i }).click();
    await expect(page.getByRole('button', { name: /done \(1\)/i })).toBeVisible({ timeout: 10_000 });
  });

  test('says MOVE BACK when the page runs off the frame, and finds it when it does not', async ({ page }) => {
    // The first real photograph anyone sent: an envelope on a patterned bed,
    // held close enough that its left and right edges were out of shot. The
    // detector needs four corners, had two, and returned nothing — while the
    // screen went on saying "Point the camera at your document" to someone
    // doing exactly that. The detection behaviour is right; the silence was
    // not.
    //
    // Chromium's fake camera shows a rolling pattern, so this drives a canvas
    // whose page can be made to overflow the frame and then fit inside it.
    await page.addInitScript(() => {
      const W = 1280, H = 720;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d')!;
      (window as unknown as { __tooClose: boolean }).__tooClose = true;
      setInterval(() => {
        x.fillStyle = '#3a3630'; x.fillRect(0, 0, W, H);
        const pageH = H * 0.45;
        const pageW = (window as unknown as { __tooClose: boolean }).__tooClose ? W * 1.3 : W * 0.55;
        x.save(); x.translate(W / 2, H / 2);
        x.fillStyle = '#f4f2ee'; x.fillRect(-pageW / 2, -pageH / 2, pageW, pageH);
        x.restore();
      }, 60);
      navigator.mediaDevices.getUserMedia = async () => c.captureStream(20);
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const dialog = await openScanner(page);

    await expect(dialog.getByText(/move back/i), 'a page running off the frame must say so')
      .toBeVisible({ timeout: 15_000 });

    // Back off so all four edges are in shot: it must find it.
    await page.evaluate(() => { (window as unknown as { __tooClose: boolean }).__tooClose = false; });
    await expect(dialog.getByText(/document found|hold still|captured/i), 'and then actually detect it')
      .toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/move back/i)).toHaveCount(0);
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
