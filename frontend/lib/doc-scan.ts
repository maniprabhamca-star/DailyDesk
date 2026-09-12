/**
 * Document detection and flattening — the part that makes this a scanner
 * rather than a camera with a shutter.
 *
 * Given a video frame, find the sheet of paper in it and return its four
 * corners; given those corners, rebuild the page as a flat rectangle with the
 * background and the perspective removed. That is what a phone scanner app
 * does, and it is the difference between "a photo of a document taken at an
 * angle on a desk" and "a document".
 *
 * ── Why this is hand-written and not OpenCV.js ──────────────────────────────
 * OpenCV.js is the obvious way to get findContours and warpPerspective, and it
 * is about 8MB of WebAssembly. Every DiemDesk tool runs in the browser, so a
 * payload is not a build statistic here — it is how long someone stares at a
 * blank screen on a phone before they can photograph anything. The pieces
 * actually needed are a Sobel operator, a border-following contour tracer, a
 * polygon simplifier and an 8x8 solve; together they are a few hundred lines
 * and no download at all.
 *
 * ── The pipeline ────────────────────────────────────────────────────────────
 *   detectDocument()  frame -> grayscale -> blur -> Sobel -> threshold ->
 *                     contours -> polygon approximation -> best quadrilateral
 *   flattenDocument() full-res frame + quad -> homography -> bilinear resample
 *
 * Detection runs on a ~320px-wide copy: a page occupies a large part of the
 * frame, so its edges survive the downscale, and the cost drops by the square
 * of the scale factor. Flattening runs on the full frame, because that is the
 * pixels the person actually keeps.
 */

export type Point = { x: number; y: number };
/** Corners in reading order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** How much of the frame a candidate must cover before it is believable. */
const MIN_AREA_FRACTION = 0.12;
/** ...and how much is so much that it is probably the frame border itself. */
const MAX_AREA_FRACTION = 0.98;
/** Working width for detection. Big enough to keep page edges, small enough to be cheap. */
const WORK_WIDTH = 320;

// ── small helpers ───────────────────────────────────────────────────────────

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.abs(a / 2);
}

/** Convex in the sense that matters here: every turn goes the same way. */
function isConvex(pts: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/**
 * Put four corners into reading order.
 *
 * Sorting by angle around the centroid is the usual trick and it is enough:
 * the four points of a page are always distinct directions from its middle.
 * Then rotate so the first is the one closest to the top-left, which is what
 * makes "top edge" mean the top edge when the page is flattened.
 */
function orderCorners(pts: Point[]): Quad {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const byAngle = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0, best = Infinity;
  for (let i = 0; i < byAngle.length; i++) {
    const d = byAngle[i].x + byAngle[i].y; // smallest x+y is the top-left corner
    if (d < best) { best = d; start = i; }
  }
  return [
    byAngle[start % 4],
    byAngle[(start + 1) % 4],
    byAngle[(start + 2) % 4],
    byAngle[(start + 3) % 4],
  ] as Quad;
}

// ── stage 1: grayscale + blur ───────────────────────────────────────────────

function toGray(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return g;
}

/**
 * Two box blurs in a row, which is a cheap and close-enough Gaussian. Blurring
 * first matters: without it the Sobel pass lights up paper texture, print and
 * sensor noise as brightly as the edge of the sheet, and the contour tracer
 * then has thousands of tiny shapes to wade through.
 */
function blur(src: Float32Array, w: number, h: number, radius = 2): Float32Array {
  const pass = (input: Float32Array): Float32Array => {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const norm = 1 / (radius * 2 + 1);
    for (let y = 0; y < h; y++) {            // horizontal
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += input[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum * norm;
        sum -= input[y * w + Math.min(w - 1, Math.max(0, x - radius))];
        sum += input[y * w + Math.min(w - 1, Math.max(0, x + radius + 1))];
      }
    }
    for (let x = 0; x < w; x++) {            // vertical
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum * norm;
        sum -= tmp[Math.min(h - 1, Math.max(0, y - radius)) * w + x];
        sum += tmp[Math.min(h - 1, Math.max(0, y + radius + 1)) * w + x];
      }
    }
    return out;
  };
  return pass(pass(src));
}

// ── stage 2: edges ──────────────────────────────────────────────────────────

