'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { nextStepsFor } from '@/lib/next-steps';

// "What usually comes next", on the tool page you are already on.
//
// The alternative was a recents row, and it is the weaker idea: recency tells
// someone what they already know they opened, and shows a first-time visitor
// nothing at all. Most of our traffic arrives on one tool page from a search
// and never sees the home page, so the only useful thing to offer is the step
// that FOLLOWS — which is the same for everyone and works on a first visit.
//
// Renders nothing where no step genuinely follows. A dock that is always full
// is a related-links block, and related-links blocks get ignored.

export function NextSteps() {
  const pathname = usePathname() || '';
  const steps = nextStepsFor(pathname);
  if (steps.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold tracking-tight">What usually comes next</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The step most people take after this one — and why.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-primary">
              {s.label}
              <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.why}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
