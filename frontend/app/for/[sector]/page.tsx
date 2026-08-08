import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldCheck, ArrowRight, Check, TriangleAlert } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { SECTORS, sectorBySlug } from '@/lib/sectors';

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

          <section className="mt-10 rounded-2xl border border-primary/30 bg-primary/[0.05] p-6 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-400" /> {s.close}
            </p>
            <Link
              href="/#tools"
              className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary/90"
            >
              Open the tools
            </Link>
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