/**
 * Sobel magnitude, then a threshold chosen from the image itself rather than a
 * constant. A page on a dark desk and a page on a pale one produce very
 * different gradient magnitudes, so a fixed number works for one and not the
 * other; keeping the strongest few per cent of gradients works for both.
 */
function edges(gray: Float32Array, w: number, h: number): Uint8Array {
  const mag = new Float32Array(w * h);
  let max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
        + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m > max) max = m;
    }
  }
  if (max <= 0) return new Uint8Array(w * h);

  // Histogram percentile: keep the top ~8% of gradient magnitudes.
  const BINS = 256;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < mag.length; i++) hist[Math.min(BINS - 1, (mag[i] / max * (BINS - 1)) | 0)]++;
  const wanted = Math.floor(mag.length * 0.08);
  let acc = 0, bin = BINS - 1;
  for (; bin > 0; bin--) { acc += hist[bin]; if (acc >= wanted) break; }
  const threshold = (bin / (BINS - 1)) * max;

  const out = new Uint8Array(w * h);
  for (let i = 0; i < mag.length; i++) out[i] = mag[i] >= threshold ? 1 : 0;
  return out;
}

// ── stage 3: contours ───────────────────────────────────────────────────────

/**
 * Moore-neighbour border following. Walks the outside of each blob of edge
 * pixels once and returns it as a closed path.
 *
 * Only outer borders are traced. The inside of a page is full of holes — every
 * letter of text is one — and none of them is ever the shape we are looking
 * for.
 */
function findContours(bin: Uint8Array, w: number, h: number): Point[][] {
  const seen = new Uint8Array(w * h);
  const contours: Point[][] = [];
  // Clockwise from due east.
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!bin[i] || seen[i]) continue;
      if (bin[i - 1]) continue;              // not a left-hand border pixel; skip

      const contour: Point[] = [];
      let cx = x, cy = y, dir = 7;
      const startX = x, startY = y;
      let guard = 0;
      do {
        contour.push({ x: cx, y: cy });
        seen[cy * w + cx] = 1;
        let found = false;
        for (let k = 0; k < 8; k++) {
          const nd = (dir + k) % 8;
          const nx = cx + dx[nd], ny = cy + dy[nd];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!bin[ny * w + nx]) continue;
          cx = nx; cy = ny;
          dir = (nd + 5) % 8;                // back up, then keep sweeping
          found = true;
          break;
        }
        if (!found) break;                   // isolated pixel
      } while ((cx !== startX || cy !== startY) && ++guard < 20000);

      if (contour.length >= 16) contours.push(contour);
    }
  }
  return contours;
}

const pointSegmentDistance = (p: Point, a: Point, b: Point): number => {
  const vx = b.x - a.x, vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
};

/**
 * Pull the four corners straight out of a traced outline.
 *
 * Douglas-Peucker is the textbook way to simplify a path and it is the wrong
 * tool here. It pins the first and last point it is given and never drops
 * them, and a closed contour's first and last points are neighbours — so the
 * line between them is degenerate, every other point measures as enormously
 * far from it, and the recursion keeps splitting. Measured: a clean rectangle
 * came back as five vertices at every epsilon from 0.02 to 0.06, so no
 * quadrilateral was ever found even though the contour itself was correct.
 * Rotating the start to a corner does not help, for the same reason.
 *
 * Since a quadrilateral is precisely what we want, ask for one directly:
 *
 *   1. the point farthest from the centroid is a corner
 *   2. the point farthest from THAT is the opposite corner
 *   3. the diagonal between them splits the outline in two, and the farthest
 *      point on each side is the remaining corner of that side
 *
 * This always returns four points, including for shapes that are not
 * quadrilaterals at all — so it also reports how well those four actually
 * explain the outline. `fit` is the mean distance from the traced points to the
 * nearest edge of the quad, as a fraction of the quad's size. A page is a few
 * per cent; a circle or an L-shape is not, and the caller rejects it.
 */
