import { describe, expect, it } from 'vitest';
import { enhanceScan, type ScanMode } from '@/lib/scan-enhance';

/* Flattening the lighting on a photograph of paper.
 *
 * The scene every test here uses is the one that exposed the old pass: a sheet
 * of paper photographed with a shadow across it, so the SAME white paper reads
 * as 230 on one side of the frame and 110 on the other. A global brightness and
 * contrast curve cannot fix that by construction — whatever it does to the lit
 * half it also does to the shadowed half — which is why the owner's envelope
 * came out looking like a photo of an envelope and prompted "why is the scanner
 * in colour mode?".
 */

const W = 240, H = 160;

/** Paper under a left-to-right shadow, with a band of dark ink across it. */
function shadowedPage(): { data: Uint8ClampedArray; inkAt: number; paperAt: number } {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Paper brightness falls from 235 on the left to 105 on the right.
      const lit = 235 - (x / W) * 130;
      // A horizontal ink band, always 45% of whatever the local paper is — the
      // way real ink behaves under uneven light.
      const onInk = y > H * 0.45 && y < H * 0.55;
      const v = onInk ? lit * 0.45 : lit;
      const o = (y * W + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = v;
      d[o + 3] = 255;
    }
  }
  return { data: d, inkAt: (Math.floor(H * 0.5) * W + Math.floor(W * 0.85)) * 4, paperAt: (10 * W + Math.floor(W * 0.85)) * 4 };
}

describe('enhanceScan', () => {
  it('makes paper white on BOTH sides of a shadow', () => {
    const { data } = shadowedPage();
    const before = { lit: data[(10 * W + 20) * 4], dark: data[(10 * W + W - 20) * 4] };
    expect(before.lit - before.dark, 'the scene really is unevenly lit').toBeGreaterThan(80);

    enhanceScan(data, W, H, 'grey');
    const after = { lit: data[(10 * W + 20) * 4], dark: data[(10 * W + W - 20) * 4] };

    expect(after.lit, 'lit paper must be white').toBeGreaterThan(245);
    expect(after.dark, 'and so must paper that was in shadow').toBeGreaterThan(245);
    expect(Math.abs(after.lit - after.dark), 'the shadow must be gone, not merely reduced').toBeLessThan(8);
  });

  it('keeps ink dark where a contrast curve would have lost it', () => {
    const { data, inkAt, paperAt } = shadowedPage();
    enhanceScan(data, W, H, 'grey');
    expect(data[paperAt], 'paper in the shadowed half').toBeGreaterThan(240);
    expect(data[inkAt], 'ink in the shadowed half must still be ink').toBeLessThan(160);
    expect(data[paperAt] - data[inkAt], 'and must stand well clear of its paper').toBeGreaterThan(90);
  });

  it('black and white gives two tones and nothing in between', () => {
    const { data } = shadowedPage();
    enhanceScan(data, W, H, 'bw');
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4) seen.add(data[i]);
    expect([...seen].sort((a, b) => a - b), 'only black and white').toEqual([0, 255]);
  });

  it('colour keeps the hue while still whitening the paper', () => {
    // A red stamp on shadowed paper: the red must survive, the paper must not.
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lit = 235 - (x / W) * 130;
        const onStamp = x > W * 0.6 && x < W * 0.8 && y > H * 0.3 && y < H * 0.6;
        const o = (y * W + x) * 4;
        d[o] = onStamp ? lit : lit;
        d[o + 1] = onStamp ? lit * 0.25 : lit;
        d[o + 2] = onStamp ? lit * 0.25 : lit;
        d[o + 3] = 255;
      }
    }
    enhanceScan(d, W, H, 'colour');
    const stamp = (Math.floor(H * 0.45) * W + Math.floor(W * 0.7)) * 4;
    const paper = (10 * W + Math.floor(W * 0.7)) * 4;
    expect(d[paper], 'paper goes white').toBeGreaterThan(240);
    expect(d[stamp] - d[stamp + 1], 'the stamp is still red').toBeGreaterThan(60);
  });

  it('leaves an already-even page alone rather than wrecking it', () => {
    // Uniform white paper with black text: nothing to correct, so nothing
    // should change much. A pass that only ever pushes contrast would clip it.
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = (y % 17 === 0 && x > 20 && x < W - 20) ? 30 : 246;
        const o = (y * W + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = v;
        d[o + 3] = 255;
      }
    }
    enhanceScan(d, W, H, 'grey');
    expect(d[(5 * W + 5) * 4], 'paper stays paper').toBeGreaterThan(240);
    const textRow = (17 * W + Math.floor(W / 2)) * 4;
    expect(d[textRow], 'text stays text').toBeLessThan(120);
  });

  it('survives a one-pixel image without dividing by zero', () => {
    for (const mode of ['grey', 'bw', 'colour'] as ScanMode[]) {
      const d = new Uint8ClampedArray([0, 0, 0, 255]);
      enhanceScan(d, 1, 1, mode);
      expect(Number.isFinite(d[0])).toBe(true);
    }
  });
});

describe('colour mode must not wreck things that are not paper', () => {
  it('leaves a dark subject alone instead of bleaching it', () => {
    /* The bug the owner photographed: a laptop screen, dark, filling the frame.
     * Flat-fielding assumes the background is paper, so on a dark subject the
     * ratio comes back near 1, the lift pushes it to white, and the screen is
     * returned as a pale wash — "what is this? my laptop screen. you made it
     * very badly."
     */
    const W = 160, H = 120;
    const d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      d[o] = 18; d[o + 1] = 34; d[o + 2] = 52; d[o + 3] = 255;  // a dark blue UI
    }
    const before = [d[0], d[1], d[2]];
    enhanceScan(d, W, H, 'colour');
    expect(d[0], 'dark stays dark').toBeLessThan(before[0] + 12);
    expect(d[2], 'and does not blow out').toBeLessThan(before[2] + 12);
    expect(d[2] - d[0], 'the hue survives').toBeGreaterThan(20);
  });

  it('still whitens paper, which is the point of the mode', () => {
    const W = 160, H = 120;
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const beige = 196 - (x / W) * 40;       // paper, unevenly lit and warm
        d[o] = beige; d[o + 1] = beige * 0.97; d[o + 2] = beige * 0.9; d[o + 3] = 255;
      }
    }
    enhanceScan(d, W, H, 'colour');
    expect(d[(60 * W + 20) * 4], 'paper goes white').toBeGreaterThan(240);
    expect(d[(60 * W + W - 20) * 4], 'on the dim side too').toBeGreaterThan(235);
  });
});
