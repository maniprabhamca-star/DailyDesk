'use client';

// Measure what compression actually did to a page.
//
// The quality preview renders page 1 exactly as the chosen level will produce
// it, and then asks the reader to spot the difference. At the gentler levels
// there is nothing to spot — which is the promise being kept, but it reads as a
// broken feature. So instead of asking, we measure: a difference map showing
// WHERE the page changed, and an SSIM score saying HOW MUCH.
//
// Everything here works on the two bitmaps already rendered in the browser.
// Nothing is estimated or projected — this is the real output, measured.

export type DiffResult = {
  /** Blob URL of the amplified difference map. Revoke when done. */
  heatmapUrl: string;
  /** Mean SSIM across the page, 0–100. 100 = pixel-identical. */
  match: number;
  /** Worst-affected region, in 0–1 fractions of the page. Null if nothing changed. */
  worst: { x: number; y: number; w: number; h: number } | null;
};

// The comparison runs at the COMPRESSED page's own size, capped for speed.
//
// This matters more than it looks. Compression does two separate things: it
// resizes the page, and it re-encodes it as JPEG. Only the second is quality
// loss — resizing is the point of the exercise. Drawing the two pages to some
// third size put the original through a different resampling path than the
// compressed one, so every edge landed a fraction of a pixel apart and the map
// lit up along every line. On an engraving that meant the whole illustration
// glowed, directly under a sentence saying nothing had changed.
//
// Measured on a book scan (1320px original, 1100px compressed):
//   both scaled to 900        17.3% of the page lit
//   resizing alone, no JPEG    9.9%   <- over half of the above was this
//   JPEG damage alone         12.5%
//
// Rendering the original AT the compressed size makes the resize common to both
// sides, so it cancels, and what is left is the part worth showing.
const WORK_MAX = 1400;
const WIN = 8; // SSIM window, px

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('preview image could not be read'));
    img.src = url;
  });
}

function drawTo(img: HTMLImageElement, w: number, h: number): ImageData {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas context');
  // White ground: PDF pages are white, and a transparent edge would otherwise
  // read as a huge difference against an opaque one.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  c.width = c.height = 0;
  return data;
}

function luma(d: Uint8ClampedArray, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) out[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  return out;
}

// Scanned paper carries heavy grain, and ANY re-encode alters that grain. Left
// alone it dominates the comparison: measured on a real 27MB book scan, raw
// SSIM read 88.2 at Light and 87.0 at Maximum — a 1.2 point spread across the
// entire range, which tells a reader nothing. A 3x3 box blur on both sides
// suppresses grain so what remains is structural loss, which is what the levels
// actually differ in. Applied to BOTH sides, so it cannot flatter either.
function denoise(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? y - 1 : 0, y1 = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0, x1 = x < w - 1 ? x + 1 : w - 1;
      out[y * w + x] = (
        src[y0 * w + x0] + src[y0 * w + x] + src[y0 * w + x1] +
        src[y * w + x0] + src[y * w + x] + src[y * w + x1] +
        src[y1 * w + x0] + src[y1 * w + x] + src[y1 * w + x1]
      ) / 9;
    }
  }
  return out;
}

// Structural similarity over 8x8 windows — the standard perceptual measure, and
// far more honest than "mean pixel difference", which barely moves even when a
// page is visibly mushy.
function ssim(a: Float32Array, b: Float32Array, w: number, h: number): { mean: number; worst: { x: number; y: number; w: number; h: number } | null } {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let total = 0;
  let count = 0;
  let worstVal = 2;
  let worstX = 0, worstY = 0;

  for (let y = 0; y + WIN <= h; y += WIN) {
    for (let x = 0; x + WIN <= w; x += WIN) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let j = 0; j < WIN; j++) {
        const row = (y + j) * w + x;
        for (let i = 0; i < WIN; i++) {
          const va = a[row + i], vb = b[row + i];
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
        }
      }
      const n = WIN * WIN;
      const ma = sa / n, mb = sb / n;
      const va = saa / n - ma * ma;
      const vb = sbb / n - mb * mb;
      const cov = sab / n - ma * mb;
      const s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      total += s;
      count++;
      // Flat white margins are identical everywhere and would win "worst" ties;
      // only consider windows with some actual content.
      if (s < worstVal && (va > 25 || vb > 25)) { worstVal = s; worstX = x; worstY = y; }
    }
  }
  if (!count) return { mean: 1, worst: null };
  const mean = total / count;
  // A 3x3 window cluster reads better than a lone 8px square.
  const span = WIN * 3;
  const worst = worstVal < 0.999
    ? {
        x: Math.max(0, worstX - WIN) / w,
        y: Math.max(0, worstY - WIN) / h,
        w: Math.min(span, w) / w,
        h: Math.min(span, h) / h,
      }
    : null;
  return { mean, worst };
}