function quadFromContour(contour: Point[]): { quad: Point[]; fit: number } | null {
  if (contour.length < 8) return null;

  let cx = 0, cy = 0;
  for (const p of contour) { cx += p.x; cy += p.y; }
  cx /= contour.length; cy /= contour.length;

  const farthestFrom = (measure: (p: Point) => number): number => {
    let idx = 0, best = -Infinity;
    for (let i = 0; i < contour.length; i++) {
      const d = measure(contour[i]);
      if (d > best) { best = d; idx = i; }
    }
    return idx;
  };

  const iA = farthestFrom((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2);
  const A = contour[iA];
  const iC = farthestFrom((p) => (p.x - A.x) ** 2 + (p.y - A.y) ** 2);
  const C = contour[iC];

  // Walk each side of the diagonal separately: the outline is a loop, so the
  // stretch from A to C one way and from C back to A the other way are the two
  // sides, and each contributes one corner.
  const lo = Math.min(iA, iC), hi = Math.max(iA, iC);
  const sideOne = contour.slice(lo, hi + 1);
  const sideTwo = contour.slice(hi).concat(contour.slice(0, lo + 1));
  const pickFar = (side: Point[]): Point | null => {
    let best: Point | null = null, bestD = -1;
    for (const p of side) {
      const d = pointSegmentDistance(p, A, C);
      if (d > bestD) { bestD = d; best = p; }
    }
    return bestD > 0 ? best : null;
  };
  const B = pickFar(sideOne);
  const D = pickFar(sideTwo);
  if (!B || !D) return null;

  const quad = [A, B, C, D];
  // How much of the outline these four corners actually account for.
  let total = 0;
  for (const p of contour) {
    let nearest = Infinity;
    for (let i = 0; i < 4; i++) {
      nearest = Math.min(nearest, pointSegmentDistance(p, quad[i], quad[(i + 1) % 4]));
    }
    total += nearest;
  }
  const size = Math.sqrt(Math.max(1, polygonArea(quad)));
  return { quad, fit: total / contour.length / size };
}


// ── the detector ────────────────────────────────────────────────────────────

/**
 * Find the document in a frame.
 *
 * Returns corners in the coordinate space of the ORIGINAL frame, not the
 * downscaled working copy, so the caller never has to think about the scale
 * factor. Null means nothing convincing was found — which is a normal answer,
 * not a failure, and the UI should say "no document yet" rather than guess.
 */
export function detectDocument(frame: ImageData): Quad | null {
  const { width: fw, height: fh } = frame;
  if (fw < 32 || fh < 32) return null;

  // Work small. Nearest-neighbour is fine — we blur immediately afterwards.
  const scale = Math.min(1, WORK_WIDTH / fw);
  const w = Math.max(16, Math.round(fw * scale));
  const h = Math.max(16, Math.round(fh * scale));
  const small = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(fh - 1, Math.round(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(fw - 1, Math.round(x / scale));
      const s = (sy * fw + sx) * 4, d = (y * w + x) * 4;
      small[d] = frame.data[s]; small[d + 1] = frame.data[s + 1];
      small[d + 2] = frame.data[s + 2]; small[d + 3] = 255;
    }
  }

  const bin = edges(blur(toGray(small, w, h), w, h), w, h);
  const frameArea = w * h;
  let best: { quad: Quad; area: number } | null = null;

  for (const contour of findContours(bin, w, h)) {
    const perimeter = contour.reduce((s, p, i) => s + (i ? dist(contour[i - 1], p) : 0), 0);
    if (perimeter < (w + h) * 0.5) continue;             // too small to be a page

    const candidate = quadFromContour(contour);
    // 0.035 = the traced outline sits, on average, within 3.5% of the quad's
    // own size of one of its four edges. A page clears this comfortably; a
    // rounded or irregular blob does not, which is what stops the detector
    // drawing a confident rectangle around a coffee cup.
    if (candidate && candidate.fit < 0.035 && isConvex(candidate.quad)) {
      const pts = candidate.quad;
      const area = polygonArea(pts);
      if (area < frameArea * MIN_AREA_FRACTION || area > frameArea * MAX_AREA_FRACTION) continue;

      // Reject slivers: a page seen from any usable angle still has sides that
      // are within about 6:1 of each other.
      const q = orderCorners(pts);
      const sides = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
      const shortest = Math.min(...sides), longest = Math.max(...sides);
      if (shortest <= 0 || longest / shortest > 6) continue;

      if (!best || area > best.area) best = { quad: q, area };
    }
  }

  if (!best) return null;
  return best.quad.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad;
}

// ── perspective ─────────────────────────────────────────────────────────────

/**
 * The 8 coefficients mapping the unit-ish destination rectangle back onto the
 * quad in the source image. Solved by plain Gaussian elimination with partial
 * pivoting — it is an 8x8, once per capture, and clarity is worth more here
 * than cleverness.
 */
function homography(dst: Quad, src: Quad): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = dst[i];
    const { x, y } = src[i];
    A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]); b.push(x);
    A.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]); b.push(y);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    if (Math.abs(A[pivot][col]) < 1e-9) return null;     // degenerate quad
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (!f) continue;
      for (let c = col; c < 8; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

/**
 * The page's true proportions, recovered from the quad.
 *
 * Averaging opposite sides is a deliberate approximation. The exact answer
 * needs the camera's focal length, which a browser does not hand out; the
 * approximation is off by a few per cent at the angles people actually hold a
 * phone, and a few per cent on a page of text is invisible. Getting it roughly
 * right matters far more than the alternative, which was every scan coming out
 * stretched to whatever shape the sensor happened to be.
 */
function targetSize(q: Quad, cap = 2200): { w: number; h: number } {
  const top = dist(q[0], q[1]), bottom = dist(q[3], q[2]);
  const left = dist(q[0], q[3]), right = dist(q[1], q[2]);
  let w = Math.max(1, (top + bottom) / 2);
  let h = Math.max(1, (left + right) / 2);
  const s = Math.min(1, cap / Math.max(w, h));
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));
  return { w, h };
}

