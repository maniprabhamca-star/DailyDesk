// Human-friendly elapsed time, used on every tool's result so long jobs never
// show "376.0s". Under a minute keeps the site-wide "N.Ns" convention (e.g.
// "5.2s"); a minute or more reads as "6m 16s" (or a clean "6m" on the minute).
export function formatDuration(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '';
  if (secs < 60) return `${secs.toFixed(1)}s`;
  let m = Math.floor(secs / 60);
  let s = Math.round(secs % 60);
  if (s === 60) { m += 1; s = 0; }
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