export async function diffPages(beforeUrl: string, afterUrl: string): Promise<DiffResult> {
  const [ia, ib] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);
  const outW = ib.naturalWidth || ib.width;
  const outH = ib.naturalHeight || ib.height;
  if (!outW || !outH || !(ia.naturalWidth || ia.width)) throw new Error('preview image has no size');

  // Target = the compressed page's own size (capped). At scale 1 the compressed
  // side is copied pixel-for-pixel and only the original is resampled — which
  // is exactly the resize the compressor performed, so it stops registering as
  // a difference.
  const scale = Math.min(1, WORK_MAX / Math.max(outW, outH));
  const w = Math.max(WIN, Math.round(outW * scale));
  const h = Math.max(WIN, Math.round(outH * scale));

  const da = drawTo(ia, w, h);
  const db = drawTo(ib, w, h);
  const n = w * h;
  const la = luma(da.data, n);
  const lb = luma(db.data, n);

  // Both the score and the map run on the grain-suppressed pair. Drawing the
  // map from the raw pair lit 35% of a page at Light — all of it grain, none of
  // it loss — which is exactly the "everything looks the same / everything
  // looks changed" confusion this feature exists to end.
  const ga = denoise(la, w, h);
  const gb = denoise(lb, w, h);
  const { mean, worst } = ssim(ga, gb, w, h);

  // Difference map. Amplified hard, because the differences that matter here
  // are small: a x1 map of a Light pass is pure black and tells nobody anything.
  const out = new ImageData(w, h);
  const o = out.data;
  const AMP = 10;
  const FLOOR = 2.5; // below this is grain the eye will never see; keep it black
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const raw = Math.abs(ga[i] - gb[i]);
    const d = raw <= FLOOR ? 0 : Math.min(255, (raw - FLOOR) * AMP);
    // Black where nothing moved, through amber, to red where it moved most —
    // legible on any background, and reads as "heat" without a legend.
    o[p] = Math.min(255, d * 2.2);
    o[p + 1] = Math.min(255, d * 1.1);
    o[p + 2] = Math.min(255, d * 0.35);
    o[p + 3] = 255;
  }

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.putImageData(out, 0, 0);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  c.width = c.height = 0;
  if (!blob) throw new Error('difference map could not be encoded');

  return {
    heatmapUrl: URL.createObjectURL(blob),
    match: Math.max(0, Math.min(100, mean * 100)),
    worst,
  };
}

// One plain sentence about what the number means. Replaces "hover to spot the
// difference", which was asking readers to find something that is often not
// there by design.
// Thresholds calibrated against real measurements, not guessed: a 27MB book
// scan reads 95.5 at Light and 95.1 at Maximum, because every level clamps that
// page to the same readability floor and only JPEG quality differs. An earlier
// cut called 95 "slight softening", which contradicted the tool's own "Best
// quality" label on the very same screen.
// Tightened 2026-08-23 after the difference map was fixed to exclude resizing.
// The old bands called 94.9 "no meaningful visible change" while the map showed
// 16% of that same page had lost detail — the words and the picture disagreed,
// and the picture was right. On a dense engraving at quality 52 fine hatching
// genuinely goes. Saying "slight softening" is not a worse product; it is a
// true one, and the levels are named relative to each other anyway.
export function describeMatch(match: number): string {
  if (match >= 99) return 'This page came through unchanged — only images larger than they display were shrunk. Text was not touched.';
  if (match >= 96.5) return 'No meaningful visible change on this page. What did change is confined to photographic areas; text was not touched.';
  if (match >= 93) return 'Slight softening in the detailed areas — fine lines and shading. Text stays sharp and selectable.';
  if (match >= 88) return 'Noticeable softening where the page has photos, shading or fine line work. Text stays sharp and selectable.';
  return 'Heavy compression — photographs and detailed artwork are visibly rougher. Text stays sharp and selectable.';
}
