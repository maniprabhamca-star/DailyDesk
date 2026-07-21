import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, Wrench, Rocket, ArrowUpRight, Plus } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { CHANGELOG, KIND_META, type ChangeKind } from '@/lib/changelog';

export const metadata: Metadata = {
  title: 'Changelog — What Shipped, When | DiemDesk',
  description:
    'Every meaningful DiemDesk release, in plain language: new tools, improvements and fixes, dated and honest. The product is alive — here is the proof.',
  alternates: { canonical: '/changelog' },
  openGraph: { images: ['/og.png'], title: 'DiemDesk changelog — what shipped, when', description: 'New tools, improvements and fixes, dated and in plain language.', type: 'website' },
};

const KIND_STYLE: Record<ChangeKind, { chip: string; dot: string; icon: typeof Plus }> = {
  new: { chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', icon: Plus },
  improved: { chip: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400', dot: 'bg-sky-500', icon: ArrowUpRight },
  fixed: { chip: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', icon: Wrench },
  ai: { chip: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400', dot: 'bg-violet-500', icon: Sparkles },
  launch: { chip: 'border-primary/40 bg-primary/10 text-primary', dot: 'bg-primary', icon: Rocket },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}
function monthKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function ChangelogPage() {
  // Group (already newest-first) by month for the timeline headers.
  const groups: Array<{ month: string; items: typeof CHANGELOG }> = [];
  for (const e of CHANGELOG) {
    const m = monthKey(e.date);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.items.push(e);
    else groups.push({ month: m, items: [e] });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Changelog</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What shipped, when</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Every meaningful release, in plain language — new tools, improvements, and yes, the fixes too.
            A living product should show its pulse.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(KIND_META) as ChangeKind[]).map((k) => (
              <span key={k} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${KIND_STYLE[k].chip}`}>
                <span className={`size-1.5 rounded-full ${KIND_STYLE[k].dot}`} /> {KIND_META[k].label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-12">
          {groups.map((g) => (
            <section key={g.month} className="relative">
              <h2 className="sticky top-16 z-10 -mx-2 mb-6 w-fit rounded-full border bg-background/90 px-4 py-1.5 text-sm font-bold backdrop-blur">
                {g.month}
              </h2>
              <div className="relative ml-2 border-l-2 border-border pb-4 pl-8">
                {g.items.map((e, i) => {
                  const S = KIND_STYLE[e.kind];
                  const Icon = S.icon;
                  return (
                    <article key={`${e.date}-${i}`} className="relative mb-8 last:mb-2">
                      <span className={`absolute -left-[41px] top-1 flex size-5 items-center justify-center rounded-full ring-4 ring-background ${S.dot}`}>
                        <Icon className="size-3 text-white" />
                      </span>
                      <div className="rounded-2xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-md">
                        <div className="flex flex-wrap items-center gap-2">
                          <time dateTime={e.date} className="text-xs font-bold text-muted-foreground">{fmtDay(e.date)}</time>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${S.chip}`}>
                            {KIND_META[e.kind].label}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-bold leading-snug">
                          {e.href ? (
                            <Link href={e.href} className="transition-colors hover:text-primary">{e.title} <ArrowUpRight className="inline size-3.5 align-baseline text-muted-foreground" /></Link>
                          ) : (
                            e.title
                          )}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.detail}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Curious why any of this matters? Read <Link href="/why-diemdesk" className="font-semibold text-primary hover:underline">why people switch to DiemDesk</Link>,
            or see <Link href="/overview" className="font-semibold text-primary hover:underline">everything the toolkit does today</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
