'use client';

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
  new: 'bg-primary/10 text-primary',
  improved: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  fixed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  ai: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  launch: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

const KIND_LABEL: Record<ChangeKind, string> = {
  new: 'New', improved: 'Improved', fixed: 'Fixed', ai: 'AI', launch: 'Launch',
};

/** "2 days ago" for the recent past, a plain date once that stops being useful. */
function when(date: string, now: Date): string {
  const then = new Date(`${date}T00:00:00`);
  if (Number.isNaN(then.getTime())) return date;
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function LastImproved({ max = 3 }: { max?: number }) {
  const pathname = usePathname() || '';
  const entries = CHANGELOG.filter((e) => e.href === pathname).slice(0, max);
  if (!entries.length) return null;

  // Rendered client-side, so "days ago" is the reader's own clock rather than a
  // build-time snapshot that silently goes stale on a statically exported page.
  const now = new Date();

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold tracking-tight">Last improved</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Changes to this tool specifically, not the site.</p>
      <ol className="mt-4 space-y-3">
        {entries.map((e) => (
          <li key={e.date + e.title} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 shadow-soft sm:flex-row sm:items-baseline sm:gap-4">
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-24 sm:text-right">{when(e.date, now)}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_STYLE[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
                {e.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm">
        <Link href="/changelog" className="font-medium text-primary underline underline-offset-2">Everything we&rsquo;ve changed &rarr;</Link>
      </p>
    </section>
  );
}
