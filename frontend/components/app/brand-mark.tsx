// DiemDesk brand mark — "lifted tile" (option A, user-approved 2026-07-02).
// The grid identity with one tile picked up and tilted: a tool being grabbed.
// Original geometry (license-clean). Same art generates the favicons/OG image
// (scripts draw it with canvas primitives) — keep them in sync if this changes.
export function BrandMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13.5" className="fill-primary" />
      <rect x="10" y="10" width="12" height="12" rx="3.5" fill="white" opacity="0.55" />
      <rect x="10" y="26" width="12" height="12" rx="3.5" fill="white" opacity="0.55" />
      <rect x="26" y="26" width="12" height="12" rx="3.5" fill="white" opacity="0.55" />
      <rect x="25" y="8" width="14" height="14" rx="4" fill="white" transform="rotate(9 32 15)" />
    </svg>
  );
}
