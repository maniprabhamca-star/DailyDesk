import { describe, expect, it } from 'vitest';
import { detectDocument, flattenDocument, quadStability, viewRect, fillZoom, smoothQuad, type Quad, type Point } from '@/lib/doc-scan';

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

  it('does not mistake the edge of the picture for a page', () => {
    // Found in the running scanner: with the document taken away, the outline
    // stayed on screen and locked green around the whole frame. The image
    // boundary is a PERFECT rectangle, so it passes the shape test better than
    // any real page — and with nothing else in view, grain is the strongest
    // signal there is. Both the area cap and the border test must refuse it.
    const edgeToEdge: Quad = [{ x: 1, y: 1 }, { x: 638, y: 1 }, { x: 638, y: 778 }, { x: 1, y: 778 }];
    expect(detectDocument(synthFrame(640, 780, edgeToEdge))).toBeNull();

    // Inset by a few pixels is the same thing and must also be refused.
    const almost: Quad = [{ x: 8, y: 10 }, { x: 631, y: 10 }, { x: 631, y: 770 }, { x: 8, y: 770 }];
    expect(detectDocument(synthFrame(640, 780, almost))).toBeNull();
  });

  it('still finds a page held close, filling most of the frame', () => {
    // The other side of that cap: someone scanning a full sheet fills the
    // viewfinder with it, and refusing THAT would be the worse bug.
    const big: Quad = [{ x: 40, y: 50 }, { x: 600, y: 50 }, { x: 600, y: 730 }, { x: 40, y: 730 }];
    const found = detectDocument(synthFrame(640, 780, big));
    expect(found, 'a page at 76% of the frame is a page, not the frame').not.toBeNull();
  });

  it('refuses a quad with a corner ON the edge of the picture', () => {
    // THE worst output this scanner has produced, from a real photograph: an
    // envelope running off both sides of the frame, outlined as a green wedge
    // cutting diagonally across it — one corner on the left edge, one on the
    // bottom — and five of them captured and saved before anyone stopped it.
    //
    // The rule that let it through only rejected a quad when ALL FOUR corners
    // hugged the border. A single corner on the border is already fatal: it is
    // not a corner of the document, it is where the document left the frame.
    const wedge: Quad = [
      { x: 0, y: 470 },      // on the left edge — the giveaway
      { x: 300, y: 300 },
      { x: 600, y: 330 },
      { x: 600, y: 470 },
    ];
    expect(detectDocument(synthFrame(640, 480, wedge)), 'a corner on the border is not a corner').toBeNull();

    // One corner is enough to sink it, from any edge.
    for (const bad of [
      [{ x: 320, y: 0 }, { x: 600, y: 90 }, { x: 580, y: 400 }, { x: 60, y: 380 }],
      [{ x: 60, y: 90 }, { x: 639, y: 90 }, { x: 600, y: 400 }, { x: 60, y: 380 }],
      [{ x: 60, y: 90 }, { x: 580, y: 90 }, { x: 560, y: 479 }, { x: 60, y: 380 }],
    ] as Quad[]) {
      expect(detectDocument(synthFrame(640, 480, bad)), 'every edge counts').toBeNull();
    }
  });

  it('finds a WHITE page on a PALE surface that is covered in print', () => {
    /* The fifteenth round, and the one that was actually wrong all along.
     *
     * A white AAA envelope on a cream quilt. Nothing detected, no outline, over
     * and over. The cause was not the framing, the orientation or the zoom: it
     * was the edge threshold, which kept "the top 8% of gradients in the whole
     * picture". On a document that budget is spent by the PRINT — black address
     * lines and a red banner produce enormous gradients — so the cut landed
     * above them and the envelope's own edge, white paper against cream fabric
     * and perhaps thirty grey levels, fell underneath it and disappeared.
     *
     * The detector went blind on the document precisely because the document
     * had writing on it. Measured, same page, same position, same contrast:
     *
     *     without print -> FOUND        with print -> null
     *
     * Hysteresis fixed it: strict seeds, loose growth along connected pixels.
     * A page boundary is one long connected curve, so its strong stretches pull
     * its faint stretches in.
     */
    const w = 640, h = 360;
    const page: Quad = [{ x: 40, y: 60 }, { x: 600, y: 55 }, { x: 600, y: 300 }, { x: 40, y: 305 }];
    const img = makeImageData(w, h);
    let s = 3;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const onPage = inside(page, x + 0.5, y + 0.5);
      // 245 on 215 — the whole page/desk step is thirty levels.
      let v = onPage ? 245 + rnd() * 4 - 2 : 215 + rnd() * 10 - 5;
      if (onPage) {
        const ry = y - h * 0.42, rx = x - w * 0.55;
        if (ry > 0 && ry < h * 0.09 && rx > 0 && rx < w * 0.33) v = 90;   // the red banner
        if (y % 9 === 0 && x > w * 0.08 && x < w * 0.45) v = 30;          // address lines
      }
      v = Math.max(0, Math.min(255, v));
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    const found = detectDocument(img);
    expect(found, 'print inside the page must not hide the edge of the page').not.toBeNull();
    expect(cornerError(found!, page), 'and it must be the PAGE, not a slice of it').toBeLessThan(25);
  });

  it('says a page is CLIPPED when it runs off the frame, not just "nothing"', () => {
    // The first real photograph anyone sent: an envelope on a bed, held close
    // enough that its left and right edges were outside the picture. The
    // detector needs four corners and had two, so it returned null — correctly
    // — while the screen went on saying "Point the camera at your document" at
    // someone doing exactly that. Returning null is honest and useless.
    //
    // Measured before the fix: a page fully inside is FOUND; touching both side
    // edges, running off both sides, and running off all four are all null.
    const clipped: Quad = [{ x: -60, y: 60 }, { x: 700, y: 58 }, { x: 700, y: 210 }, { x: -60, y: 212 }];
    const notes = { clipped: false };
    expect(detectDocument(synthFrame(640, 270, clipped), notes), 'still no quad — two corners is not four').toBeNull();
    expect(notes.clipped, 'but it must say WHY, because "move back" fixes it').toBe(true);
  });

  it('does not cry "clipped" at an empty desk', () => {
    // The picture's own border traced around a bare surface spans BOTH pairs of
    // edges. Telling someone to move back from nothing is worse than silence,
    // so only spanning ONE pair counts — which is what a page held too close
    // does and what the frame border never does.
    const empty = makeImageData(640, 270);
    let s = 11;
    for (let i = 0; i < empty.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 70 + (s / 0x7fffffff) * 16 - 8;
      empty.data[i] = empty.data[i + 1] = empty.data[i + 2] = v;
      empty.data[i + 3] = 255;
    }
    const notes = { clipped: false };
    expect(detectDocument(empty, notes)).toBeNull();
    expect(notes.clipped, 'an empty desk is not a page held too close').toBe(false);
  });

  it('leaves the notes alone when the page is found', () => {
    const quad: Quad = [{ x: 90, y: 60 }, { x: 550, y: 60 }, { x: 550, y: 700 }, { x: 90, y: 700 }];
    const notes = { clipped: false };
    expect(detectDocument(synthFrame(640, 780, quad), notes)).not.toBeNull();
    expect(notes.clipped).toBe(false);
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




describe('smoothQuad', () => {
  const at = (x: number, y: number): Quad => [
    { x, y }, { x: x + 200, y }, { x: x + 200, y: y + 280 }, { x, y: y + 280 },
  ];
  const diag = Math.hypot(480, 812);
  const spread = (a: Quad, b: Quad) => Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));

  it('damps camera jitter — the "dancing" report', () => {
    // A stationary page whose corners are re-decided every frame with a few
    // pixels of noise on each. Raw, the outline shimmers by the full noise
    // amplitude; smoothed, by a fraction of it.
    const truth = at(100, 200);
    const noisy = (f: number) => truth.map((p) => ({
      x: p.x + (f % 2 ? 4 : -4),
      y: p.y + (f % 3 ? 3 : -3),
    })) as Quad;

    let held: Quad | null = null;
    let smoothed = 0, rawShimmer = 0;
    for (let f = 0; f < 40; f++) {
      if (f) rawShimmer = Math.max(rawShimmer, spread(noisy(f - 1), noisy(f)));
      const next = smoothQuad(held, noisy(f), diag);
      if (held) smoothed = Math.max(smoothed, spread(held, next));
      held = next;
    }
    // The property that matters is the RATIO: what the eye reads as dancing is
    // how far the outline moves between frames while the page sits still.
    expect(smoothed, `raw shimmer ${rawShimmer.toFixed(1)}px`).toBeLessThan(rawShimmer / 3);
  });

  it('settles onto a page that has stopped moving', () => {
    const truth = at(100, 200);
    let held: Quad | null = at(140, 250);
    for (let f = 0; f < 40; f++) held = smoothQuad(held, truth, diag);
    expect(spread(held!, truth), 'it must converge, not orbit').toBeLessThan(0.5);
  });

  it('snaps to a different sheet instead of crawling across the screen', () => {
    // Blending unconditionally would drag the outline over half a second every
    // time a new page is presented, which looks broken in its own way.
    const first = at(60, 120);
    const second = at(60, 600);
    const out = smoothQuad(first, second, diag);
    expect(spread(out, second), 'a big jump is adopted immediately').toBe(0);
  });

  it('adopts the first outline as-is and survives a missing diagonal', () => {
    const q = at(10, 10);
    expect(smoothQuad(null, q, diag)).toBe(q);
    expect(smoothQuad(at(0, 0), q, 0)).toBe(q);
  });
});