/**
 * Rebuild the quad as a flat page: perspective removed, everything outside the
 * document gone. Bilinear sampling, because nearest-neighbour on small text is
 * the difference between readable and not.
 */
export function flattenDocument(frame: ImageData, quad: Quad, cap = 2200): ImageData | null {
  const { w: dw, h: dh } = targetSize(quad, cap);
  const dstQuad: Quad = [
    { x: 0, y: 0 }, { x: dw - 1, y: 0 }, { x: dw - 1, y: dh - 1 }, { x: 0, y: dh - 1 },
  ];
  const H = homography(dstQuad, quad);
  if (!H) return null;

  const [a, b, c, d, e, f, g, i] = H;
  // `new ImageData` where it exists, a plain equivalent where it does not.
  // Browsers all have the constructor; jsdom does not, and the whole pipeline
  // is otherwise pure arithmetic that can be tested without a canvas. Refusing
  // to run outside a browser would mean this code could only ever be checked by
  // pointing a camera at something, which is not a test.
  const out: ImageData = typeof ImageData === 'function'
    ? new ImageData(dw, dh)
    : { width: dw, height: dh, data: new Uint8ClampedArray(dw * dh * 4), colorSpace: 'srgb' } as ImageData;
  const src = frame.data, sw = frame.width, sh = frame.height;

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const den = g * x + i * y + 1;
      const sx = (a * x + b * y + c) / den;
      const sy = (d * x + e * y + f) / den;
      const o = (y * dw + x) * 4;
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) { out.data[o + 3] = 255; continue; }

      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const p00 = (y0 * sw + x0) * 4, p10 = (y0 * sw + x1) * 4;
      const p01 = (y1 * sw + x0) * 4, p11 = (y1 * sw + x1) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = src[p00 + ch] * (1 - fx) + src[p10 + ch] * fx;
        const bot = src[p01 + ch] * (1 - fx) + src[p11 + ch] * fx;
        out.data[o + ch] = top * (1 - fy) + bot * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/**
 * How settled a detection is, 0..1, from how far the corners have moved.
 *
 * Auto-capture needs to know the difference between a page being framed and a
 * page being held still. Comparing corner positions between frames is enough,
 * normalised by the frame size so it means the same thing on any resolution.
 */
export function quadStability(a: Quad | null, b: Quad | null, frameDiagonal: number): number {
  if (!a || !b || frameDiagonal <= 0) return 0;
  let total = 0;
  for (let i = 0; i < 4; i++) total += dist(a[i], b[i]);
  const avg = total / 4 / frameDiagonal;
  return Math.max(0, Math.min(1, 1 - avg * 25));
}
