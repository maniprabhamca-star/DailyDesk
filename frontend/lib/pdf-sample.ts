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
const inkBucket = (c: RGB) => `${Math.round(c[0] / 8)}_${Math.round(c[1] / 8)}_${Math.round(c[2] / 8)}`;
const finite = (c: RGB) => Number.isFinite(c[0]) && Number.isFinite(c[1]) && Number.isFinite(c[2]);
const roundRgb = (r: number, g: number, b: number): RGB => [
  Math.max(0, Math.min(255, Math.round(r))),
  Math.max(0, Math.min(255, Math.round(g))),
  Math.max(0, Math.min(255, Math.round(b))),
];
const saturation = (c: RGB) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);

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
  // Ink = the solid interior of rendered glyphs, not the antialiased edge.
  // A sparse grid often lands on blended pixels, which makes red/blue text
  // visibly shift the moment the editable overlay appears.
  const inkCounts = new Map<string, { n: number; r: number; g: number; b: number; d: number; s: number }>();
  let darkest: RGB = [17, 24, 39];
  let darkestLum = 999;
  let inkTotal = 0;
  const pxX0 = Math.max(0, Math.floor(x0 / vpW * rpW));
  const pxX1 = Math.min(rpW - 1, Math.ceil(x1 / vpW * rpW));
  const pxY0 = Math.max(0, Math.floor((topPt + hPt * 0.08) / vpH * rpH));
  const pxY1 = Math.min(rpH - 1, Math.ceil((topPt + hPt * 0.92) / vpH * rpH));
  const stepX = Math.max(1, Math.floor(Math.max(1, pxX1 - pxX0) / 96));
  const stepY = Math.max(1, Math.floor(Math.max(1, pxY1 - pxY0) / 18));
  for (let y = pxY0; y <= pxY1; y += stepY) {
    for (let x = pxX0; x <= pxX1; x += stepX) {
      const c = at(x, y); if (!finite(c)) continue;
      const l = lum(c);
      if (l < darkestLum) { darkestLum = l; darkest = c; }
      const d = dist(c, pageBg);
      if (l >= 745 || d <= 42) continue;
      const k = inkBucket(c);
      const e = inkCounts.get(k);
      if (e) { e.n++; e.r += c[0]; e.g += c[1]; e.b += c[2]; e.d += d; e.s += saturation(c); }
      else inkCounts.set(k, { n: 1, r: c[0], g: c[1], b: c[2], d, s: saturation(c) });
      inkTotal++;
    }
  }
  let ink: RGB | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let maxN = 0;
  inkCounts.forEach((v) => { if (v.n > maxN) maxN = v.n; });
  const minN = Math.max(2, Math.floor(inkTotal * 0.006));
  inkCounts.forEach((v) => {
    if (v.n < minN && maxN > minN) return;
    const avg: RGB = roundRgb(v.r / v.n, v.g / v.n, v.b / v.n);
    const avgDist = v.d / v.n;
    const avgSat = v.s / v.n;
    const countBonus = Math.min(1, v.n / Math.max(1, maxN)) * 8;
    const score = avgDist * 1.45 + avgSat * 0.32 + countBonus;
    if (score > bestScore) {
      bestScore = score;
      ink = avg;
    }
  });
  const dark = ink ?? (darkestLum > 360 ? [17, 24, 39] as RGB : darkest);

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
