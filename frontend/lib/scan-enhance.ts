'use client';

/**
 * Turning a photograph of paper into something that looks scanned.
 *
 * ── Why the old pass was not enough ─────────────────────────────────────────
 * It was one global curve: grey = luma, then `(g - 128) * 1.35 + 128 + 12`.
 * That is a brightness and contrast knob, and a brightness and contrast knob
 * cannot fix a photograph, because the problem with a photograph of a page is
 * not its overall level — it is that the level is DIFFERENT IN DIFFERENT
 * PLACES. A phone throws a shadow. A lamp lights one corner. Paper that reads
 * as white at the top of the frame is the same grey as the ink at the bottom,
 * and no single curve separates them: lift it until the shadowed paper goes
 * white and the lit half blows out; keep the highlights and the shadow stays.
 *
 * The owner's scan of an envelope came out looking exactly like what it was, a
 * photo of an envelope on a bed, and the question was "why is the scanner in
 * colour mode?" — which is the right question to ask of a result that does not
 * look like a scan.
 *
 * ── What this does instead ──────────────────────────────────────────────────
 * Estimate the page's own background and divide it out. Blur the image far
 * enough that every letter disappears and what is left IS the lighting: a slow
 * map of how bright the paper is in each part of the picture. Divide the
 * original by that map and the paper becomes uniformly white everywhere, while
 * ink — which is much darker than its local background — stays dark.
 *
 * This is the standard trick (flat-fielding, or "shadow removal" in scanner
 * apps) and it is the reason their output looks like a document while a
 * contrast slider does not. It costs two box blurs, which are O(n) regardless
 * of radius.
 */

export type ScanMode = 'colour' | 'grey' | 'bw';

/** A separable box blur, run twice so the background map has no square edges. */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const run = (input: Float32Array): Float32Array => {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const norm = 1 / (radius * 2 + 1);
    const clampX = (x: number) => (x < 0 ? 0 : x >= w ? w - 1 : x);
    const clampY = (y: number) => (y < 0 ? 0 : y >= h ? h - 1 : y);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += input[y * w + clampX(x)];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum * norm;
        sum -= input[y * w + clampX(x - radius)];
        sum += input[y * w + clampX(x + radius + 1)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[clampY(y) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum * norm;
        sum -= tmp[clampY(y - radius) * w + x];
        sum += tmp[clampY(y + radius + 1) * w + x];
      }
    }
    return out;
  };
  return run(run(src));
}

/**
 * Flatten the lighting and, depending on the mode, drop the colour.
 *
 * Works in place on the RGBA buffer. `colour` keeps the hues but still
 * normalises the lighting, so a coloured form comes out on white paper rather
 * than on beige; `grey` is the usual document look; `bw` pushes on to two
 * tones, which is what makes text crisp and files small.
 */
export function enhanceScan(d: Uint8ClampedArray, w: number, h: number, mode: ScanMode): void {
  const n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  }

  /* The radius has to be bigger than anything you want to KEEP and smaller
   * than the lighting you want to remove.
   *
   * Too small and the background map starts following the ink: a thick band of
   * it — a red banner, a heading — drags its own background down, the ratio
   * comes back near 1, and the band is read as paper. Measured at a twelfth of
   * the short side, a band a tenth of the height came out at 168 instead of the
   * ~120 it should be. Too large and the map stops tracking the shadow, which
   * is the thing it exists to remove.
   *
   * An eighth of the short side clears ordinary text by a wide margin and still
   * follows lighting, which varies slowly across a photograph. */
  const radius = Math.max(8, Math.round(Math.min(w, h) / 8));
  const bg = boxBlur(gray, w, h, radius);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    // How bright is this pixel compared with the paper AROUND it? 1 means "as
    // bright as its own background", i.e. blank paper, wherever it happens to
    // sit in the picture and whatever the light was doing there.
    const ratio = gray[i] / Math.max(bg[i], 1);

    if (mode === 'bw') {
      // 0.82 rather than 1.0: paper is never quite as bright as its blurred
      // self near a letter, and thresholding at parity nibbles the edges off
      // text. Anything appreciably darker than its surroundings is ink.
      const v = ratio > 0.82 ? 255 : 0;
      d[p] = d[p + 1] = d[p + 2] = v;
      continue;
    }

    if (mode === 'grey') {
      // A little headroom above parity, so ordinary paper lands on pure white
      // instead of 250-ish, which is what makes the result read as a scan
      // rather than a photograph of a page.
      d[p] = d[p + 1] = d[p + 2] = Math.min(255, ratio * 255 * 1.08);
      continue;
    }

    // Colour is finished below, one channel at a time. Doing it here, with a
    // single gain for all three, is what produced the cast.
  }

  if (mode !== 'colour') return;

  /* Colour is NOT "grey mode with the hues put back", and shipping it that way
   * was wrong twice over. Both mistakes were reported, both from the same
   * photograph of a laptop screen.
   *
   * First: dividing by the local background assumes the background IS paper.
   * Photograph something that is not and the assumption inverts — the local
   * background is dark, the ratio comes back near 1, the lift pushes it to 255,
   * and a dark screen is returned as a pale wash. So the lift now only applies
   * where the background is already bright enough to BE paper, eased in so
   * there is no seam, and dark subjects are left entirely alone.
   *
   * Second, and this is the tint that came next: ONE GAIN FOR ALL THREE
   * CHANNELS CANNOT REMOVE A COLOUR CAST, IT AMPLIFIES ONE. A screen photo is
   * slightly blue — measured 178/190/206 — and a single 1.4x gain clips green
   * and blue at 255 while red lands on 241. That is a cyan page, arrived at by
   * multiplying every channel by the same number.
   *
   * So each channel is divided by ITS OWN background. Whatever the paper is lit
   * by — a warm lamp, a blue screen, daylight — all three backgrounds map to
   * white together and the cast goes with them, which is what white balance
   * means. Ink and stamps keep their hue, because they sit far from their own
   * local background in a way paper does not.
   *
   * One channel at a time, so only one background map is alive at once: a
   * 2000x1125 page is 9MB of floats per map, and holding three on a phone is
   * not worth the handful of lines it would save.
   */
  const chan = new Float32Array(n);
  for (let c = 0; c < 3; c++) {
    for (let i = 0, p = c; i < n; i++, p += 4) chan[i] = d[p];
    const bgC = boxBlur(chan, w, h, radius);
    for (let i = 0, p = c; i < n; i++, p += 4) {
      const lum = bg[i];
      const paperness = lum <= 90 ? 0 : lum >= 150 ? 1 : (lum - 90) / 60;
      const gain = 1 + paperness * (Math.min(255 / Math.max(bgC[i], 1), 2.2) - 1);
      d[p] = Math.min(255, d[p] * gain);
    }
  }
}
