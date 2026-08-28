'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Progressive disclosure for a long server-rendered list.
 *
 * Deliberately NOT URL pagination. The changelog earns its place as one
 * indexable page — splitting it across ?page=2,3,4 would produce a set of thin,
 * near-identical pages (the exact shape that got us "Duplicate without
 * user-selected canonical" in Search Console once already), break Ctrl+F, and
 * make a two-year-old entry unreachable without paging through everything.
 *
 * So every entry stays in the markup and is served on the first request. This
 * only decides how much is on screen to begin with.
 */
export function RevealMore({
  count,
  label,
  children,
}: {
  count: number;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <div className="relative">
          {/* A fade off the last visible entry, so it reads as "there is more"
              rather than "this is the end". */}
          <div className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent to-background" />
          <button
            onClick={() => setOpen(true)}
            className="mx-auto flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 text-sm font-semibold shadow-soft transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <ChevronDown className="size-4" />
            {label} <span className="text-muted-foreground">({count})</span>
          </button>
        </div>
      )}
      <div hidden={!open}>{children}</div>
    </>
  );
}
