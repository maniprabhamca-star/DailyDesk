// Pure Bates-numbering helpers — NO pdf-lib/React, so they're unit-testable and
// shared by the live schematic preview AND the real stamp (lib/pdf-bates.ts), so
// the two can never drift. Bates numbering stamps a sequential legal identifier
// (PREFIX + zero-padded number + optional suffix) on every page, continuing across
// a whole set of files for discovery / case management.

export type BatesPosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc';

export type BatesOptions = {
  prefix: string;
  suffix: string;
  start: number;
  digits: number; // zero-pad width, e.g. 6 -> 000001
  position: BatesPosition;
  fontSize: number; // points
  fromPage?: number; // 1-based inclusive; default 1
  toPage?: number; // 1-based inclusive; default last page
};

export const BATES_MARGIN = 28; // pt from the page edge

// PREFIX + zero-padded number + suffix. Never truncates a number wider than
// `digits` (a real set that overruns its padding must keep counting, not wrap).
export function batesLabel(prefix: string, n: number, digits: number, suffix = ''): string {
  const num = String(Math.max(0, Math.floor(n)));
  const d = Math.max(0, Math.min(12, Math.floor(digits)));
  return `${prefix}${num.padStart(d, '0')}${suffix}`;
}

// Bottom-left origin (PDF user space). Returns the drawText baseline point.
export function batesXY(
  position: BatesPosition,
  pageW: number,
  pageH: number,
  textW: number,
  fontSize: number,
  margin = BATES_MARGIN,
): { x: number; y: number } {
  const ax = position[1] as 't' | 'l' | 'r' | 'c'; // second char: l|r|c
  const ay = position[0] as 't' | 'b'; // first char: t|b
  const x = ax === 'l' ? margin : ax === 'r' ? Math.max(margin, pageW - margin - textW) : (pageW - textW) / 2;
  const y = ay === 't' ? pageH - margin - fontSize : margin;
  return { x, y };
}

// Which 1-based pages get a stamp, clamped to the document.
export function pagesInRange(numPages: number, fromPage?: number, toPage?: number): number[] {
  const from = Math.max(1, Math.floor(fromPage || 1));
  const to = Math.min(numPages, Math.floor(toPage || numPages));
  const out: number[] = [];
  for (let p = from; p <= to; p++) out.push(p);
  return out;
}

// Validate + normalise user input into safe ranges.
export function normalizeOptions(o: Partial<BatesOptions>): BatesOptions {
  return {
    prefix: (o.prefix ?? '').slice(0, 40),
    suffix: (o.suffix ?? '').slice(0, 40),
    start: Number.isFinite(o.start) ? Math.max(0, Math.floor(o.start as number)) : 1,
    digits: Math.max(1, Math.min(10, Math.floor(o.digits ?? 6))),
    position: (['tl', 'tr', 'bl', 'br', 'tc', 'bc'] as BatesPosition[]).includes(o.position as BatesPosition)
      ? (o.position as BatesPosition)
      : 'br',
    fontSize: Math.max(6, Math.min(24, Math.floor(o.fontSize ?? 10))),
    fromPage: o.fromPage,
    toPage: o.toPage,
  };
}
