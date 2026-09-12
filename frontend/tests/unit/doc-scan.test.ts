import { describe, expect, it } from 'vitest';
import { detectDocument, flattenDocument, quadStability, fillTransform, type Quad, type Point } from '@/lib/doc-scan';

/* Document detection, tested against frames whose answer is already known.
 *
 * A camera cannot be pointed at anything in CI, so the frames are synthesised:
 * a pale quadrilateral "page" painted onto a darker "desk", at a perspective we
 * chose. That makes the ground truth exact, which is the whole value — every
 * assertion here is "the detector found the corners we drew", measured in
 * pixels, not "the detector returned something".
 *
 * The page is given faint text lines and the desk a little noise, because a
 * detector that only works on flat blocks of colour would pass a clean test and
 * fail on a real desk: it is the paper texture and print that produce the false
 * edges a real pipeline has to survive.
 */

// jsdom has no ImageData constructor with a usable data buffer in every version,
// and none of this code needs a DOM — so build the shape the functions expect.
function makeImageData(w: number, h: number): ImageData {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' } as ImageData;
}

/** Is point p inside the quad? Standard even-odd crossing test. */
function inside(q: Point[], px: number, py: number): boolean {
  let hit = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[i], b = q[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * Paint a page onto a desk.
 *
 * `seed` drives a tiny deterministic PRNG so the noise is identical on every
 * run — a flaky vision test is worse than no vision test, because it teaches
 * you to re-run until it passes.
 */
function synthFrame(w: number, h: number, quad: Quad, opts: { desk?: number; paper?: number; seed?: number } = {}): ImageData {
  const { desk = 60, paper = 235, seed = 1 } = opts;
  const img = makeImageData(w, h);
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff); };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let v: number;
      if (inside(quad, x + 0.5, y + 0.5)) {
        v = paper + (rnd() * 8 - 4);                       // paper grain
        // Faint printed lines across the page — the false edges a real scan has.
        if (y % 11 === 0 && x % 3 !== 0) v -= 70;
      } else {
        v = desk + (rnd() * 14 - 7);                       // desk texture
      }
      v = Math.max(0, Math.min(255, v));
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  return img;
}

/** Largest corner error, in pixels, after matching corners by position. */
function cornerError(found: Quad, expected: Quad): number {
  // Both are in reading order, but a near-square page can legitimately start at
  // a different corner, so compare every rotation and take the best.
  let best = Infinity;
  for (let r = 0; r < 4; r++) {
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      const f = found[(i + r) % 4], e = expected[i];
      worst = Math.max(worst, Math.hypot(f.x - e.x, f.y - e.y));
    }
    best = Math.min(best, worst);
  }
  return best;
}

describe('detectDocument', () => {
  it('finds a page lying square to the camera', () => {
    const quad: Quad = [{ x: 90, y: 60 }, { x: 550, y: 60 }, { x: 550, y: 700 }, { x: 90, y: 700 }];
    const found = detectDocument(synthFrame(640, 780, quad));
    expect(found, 'a high-contrast page filling most of the frame must be found').not.toBeNull();
    // 320px working width on a 640px frame means every detected coordinate is
    // quantised to ~2px before it is scaled back up, so single-pixel accuracy is
    // not on offer and would not matter if it were.
    expect(cornerError(found!, quad)).toBeLessThan(14);
  });

  it('finds a page photographed at an angle, which is the normal case', () => {
    // Held over a desk: the far edge is shorter and higher than the near one.
    const quad: Quad = [{ x: 150, y: 90 }, { x: 500, y: 130 }, { x: 570, y: 660 }, { x: 80, y: 700 }];
    const found = detectDocument(synthFrame(640, 780, quad));
    expect(found, 'a page seen in perspective must still be found').not.toBeNull();
    expect(cornerError(found!, quad)).toBeLessThan(18);
  });

  it('finds a dark page on a pale desk, not just the other way round', () => {
    // The threshold is taken from the image's own gradients precisely so this
    // works. A fixed cutoff tuned on white-paper-on-dark-wood fails here.
    const quad: Quad = [{ x: 100, y: 80 }, { x: 540, y: 70 }, { x: 545, y: 690 }, { x: 95, y: 700 }];
    const found = detectDocument(synthFrame(640, 780, quad, { desk: 225, paper: 55 }));
    expect(found, 'contrast in the other direction is still contrast').not.toBeNull();
    expect(cornerError(found!, quad)).toBeLessThan(18);
  });

  it('says no when there is no document, rather than inventing one', () => {
    // An empty desk. Returning a confident quad here is worse than returning
    // nothing: the UI would draw a highlight around a patch of table and the
    // shutter would capture it.
    const empty = makeImageData(640, 780);
    let s = 7;
    for (let i = 0; i < empty.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 60 + (s / 0x7fffffff) * 14 - 7;
      empty.data[i] = empty.data[i + 1] = empty.data[i + 2] = v;
      empty.data[i + 3] = 255;
    }
    expect(detectDocument(empty)).toBeNull();
  });

  it('ignores something far too small to be the page being scanned', () => {
    // A business card on the desk: real, high-contrast, and not what you are
    // scanning. MIN_AREA_FRACTION is what keeps the highlight off it.
    const tiny: Quad = [{ x: 300, y: 360 }, { x: 380, y: 360 }, { x: 380, y: 410 }, { x: 300, y: 410 }];
    expect(detectDocument(synthFrame(640, 780, tiny))).toBeNull();
  });
});

