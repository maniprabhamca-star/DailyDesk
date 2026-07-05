// DiemDesk brand mark — "lifted D" (user-approved 2026-07-04): an indigo tile
// with three colored document squares (amber/green/coral) and one tile lifted +
// tilted as a white "D" — the office-suite/documents identity. Original geometry
// (license-clean). scripts/gen-brand-assets.mjs draws the SAME art with canvas
// primitives for the favicons/OG image — keep them in sync if this changes.
import { BRAND_INNER, isBrandVariant } from './brand-variants';

// Preview servers set this to review candidate marks; unset in prod/dev = live mark below.
const PREVIEW_VARIANT = process.env.NEXT_PUBLIC_BRAND_VARIANT;

export function BrandMark({ className = 'size-8', animate = false }: { className?: string; animate?: boolean }) {
  const tile = animate ? 'dd-tile' : undefined;
  if (isBrandVariant(PREVIEW_VARIANT)) {
    return (
      <svg
        viewBox="0 0 48 48"
        className={className}
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: BRAND_INNER[PREVIEW_VARIANT] }}
      />
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13.5" fill="#4F46E5" />
      <rect x="10" y="10" width="12" height="12" rx="3.5" fill="#FBBF24" className={tile} style={animate ? { animationDelay: '0s' } : undefined} />
      <rect x="10" y="26" width="12" height="12" rx="3.5" fill="#22C55E" className={tile} style={animate ? { animationDelay: '0.12s' } : undefined} />
      <rect x="26" y="26" width="12" height="12" rx="3.5" fill="#F87171" className={tile} style={animate ? { animationDelay: '0.24s' } : undefined} />
      <g transform={animate ? undefined : 'rotate(9 32 15)'} className={animate ? 'dd-d' : undefined}>
        <rect x="24" y="7" width="16" height="16" rx="4.5" fill="#fff" />
        <path fillRule="evenodd" fill="#4F46E5" d="M28 9.5 H32.5 C35.7 9.5 37.8 12 37.8 15 C37.8 18 35.7 20.5 32.5 20.5 H28 Z M30.4 11.8 V18.2 H32.5 C34.3 18.2 35.4 16.9 35.4 15 C35.4 13.1 34.3 11.8 32.5 11.8 Z" />
      </g>
    </svg>
  );
}
