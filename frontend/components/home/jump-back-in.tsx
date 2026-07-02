'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { catalog } from '@/components/app/catalog';
import { getRecent } from '@/lib/recent';

// "Jump back in" — a small recents row for returning visitors (reads the same
// local-only history that powers the command palette's Recent section). Renders
// nothing on a first visit, so newcomers see the clean hero → tools flow.
// Client-only read happens after mount to avoid a hydration mismatch.

const ALL = catalog.flatMap((g) => g.tools.filter((t) => t.href).map((t) => ({ ...t, color: g.color })));

export function JumpBackIn() {
  const [recent, setRecent] = useState<typeof ALL>([]);

  useEffect(() => {
    const hrefs = getRecent();
    setRecent(hrefs.map((h) => ALL.find((t) => t.href === h)).filter((t): t is (typeof ALL)[number] => !!t).slice(0, 4));
  }, []);

  if (recent.length === 0) return null;

  return (
    <section aria-label="Jump back in" className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card px-4 py-3 shadow-soft">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="size-3.5" /> Jump back in
        </span>
        {recent.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href!}
              className="group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:-translate-y-px hover:shadow-soft"
            >
              <span className="flex size-5 items-center justify-center rounded-md" style={{ backgroundColor: `${t.color}1A`, color: t.color }}>
                <Icon className="size-3.5" strokeWidth={2.25} />
              </span>
              {t.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