describe('flattenDocument', () => {
  it('squares up a page shot at an angle and drops everything around it', () => {
    const quad: Quad = [{ x: 150, y: 90 }, { x: 500, y: 130 }, { x: 570, y: 660 }, { x: 80, y: 700 }];
    const frame = synthFrame(640, 780, quad);
    const flat = flattenDocument(frame, quad);
    expect(flat).not.toBeNull();

    // Every corner of the OUTPUT should now be page, not desk. That is the
    // proof the background is gone: before flattening, three of these four
    // sample points were desk.
    const at = (x: number, y: number) => flat!.data[(y * flat!.width + x) * 4];
    const inset = 6;
    for (const [x, y] of [
      [inset, inset],
      [flat!.width - 1 - inset, inset],
      [flat!.width - 1 - inset, flat!.height - 1 - inset],
      [inset, flat!.height - 1 - inset],
    ]) {
      expect(at(x, y), `corner ${x},${y} of the flattened page should be paper, not desk`).toBeGreaterThan(150);
    }
  });

  it('recovers roughly the right proportions', () => {
    // A page twice as tall as it is wide, seen head-on, must come back about
    // twice as tall as it is wide.
    const quad: Quad = [{ x: 100, y: 50 }, { x: 400, y: 50 }, { x: 400, y: 650 }, { x: 100, y: 650 }];
    const flat = flattenDocument(synthFrame(520, 720, quad), quad);
    expect(flat).not.toBeNull();
    const ratio = flat!.height / flat!.width;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  it('caps the long edge so a 4K sensor does not produce a 40MB page', () => {
    const quad: Quad = [{ x: 0, y: 0 }, { x: 3999, y: 0 }, { x: 3999, y: 2999 }, { x: 0, y: 2999 }];
    const frame = makeImageData(4000, 3000);
    const flat = flattenDocument(frame, quad, 1200);
    expect(Math.max(flat!.width, flat!.height)).toBeLessThanOrEqual(1200);
  });

  it('refuses a collapsed quad instead of dividing by zero', () => {
    const line: Quad = [{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 }];
    expect(flattenDocument(makeImageData(100, 100), line)).toBeNull();
  });
});

describe('quadStability', () => {
  const q: Quad = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const diag = Math.hypot(640, 780);

  it('is 1 when the page has not moved at all', () => {
    expect(quadStability(q, q, diag)).toBe(1);
  });

  it('falls off as the page moves', () => {
    const nudged = q.map((p) => ({ x: p.x + 6, y: p.y + 6 })) as Quad;
    const shoved = q.map((p) => ({ x: p.x + 60, y: p.y + 60 })) as Quad;
    expect(quadStability(nudged, q, diag)).toBeLessThan(1);
    expect(quadStability(shoved, q, diag)).toBeLessThan(quadStability(nudged, q, diag));
  });

  it('is 0 when there is nothing to compare', () => {
    expect(quadStability(null, q, diag)).toBe(0);
    expect(quadStability(q, null, diag)).toBe(0);
  });
});




describe('fillTransform', () => {
  it('never crops — reported as "overzoomed", then as "it is auto zooming"', () => {
    // Every orientation, every turn: the whole frame is on screen. A crop reads
    // as the camera having zoomed in by itself, and no amount of it is wanted.
    for (const [fw, fh] of [[1280, 720], [720, 1280], [1920, 1080], [1440, 2560]]) {
      for (const turns of [0, 1, 2, 3]) {
        const t = fillTransform(fw, fh, 390, 844, turns);
        expect(t.visibleFraction, `${fw}x${fh} turns=${turns}`).toBe(1);
        expect(t.boxW, 'must fit the width available').toBeLessThanOrEqual(390);
        expect(t.boxH, 'must fit the height available').toBeLessThanOrEqual(844);
      }
    }
  });

  it('turning a sideways frame upright is what makes it big', () => {
    // The same 1280x720 frame: lying down it is a band, turned it is most of
    // the screen. This is why the turn matters even without any cropping.
    const raw = fillTransform(1280, 720, 390, 844, 0);
    const turned = fillTransform(1280, 720, 390, 844, 1);
    const area = (b: { boxW: number; boxH: number }) => (b.boxW * b.boxH) / (390 * 844);
    expect(area(raw), 'a sideways frame fitted is a thin band').toBeLessThan(0.3);
    expect(area(turned), 'turned upright it fills most of the screen').toBeGreaterThan(0.8);
  });

  it('keeps the proportions of the frame exactly', () => {
    const t = fillTransform(1280, 720, 390, 844, 1);
    expect(t.boxW / t.boxH).toBeCloseTo(720 / 1280, 2);
  });

  it('survives a camera that has reported nothing yet', () => {
    const t = fillTransform(0, 0, 390, 844);
    expect(t.visibleFraction).toBe(1);
    expect(t.boxW).toBe(390);
  });
});

describe('a frame captured from the running scanner', () => {
  /* The regression that mattered.
   *
   * Every test above uses a frame this file drew, and all of them passed while
   * the owner was reporting "it is not detecting the document". So this one is
   * different in the only way that counts: the pixels were taken OUT of the
   * running scanner — the camera preview, painted, turned upright, downscaled
   * exactly as the detection loop does it — and saved.
   *
   * On those pixels the page was found, measured at 29% of the frame and
   * convex, and then thrown away for scoring 0.0949 against a 0.035 shape
   * tolerance. Blurring joins a sheet's border to the print inside it, so the
   * traced outline wanders up into the text and stops resembling a rectangle.
   * The corners were right the whole time; the shape test was reading the
   * writing on the page as evidence that it was not a page.
   *
   * Taking the convex hull first fixes it at the root — anything inside the
   * sheet is inside the hull — and the same frame now scores 0.0076. The
   * alternative was loosening the tolerance, which would have bought this frame
   * by admitting genuinely bad shapes everywhere else.
   */
  function frameFromFixture(): ImageData {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { w, h, rle } = require('../fixtures/preview-frame.json') as { w: number; h: number; rle: number[] };
    const data = new Uint8ClampedArray(w * h * 4);
    let p = 0;
    for (let i = 0; i < rle.length; i += 2) {
      const value = rle[i];
      for (let n = 0; n < rle[i + 1]; n++) {
        data[p] = data[p + 1] = data[p + 2] = value;
        data[p + 3] = 255;
        p += 4;
      }
    }
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  }

  it('finds the page — the case that was failing in the real app', () => {
    const found = detectDocument(frameFromFixture());
    expect(found, 'this frame came out of the running scanner and must be detected').not.toBeNull();

    // Roughly where the page is, generously: this guards "found the page"
    // rather than pinning exact pixels that a threshold tweak may legitimately
    // move by a few.
    const xs = found!.map((p) => p.x), ys = found!.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThan(120);
    expect(Math.max(...xs)).toBeGreaterThan(260);
    expect(Math.min(...ys)).toBeLessThan(300);
    expect(Math.max(...ys)).toBeGreaterThan(400);
  });

  it('and flattens it into a page rather than a slice of desk', () => {
    const frame = frameFromFixture();
    const quad = detectDocument(frame)!;
    const flat = flattenDocument(frame, quad);
    expect(flat).not.toBeNull();
    const at = (x: number, y: number) => flat!.data[(y * flat!.width + x) * 4];
    const inset = 8;
    for (const [x, y] of [
      [inset, inset],
      [flat!.width - 1 - inset, inset],
      [flat!.width - 1 - inset, flat!.height - 1 - inset],
      [inset, flat!.height - 1 - inset],
    ]) {
      expect(at(x, y), `corner ${x},${y} should be paper`).toBeGreaterThan(120);
    }
  });
});
