// Styled QR renderer. `qrcode`'s built-in drawing only does plain squares, so
// this paints the raw module matrix (QRCode.create().modules) with styled
// modules (square / rounded / dots), styled finder eyes, and an optional
// two-color diagonal gradient — on any 2D canvas context. No DOM APIs are
// used beyond the ctx, so the SAME code runs in the browser and in
// @napi-rs/canvas for the scannability gate (dev-harness/qr-style-qa.js
// decodes every style combination with jsQR before ship).
//
// Scannability constraints baked in (values are the ones that pass the jsQR
// decode matrix — do not shrink without re-running the gate): dots keep 92%
// of the module diameter and the timing patterns stay solid squares in dots
// mode; rounded modules cover 96% with a 32% corner radius; finder eyes stay
// solid-contrast.

export type ModuleShape = 'square' | 'rounded' | 'dots';
export type EyeShape = 'square' | 'rounded';

export type QrMatrix = { size: number; get: (row: number, col: number) => boolean };

export type QrStyle = {
  fg: string;
  fg2?: string | null; // gradient end color; null/undefined = solid fg
  bg: string;
  moduleShape: ModuleShape;
  eyeShape: EyeShape;
};

// Adapt qrcode's BitMatrix ({ size, data: Uint8Array }) to a safe accessor.
export function toMatrix(modules: { size: number; data: Uint8Array | number[] | boolean[] }): QrMatrix {
  const { size, data } = modules;
  return { size, get: (r, c) => !!data[r * size + c] };
}

// The three 7x7 finder patterns live at (0,0), (0,N-7), (N-7,0).
function eyeOrigin(size: number, which: 0 | 1 | 2): [number, number] {
  return which === 0 ? [0, 0] : which === 1 ? [0, size - 7] : [size - 7, 0];
}

function inAnyEye(size: number, r: number, c: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
}

// Row/column 6 hold the timing patterns — decoders sample them to find the
// module grid, so in dots mode they stay solid squares (also the standard
// look for dot-style QR codes).
function isTiming(r: number, c: number): boolean {
  return r === 6 || c === 6;
}

// Alignment-pattern center coordinates per QR version (ISO/IEC 18004 table).
// Decoders use these 5x5 patterns to correct grid sampling on larger codes,
// so in dots mode they stay solid squares too — without this, dot codes fail
// to decode at high resolution (caught by the jsQR gate).
const ALIGN: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
  [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
  [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

function isAlignment(size: number, r: number, c: number): boolean {
  const version = (size - 17) / 4;
  const centers = ALIGN[version] ?? [];
  const last = size - 7;
  for (const cy of centers) {
    for (const cx of centers) {
      // Centers that would collide with the three finder patterns don't exist.
      if ((cy === 6 && cx === 6) || (cy === 6 && cx === last) || (cy === last && cx === 6)) continue;
      if (Math.abs(r - cy) <= 2 && Math.abs(c - cx) <= 2) return true;
    }
  }
  return false;
}

// Structural modules that must stay solid squares in dots mode.
function isStructural(size: number, r: number, c: number): boolean {
  return isTiming(r, c) || isAlignment(size, r, c);
}

type Ctx = CanvasRenderingContext2D;

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Paint the full styled code onto a square canvas context.
// sizePx must already be set as the canvas width/height by the caller.
export function paintQr(ctx: Ctx, matrix: QrMatrix, sizePx: number, marginModules: number, style: QrStyle): void {
  const n = matrix.size;
  const total = n + marginModules * 2;
  const cell = sizePx / total;
  const off = marginModules * cell;

  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, sizePx, sizePx);

  let fill: string | CanvasGradient = style.fg;
  if (style.fg2) {
    const g = ctx.createLinearGradient(0, 0, sizePx, sizePx);
    g.addColorStop(0, style.fg);
    g.addColorStop(1, style.fg2);
    fill = g;
  }
  ctx.fillStyle = fill;

  // Data modules (finder zones are drawn separately below).
  ctx.beginPath();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix.get(r, c) || inAnyEye(n, r, c)) continue;
      const x = off + c * cell;
      const y = off + r * cell;
      if (style.moduleShape === 'square' || (style.moduleShape === 'dots' && isStructural(n, r, c))) {
        // Tiny overlap hides antialiasing seams between neighbours.
        ctx.rect(x, y, cell + 0.5, cell + 0.5);
      } else if (style.moduleShape === 'dots') {
        const rad = cell * 0.5; // full inscribed circle — neighbours touch, decode-safe
        ctx.moveTo(x + cell / 2 + rad, y + cell / 2);
        ctx.arc(x + cell / 2, y + cell / 2, rad, 0, Math.PI * 2);
      } else {
        roundRectPath(ctx, x + cell * 0.02, y + cell * 0.02, cell * 0.96, cell * 0.96, cell * 0.32);
      }
    }
  }
  ctx.fill();

  // Finder eyes: 7x7 ring (with a 5x5 hole) + solid 3x3 pupil.
  const eyeR = (w: number) => (style.eyeShape === 'rounded' ? w * 0.32 : 0);
  for (const which of [0, 1, 2] as const) {
    const [er, ec] = eyeOrigin(n, which);
    const x = off + ec * cell;
    const y = off + er * cell;
    ctx.fillStyle = fill;
    ctx.beginPath();
    roundRectPath(ctx, x, y, cell * 7, cell * 7, eyeR(cell * 7));
    ctx.fill();
    ctx.fillStyle = style.bg;
    ctx.beginPath();
    roundRectPath(ctx, x + cell, y + cell, cell * 5, cell * 5, eyeR(cell * 5));
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    roundRectPath(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, eyeR(cell * 3));
    ctx.fill();
  }
}

