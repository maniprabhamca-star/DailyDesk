import Link from 'next/link';

// The pages that answer "which tool do I need?" rather than "what tools are
// there?" — form libraries, passport specs, the per-trade pages.
//
// One list, three placements (the Tools mega-menu, the mobile menu, the bottom
// of /tools), because the last time a set of pages like this went in, two of
// them shipped linked from nowhere and nobody noticed for weeks. A single
// export means adding a library here puts it everywhere at once.
//
// No counts printed: the libraries live in their own modules and importing them
// to render a number would put every form's prose in the chunk that loads on
// every page. See app/forms-api/index/route.ts.
export const FORM_LIBRARIES = [
  { label: 'US federal forms', sub: 'IRS, USCIS, SSA, DOL, VA', href: '/us-forms' },
  { label: 'Indian forms', sub: 'ITR, PAN, Aadhaar, EPFO', href: '/india-forms' },
  { label: 'Passport photos', sub: '60+ countries, to spec', href: '/passport-photo' },
  { label: 'By profession', sub: 'what your work needs', href: '/for/accountants' },
];

/** The horizontal strip used inside the Tools mega-menu and at the foot of /tools. */
export function FormLibraryStrip({ onPick, className = '' }: { onPick?: () => void; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Looking for a form?</span>
      {FORM_LIBRARIES.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          prefetch={false}
          onClick={onPick}
          className="group flex flex-col rounded-lg px-2 py-1 transition-colors hover:bg-accent"
        >
          <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground">{l.label}</span>
          <span className="text-[11px] text-muted-foreground">{l.sub}</span>
        </Link>
      ))}
    </div>
  );
}
