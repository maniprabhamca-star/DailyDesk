'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CHANGELOG, type ChangeKind } from '@/lib/changelog';

// "Last improved" — this tool's own entries, pulled straight out of the
// changelog we already maintain with every ship.
//
// Costs nothing to keep current (the data is written anyway) and it is the
// cheapest possible signal that a tool is alive. Competitor tool pages give no
// indication whether they were touched this month or in 2019.

const KIND_STYLE: Record<ChangeKind, string> = {
  new: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  feature: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  improved: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  fixed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  ai: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  launch: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

const KIND_LABEL: Record<ChangeKind, string> = {
  // Match /changelog exactly — two names for one thing is its own confusion.
  new: 'New tool', feature: 'New feature', improved: 'Improved', fixed: 'Fixed', ai: 'AI', launch: 'Milestone',
};

/** The plain date. Safe to render anywhere: it depends on nothing but the entry. */
function absolute(date: string): string {
  const then = new Date(`${date}T00:00:00`);
  if (Number.isNaN(then.getTime())) return date;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2 days ago" for the recent past, a plain date once that stops being useful. */
function when(date: string, now: Date): string {
  const then = new Date(`${date}T00:00:00`);
  if (Number.isNaN(then.getTime())) return date;
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return absolute(date);
}

export function LastImproved({ max = 3 }: { max?: number }) {
  const pathname = usePathname() || '';
  const entries = CHANGELOG.filter((e) => e.href === pathname).slice(0, max);

  // "days ago" is filled in AFTER mount, not during render.
  //
  // This used to be a bare `new Date()` with a comment saying it was rendered
  // client-side. It is a 'use client' component, but that does not mean it only
  // runs in the browser — it is still rendered on the server when the page is
  // prerendered. So the server baked in "9 days ago" at build time and the
  // browser produced "10 days ago" the moment the clock passed midnight, and
  // the two disagreed. React 18 logged a warning nobody saw; React 19 throws
  // (#418) and re-renders the whole subtree on the client, so every statically
  // built tool page carrying a changelog entry breaks its own hydration every
  // day after the build. Our own E2E only caught it because the chromium run
  // finished before midnight and the mobile run started after.
  //
  // Null on the server and on the first client render, which is what makes
  // those two identical. The date shown until then is the real one, so this
  // degrades to something true rather than to a blank.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  // AFTER the hooks, not before. When this fix was first written the early
  // return sat above them, which made both hooks conditional — on a route with
  // no changelog entry React would run zero hooks, on one with entries it would
  // run two, and the hook order that React relies on is then different between
  // renders of the same component. It survived the whole E2E suite because
  // pathname does not change without a remount. ESLint caught it; nothing else
  // did.
  if (!entries.length) return null;

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold tracking-tight">Last improved</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Changes to this tool specifically, not the site.</p>
      <ol className="mt-4 space-y-3">
        {entries.map((e) => (
          // Date and kind sit together on their own line above the title, the
          // same reading order as /changelog. They used to share a baseline-
          // aligned row with the whole entry, so beside a long detail the date
          // stranded itself at the top-right of a tall card with nothing near
          // it — it read as a stray label rather than as this entry's date.
          <li key={e.date + e.title} className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_STYLE[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
              <time dateTime={e.date} className="text-xs tabular-nums text-muted-foreground">
                {now ? when(e.date, now) : absolute(e.date)}
              </time>
            </div>
            <p className="mt-2 text-sm font-semibold">{e.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.detail}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm">
        <Link href="/changelog" className="font-medium text-primary underline underline-offset-2">Everything we&rsquo;ve changed &rarr;</Link>
      </p>
    </section>
  );
}