// SVG twin of paintQr — same geometry in module units, so the export matches
// the preview exactly. viewBox is "0 0 S S" (S = size + 2*margin), matching
// what qrcode's own SVG used, so the existing logo-overlay injection keeps
// working unchanged.
export function svgQr(matrix: QrMatrix, marginModules: number, style: QrStyle): string {
  const n = matrix.size;
  const S = n + marginModules * 2;
  const m = marginModules;
  const num = (v: number) => +v.toFixed(3);

  const fillRef = style.fg2 ? 'url(#qg)' : style.fg;
  const defs = style.fg2
    ? `<defs><linearGradient id="qg" x1="0" y1="0" x2="${S}" y2="${S}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></linearGradient></defs>`
    : '';

  const parts: string[] = [];
  if (style.moduleShape === 'square') {
    // One compact path for all modules.
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!matrix.get(r, c) || inAnyEye(n, r, c)) continue;
        d += `M${c + m} ${r + m}h1v1h-1z`;
      }
    }
    parts.push(`<path d="${d}" fill="${fillRef}"/>`);
  } else if (style.moduleShape === 'dots') {
    let timing = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!matrix.get(r, c) || inAnyEye(n, r, c)) continue;
        if (isStructural(n, r, c)) timing += `M${c + m} ${r + m}h1v1h-1z`;
        else parts.push(`<circle cx="${num(c + m + 0.5)}" cy="${num(r + m + 0.5)}" r="0.5" fill="${fillRef}"/>`);
      }
    }
    if (timing) parts.push(`<path d="${timing}" fill="${fillRef}"/>`);
  } else {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!matrix.get(r, c) || inAnyEye(n, r, c)) continue;
        parts.push(`<rect x="${num(c + m + 0.02)}" y="${num(r + m + 0.02)}" width="0.96" height="0.96" rx="0.32" fill="${fillRef}"/>`);
      }
    }
  }

  // Eyes: outer ring via even-odd path (7x7 minus 5x5), then the 3x3 pupil.
  const rr = (w: number) => (style.eyeShape === 'rounded' ? num(w * 0.32) : 0);
  const rectPath = (x: number, y: number, w: number, r: number) =>
    r > 0
      ? `M${num(x + r)} ${y}h${num(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${num(w - 2 * r)}a${r} ${r} 0 0 1 -${r} ${r}h-${num(w - 2 * r)}a${r} ${r} 0 0 1 -${r} -${r}v-${num(w - 2 * r)}a${r} ${r} 0 0 1 ${r} -${r}z`
      : `M${x} ${y}h${w}v${w}h-${w}z`;
  for (const which of [0, 1, 2] as const) {
    const [er, ec] = eyeOrigin(n, which);
    const x = ec + m;
    const y = er + m;
    parts.push(`<path d="${rectPath(x, y, 7, rr(7))}${rectPath(x + 1, y + 1, 5, rr(5))}" fill="${fillRef}" fill-rule="evenodd"/>`);
    parts.push(`<path d="${rectPath(x + 2, y + 2, 3, rr(3))}" fill="${fillRef}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="geometricPrecision">${defs}<rect width="${S}" height="${S}" fill="${style.bg}"/>${parts.join('')}</svg>`;
}
