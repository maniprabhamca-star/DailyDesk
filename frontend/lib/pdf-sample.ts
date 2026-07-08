// Colour sampling for Edit PDF — pulled out of the component so it can be
// unit-tested in Node (the component can't: pdf.js hangs in the test sandbox).
//
// The cover we paint over an edited line MUST be the page's background colour.
// Sampling a single pixel was fatal: one unlucky dark pixel (a rule above the
// line, a descender from the row above) turned the whole cover BLACK. So we take
// the MODE of the leading gaps around the line, and fall back to the page's
// dominant colour so a mis-sample can never blot a light page black.

export type RGB = [number, number, number];
export type Sampler = (x: number, y: number) => RGB; // rendered-page pixel coords

const lum = (c: RGB) => c[0] + c[1] + c[2];
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const bucket = (c: RGB) => `${c[0] >> 3}_${c[1] >> 3}_${c[2] >> 3}`;
const inkBucket = (c: RGB) => `${Math.round(c[0] / 4)}_${Math.round(c[1] / 4)}_${Math.round(c[2] / 4)}`;
const finite = (c: RGB) => Number.isFinite(c[0]) && Number.isFinite(c[1]) && Number.isFinite(c[2]);
const roundRgb = (r: number, g: number, b: number): RGB => [
  Math.max(0, Math.min(255, Math.round(r))),
  Math.max(0, Math.min(255, Math.round(g))),
  Math.max(0, Math.min(255, Math.round(b))),
];

/** Dominant colour of the whole rendered page = the paper colour (robust). */
export function pageBackground(at: Sampler, rpW: number, rpH: number): RGB {
  const counts = new Map<string, { n: number; c: RGB }>();
  const stepX = Math.max(1, Math.floor(rpW / 60));
  const stepY = Math.max(1, Math.floor(rpH / 60));
  for (let y = 0; y < rpH; y += stepY) {
    for (let x = 0; x < rpW; x += stepX) {
      const c = at(x, y); if (!finite(c)) continue; const k = bucket(c);
      const e = counts.get(k); if (e) e.n++; else counts.set(k, { n: 1, c });
    }
  }
  let best = { n: 0, c: [255, 255, 255] as RGB };
  counts.forEach((v) => { if (v.n > best.n) best = v; });
  return best.c;
}

/** Ink + background colours for one text line. `topPt`/`hPt` are in viewport
 * points; the sampler reads rendered-page pixels (vp→rp scaling handled here). */
export function lineColors(
  at: Sampler, vpW: number, vpH: number, rpW: number, rpH: number,
  x0: number, x1: number, topPt: number, hPt: number, pageBg: RGB,
): { color: string; bg: string } {
  // Ink = the most common non-background colour across the glyph band. Picking
  // the single darkest pixel makes red/blue text flip to black if one edge pixel
  // or neighbouring glyph is darker.
  const inkCounts = new Map<string, { n: number; r: number; g: number; b: number; l: number }>();
  let dark: RGB = [17, 24, 39]; let best = 999;
  for (let ky = 1; ky <= 6; ky++) {
    const cy = (topPt + hPt * (ky / 8)) / vpH * rpH;
    for (let kx = 0; kx <= 16; kx++) {
      const cx = (x0 + (x1 - x0) * kx / 16) / vpW * rpW;
      const c = at(cx, cy); if (!finite(c)) continue; const l = lum(c);
      if (l < 735 && dist(c, pageBg) > 48) {
        const k = inkBucket(c);
        const e = inkCounts.get(k);
        if (e) { e.n++; e.r += c[0]; e.g += c[1]; e.b += c[2]; e.l += l; }
        else inkCounts.set(k, { n: 1, r: c[0], g: c[1], b: c[2], l });
      }
      if (l < best) { best = l; dark = c; }
    }
  }
  let ink: RGB | null = null; let inkN = 0; let inkL = Number.POSITIVE_INFINITY;
  inkCounts.forEach((v) => {
    const avgL = v.l / v.n;
    if (v.n > inkN || (v.n === inkN && avgL < inkL)) {
      inkN = v.n;
      inkL = avgL;
      ink = roundRgb(v.r / v.n, v.g / v.n, v.b / v.n);
    }
  });
  if (ink) dark = ink;
  else if (best > 360) dark = [17, 24, 39];

  // Background = most common colour in the leading gaps just above and below the
  // line, sampled across its width. Mode, not a single pixel.
  const counts = new Map<string, { n: number; c: RGB }>();
  for (const f of [-0.45, -0.28, 1.12, 1.30]) {
    const cy = (topPt + hPt * f) / vpH * rpH;
    for (let kx = 0; kx <= 20; kx++) {
      const cx = (x0 + (x1 - x0) * kx / 20) / vpW * rpW;
      const c = at(cx, cy); if (!finite(c)) continue; const k = bucket(c);
      const e = counts.get(k); if (e) e.n++; else counts.set(k, { n: 1, c });
    }
  }
  let bg: RGB = [255, 255, 255]; let bn = 0;
  counts.forEach((v) => { if (v.n > bn) { bn = v.n; bg = v.c; } });

  // Safety net: never let a dark sample blot a light page. If the chosen cover is
  // dark while the page is clearly light, use the page's paper colour instead.
  if (lum(bg) < 300 && lum(pageBg) > 660) bg = pageBg;

  return { color: `rgb(${dark[0]},${dark[1]},${dark[2]})`, bg: `rgb(${bg[0]},${bg[1]},${bg[2]})` };
}
