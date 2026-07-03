import type { Metadata } from 'next';

// Internal design-review page (noindex, not in the sitemap): three original,
// hand-drawn brand-mark concepts to replace the stock lucide grid icon.
// All geometry is ours — license-clean for commercial use.
export const metadata: Metadata = {
  title: 'Brand mark concepts | DiemDesk',
  robots: { index: false, follow: false },
};

// A — "Lifted tile": evolution of the current grid; one tile pops out and tilts,
// suggesting a tool being picked up / switched to. Familiar but ownable.
function MarkA({ size = 64, radius = 0.28 }: { size?: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx={48 * radius} fill="hsl(248 90% 66%)" />
      <rect x="10" y="10" width="12" height="12" rx="3.5" fill="white" opacity="0.55" />
      <rect x="10" y="26" width="12" height="12" rx="3.5" fill="white" opacity="0.55" />
      <rect x="26" y="26" width="12" height="12" rx="3.5" fill="white" opacity="0.55" />
      <rect x="25" y="8" width="14" height="14" rx="4" fill="white" transform="rotate(9 32 15)" />
    </svg>
  );
}

// B — "D monogram": bold geometric D built from a bar + bowl with a keyhole
// counter — reads DiemDesk at a glance, scales down to 16px cleanly.
function MarkB({ size = 64, radius = 0.28 }: { size?: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx={48 * radius} fill="hsl(248 90% 66%)" />
      <path
        d="M15 11 h10.5 a13 13 0 0 1 0 26 H15 Z M21.5 17.5 v13 h4 a6.5 6.5 0 0 0 0 -13 Z"
        fill="white"
        fillRule="evenodd"
      />
    </svg>
  );
}

// C — "Shield tile": the privacy identity made literal — a soft shield with a
// check, on the brand tile. Says "your files are safe" before a word is read.
function MarkC({ size = 64, radius = 0.28 }: { size?: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx={48 * radius} fill="hsl(248 90% 66%)" />
      <path d="M24 9.5 36 14 v9.5 c0 7.5 -5 13 -12 15.5 -7 -2.5 -12 -8 -12 -15.5 V14 Z" fill="white" />
      <path d="M18.5 24 l4 4 l7.5 -8" fill="none" stroke="hsl(248 90% 66%)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CONCEPTS = [
  { id: 'A', name: 'Lifted tile', blurb: 'Evolution of today’s grid — one tile lifts and tilts, like picking up a tool. Familiar, dynamic, ownable.', Mark: MarkA },
  { id: 'B', name: 'D monogram', blurb: 'A bold geometric D. Unmistakably “DiemDesk”, crisp at every size, most timeless of the three.', Mark: MarkB },
  { id: 'C', name: 'Shield tile', blurb: 'The privacy promise as the mark itself — shield + check. Strongest brand-message pairing.', Mark: MarkC },
];

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Internal · design review</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Brand mark concepts</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Three original marks to replace the stock grid icon. Each shown at real sizes, in the header, and on dark.
        All geometry is hand-drawn (no third-party assets) — safe for commercial use.
      </p>

      <div className="mt-10 space-y-10">
        {CONCEPTS.map(({ id, name, blurb, Mark }) => (
          <section key={id} className="rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-md">
                <h2 className="text-xl font-bold tracking-tight">Option {id} — {name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
              </div>
              <Mark size={96} />
            </div>

            {/* Size ramp */}
            <div className="mt-6 flex items-end gap-6">
              {[64, 40, 28, 20, 16].map((s) => (
                <div key={s} className="text-center">
                  <Mark size={s} />
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{s}px</p>
                </div>
              ))}
            </div>

            {/* In context: header, light + dark */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 rounded-xl border bg-background px-4 py-3">
                <Mark size={32} />
                <span className="text-lg font-semibold tracking-tight">DiemDesk</span>
                <span className="ml-auto text-[10px] text-muted-foreground">header · light</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#0f172a] px-4 py-3">
                <Mark size={32} />
                <span className="text-lg font-semibold tracking-tight text-white">DiemDesk</span>
                <span className="ml-auto text-[10px] text-slate-500">footer · dark</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Pick an option (or ask for variations) — the chosen mark rolls out to the header, footer, favicon,
        app icons, and the social share image.
      </p>
    </main>
  );
}
