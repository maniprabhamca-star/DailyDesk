import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldCheck, ArrowRight, Check, TriangleAlert } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { SECTORS, sectorBySlug } from '@/lib/sectors';
import { catalog } from '@/components/app/catalog';

// Flatten once: the toolkit is a list of names and we need the real catalogue
// entry behind each (icon, colour, href, soon flag) so a curated list can never
// drift from what actually ships.
const ALL_TOOLS = catalog.flatMap((g) => g.tools.map((t) => ({ ...t, color: g.color })));
const liveToolCount = catalog.reduce((n, g) => n + g.tools.filter((t) => t.href && !t.soon).length, 0);

export function generateStaticParams() {
  return SECTORS.map((s) => ({ sector: s.slug }));
}

export function generateMetadata({ params }: { params: { sector: string } }): Metadata {
  const s = sectorBySlug(params.sector);
  if (!s) return {};
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: `/for/${s.slug}` },
    openGraph: { images: ['/og.png'], title: s.headline, description: s.description, type: 'website' },
  };
}

export default function SectorPage({ params }: { params: { sector: string } }) {
  const s = sectorBySlug(params.sector);
  if (!s) notFound();

  const others = SECTORS.filter((o) => o.slug !== s.slug);
  // A name that no longer matches the catalogue is dropped rather than rendered
  // dead — and the test below fails, which is where it gets noticed.
  const toolkit = s.toolkit.map((n) => ALL_TOOLS.find((t) => t.name === n)).filter((t): t is typeof ALL_TOOLS[number] => !!t);
  const Icon = s.icon;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Icon className="size-3.5" /> {s.name}
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{s.headline}</h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">{s.intro}</p>

          {/* The rule they actually work under, named. A page that gestures at
              "compliance" without naming anything reads as marketing to exactly
              the reader it is written for. */}
          <section className="mt-10 rounded-2xl border bg-card p-5 sm:p-6">
            <h2 className="text-sm font-bold">{s.duty.label}</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.duty.body}</p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">The everyday jobs</h2>
            <div className="mt-4 space-y-2.5">
              {s.jobs.map((j) => (
                <Link
                  key={j.task}
                  href={j.href}
                  className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{j.task}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{j.why}</span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {j.tool} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Non-negotiable. A compliance-minded reader who catches one overclaim
              stops believing the rest of the page, and is right to. */}
          <section className="mt-10 rounded-2xl border border-amber-500/35 bg-amber-500/[0.05] p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <TriangleAlert className="size-4 text-amber-700 dark:text-amber-400" /> Where we can’t help
            </h2>
            <ul className="mt-3 space-y-2">
              {s.limits.map((l) => (
                <li key={l} className="text-sm leading-relaxed text-muted-foreground">{l}</li>
              ))}
            </ul>
          </section>

          {/* The working set. "Open the tools" used to drop the reader into the
              whole undifferentiated catalogue — the page spends its length
              explaining which tools matter to them and then hands them 102 of
              them. This is the answer to "so which ones are mine?". */}
          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">Your toolkit</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The {toolkit.length} tools this work actually reaches for, out of {liveToolCount}.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {toolkit.map((t) => {
                const Ico = t.icon;
                const inner = (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${t.color}1a` }}>
                      <Ico className="size-4" style={{ color: t.color }} strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t.name}</span>
                    </span>
                    {t.soon && <span className="shrink-0 text-[10px] font-medium text-muted-foreground">soon</span>}
                  </>
                );
                return t.href && !t.soon ? (
                  <Link key={t.name} href={t.href} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50">
                    {inner}
                  </Link>
                ) : (
                  <div key={t.name} className="flex cursor-default items-center gap-3 rounded-xl border p-3 opacity-70">{inner}</div>
                );
              })}
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-primary/30 bg-primary/[0.05] p-6 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-400" /> {s.close}
            </p>
            {/* Straight to the highest-intent tool, not the catalogue. */}
            <Link
              href={s.primary.href}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary/90"
            >
              {s.primary.label}
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              or <Link href="/#tools" className="font-medium text-primary underline underline-offset-2">browse all {liveToolCount} tools</Link>
            </p>
          </section>

          <section className="mt-12 border-t pt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Also written for</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => (
                <Link
                  key={o.slug}
                  href={`/for/${o.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/50"
                >
                  <o.icon className="size-3.5" /> {o.name}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
