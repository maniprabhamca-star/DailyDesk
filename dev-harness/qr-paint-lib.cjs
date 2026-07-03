var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// frontend/lib/qr-paint.ts
var qr_paint_exports = {};
__export(qr_paint_exports, {
  paintQr: () => paintQr,
  svgQr: () => svgQr,
  toMatrix: () => toMatrix
});
module.exports = __toCommonJS(qr_paint_exports);
function toMatrix(modules) {
  const { size, data } = modules;
  return { size, get: (r, c) => !!data[r * size + c] };
}
function eyeOrigin(size, which) {
  return which === 0 ? [0, 0] : which === 1 ? [0, size - 7] : [size - 7, 0];
}
function inAnyEye(size, r, c) {
  return r < 7 && c < 7 || r < 7 && c >= size - 7 || r >= size - 7 && c < 7;
}
function isTiming(r, c) {
  return r === 6 || c === 6;
}
var ALIGN = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170]
];
function isAlignment(size, r, c) {
  const version = (size - 17) / 4;
  const centers = ALIGN[version] ?? [];
  const last = size - 7;
  for (const cy of centers) {
    for (const cx of centers) {
      if (cy === 6 && cx === 6 || cy === 6 && cx === last || cy === last && cx === 6) continue;
      if (Math.abs(r - cy) <= 2 && Math.abs(c - cx) <= 2) return true;
    }
  }
  return false;
}
function isStructural(size, r, c) {
  return isTiming(r, c) || isAlignment(size, r, c);
}
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function paintQr(ctx, matrix, sizePx, marginModules, style) {
  const n = matrix.size;
  const total = n + marginModules * 2;
  const cell = sizePx / total;
  const off = marginModules * cell;
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, sizePx, sizePx);
  let fill = style.fg;
  if (style.fg2) {
    const g = ctx.createLinearGradient(0, 0, sizePx, sizePx);
    g.addColorStop(0, style.fg);
    g.addColorStop(1, style.fg2);
    fill = g;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix.get(r, c) || inAnyEye(n, r, c)) continue;
      const x = off + c * cell;
      const y = off + r * cell;
      if (style.moduleShape === "square" || style.moduleShape === "dots" && isStructural(n, r, c)) {
        ctx.rect(x, y, cell + 0.5, cell + 0.5);
      } else if (style.moduleShape === "dots") {
        const rad = cell * 0.5;
        ctx.moveTo(x + cell / 2 + rad, y + cell / 2);
        ctx.arc(x + cell / 2, y + cell / 2, rad, 0, Math.PI * 2);
      } else {
        roundRectPath(ctx, x + cell * 0.02, y + cell * 0.02, cell * 0.96, cell * 0.96, cell * 0.32);
      }
    }
  }
  ctx.fill();
  const eyeR = (w) => style.eyeShape === "rounded" ? w * 0.32 : 0;
  for (const which of [0, 1, 2]) {
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
function svgQr(matrix, marginModules, style) {
  const n = matrix.size;
  const S = n + marginModules * 2;
  const m = marginModules;
  const num = (v) => +v.toFixed(3);
  const fillRef = style.fg2 ? "url(#qg)" : style.fg;
  const defs = style.fg2 ? `<defs><linearGradient id="qg" x1="0" y1="0" x2="${S}" y2="${S}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></linearGradient></defs>` : "";
  const parts = [];
  if (style.moduleShape === "square") {
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!matrix.get(r, c) || inAnyEye(n, r, c)) continue;
        d += `M${c + m} ${r + m}h1v1h-1z`;
      }
    }
    parts.push(`<path d="${d}" fill="${fillRef}"/>`);
  } else if (style.moduleShape === "dots") {
    let timing = "";
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
  const rr = (w) => style.eyeShape === "rounded" ? num(w * 0.32) : 0;
  const rectPath = (x, y, w, r) => r > 0 ? `M${num(x + r)} ${y}h${num(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${num(w - 2 * r)}a${r} ${r} 0 0 1 -${r} ${r}h-${num(w - 2 * r)}a${r} ${r} 0 0 1 -${r} -${r}v-${num(w - 2 * r)}a${r} ${r} 0 0 1 ${r} -${r}z` : `M${x} ${y}h${w}v${w}h-${w}z`;
  for (const which of [0, 1, 2]) {
    const [er, ec] = eyeOrigin(n, which);
    const x = ec + m;
    const y = er + m;
    parts.push(`<path d="${rectPath(x, y, 7, rr(7))}${rectPath(x + 1, y + 1, 5, rr(5))}" fill="${fillRef}" fill-rule="evenodd"/>`);
    parts.push(`<path d="${rectPath(x + 2, y + 2, 3, rr(3))}" fill="${fillRef}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="geometricPrecision">${defs}<rect width="${S}" height="${S}" fill="${style.bg}"/>${parts.join("")}</svg>`;
}