describe('viewRect', () => {
  // The owner's phone: a 2560x1440 camera on a 375x812 screen. Filling that
  // screen means showing a quarter of the picture, which is the "over zooming
  // by default" report and the reason zoom exists at all.
  const PHONE = [2560, 1440, 375, 812] as const;

  it('shows the WHOLE frame at zoom 1 — the widest the camera can go', () => {
    const r = viewRect(...PHONE, 1);
    expect(r.visibleFraction, 'nothing may be cropped at the widest stop').toBeCloseTo(1, 4);
    expect(r.sw).toBeCloseTo(2560, 4);
    expect(r.sh).toBeCloseTo(1440, 4);
    // Letterboxed: full width of the screen, a band of its height.
    expect(r.dw).toBeCloseTo(375, 4);
    expect(r.dh).toBeLessThan(812);
    expect(r.dy, 'and centred in the black').toBeCloseTo((812 - r.dh) / 2, 4);
  });

  it('fills the screen exactly at fillZoom, and no further', () => {
    const max = fillZoom(...PHONE);
    const r = viewRect(...PHONE, max);
    expect(r.dw).toBeCloseTo(375, 3);
    expect(r.dh).toBeCloseTo(812, 3);
    expect(r.dx).toBeCloseTo(0, 3);
    expect(r.dy).toBeCloseTo(0, 3);
    // Past the end is clamped, not extrapolated — zooming in beyond "fills the
    // screen" would just crop for no reason.
    const past = viewRect(...PHONE, max * 3);
    expect(past.visibleFraction).toBeCloseTo(r.visibleFraction, 6);
  });

  it('shows more of the frame the further you zoom out', () => {
    const max = fillZoom(...PHONE);
    const seen = [1, 1.5, 2, 3, max].map((z) => viewRect(...PHONE, z).visibleFraction);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i], `zooming in must never reveal more (step ${i})`).toBeLessThanOrEqual(seen[i - 1] + 1e-9);
    }
    expect(seen[0]).toBeCloseTo(1, 4);
    expect(seen[seen.length - 1], 'filling this screen costs three quarters of the picture').toBeLessThan(0.3);
  });

  it('never stretches, never samples outside the frame, always centres', () => {
    for (const [fw, fh] of [[1280, 720], [1080, 1920], [640, 480], [2560, 1440]]) {
      for (const [bw, bh] of [[390, 844], [844, 390], [500, 500]]) {
        for (const z of [1, 1.3, 2, 8]) {
          const r = viewRect(fw, fh, bw, bh, z);
          const where = `${fw}x${fh} -> ${bw}x${bh} @${z}`;
          // The source rectangle and its destination have the same shape, so
          // nothing on screen is squashed.
          expect(r.sw / r.sh, where).toBeCloseTo(r.dw / r.dh, 2);
          expect(r.sx, where).toBeGreaterThanOrEqual(0);
          expect(r.sy, where).toBeGreaterThanOrEqual(0);
          expect(r.sx + r.sw, where).toBeLessThanOrEqual(fw + 0.01);
          expect(r.sy + r.sh, where).toBeLessThanOrEqual(fh + 0.01);
          // And the picture never spills out of the box.
          expect(r.dx, where).toBeGreaterThanOrEqual(-0.01);
          expect(r.dy, where).toBeGreaterThanOrEqual(-0.01);
          expect(r.dx + r.dw, where).toBeLessThanOrEqual(bw + 0.01);
          expect(r.dy + r.dh, where).toBeLessThanOrEqual(bh + 0.01);
        }
      }
    }
  });

  it('survives a camera that has reported nothing yet', () => {
    const r = viewRect(0, 0, 390, 844, 1);
    expect(r.visibleFraction).toBe(1);
    expect(Number.isFinite(r.sw)).toBe(true);
  });
});

describe('fillZoom', () => {
  it('is 1 when the camera and the screen are the same shape', () => {
    expect(fillZoom(390, 844, 390, 844)).toBeCloseTo(1, 4);
  });

  it('is small when filling is nearly free', () => {
    // 9:16 camera on a 9:19.5 phone — covering costs ~18%.
    expect(fillZoom(1080, 1920, 390, 844)).toBeLessThan(1.3);
  });

  it('is large when filling would throw most of the picture away', () => {
    // The owner's phone: a 16:9 camera on an upright screen. This number IS the
    // "over zooming by default" report, expressed as a multiplier.
    expect(fillZoom(2560, 1440, 375, 812)).toBeGreaterThan(3);
  });

  it('collapses when the same phone is turned on its side', () => {
    // Why the stops have to be rebuilt on rotation rather than carried over:
    // the same camera and the same screen, one quarter turn apart, differ by
    // more than 3x in what filling costs.
    expect(fillZoom(2560, 1440, 812, 375)).toBeLessThan(1.3);
  });

  it('survives a camera or a screen that has reported nothing yet', () => {
    expect(fillZoom(0, 0, 375, 812)).toBe(1);
    expect(fillZoom(2560, 1440, 0, 0)).toBe(1);
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
