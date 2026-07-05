import Link from 'next/link';
import { Check, Minus, ShieldCheck, ArrowRight, CloudOff } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';

// Shared shell for the per-competitor "alternative" landing pages
// (/smallpdf-alternative, /ilovepdf-alternative). High-intent SEO: someone
// searching "smallpdf alternative" is comparison-shopping. Same honesty rules
// as /compare — every competitor figure is sourced (July 2026) and we flag
// what's still coming soon rather than overclaim.

export type AltRow = { label: string; us: boolean | string; them: boolean | string };

export type AltData = {
  competitor: string; // 'Smallpdf'
  competitorUrl: string; // vendor pricing page, used as the source link
  tagline: string; // one-line positioning
  intro: string;
  reasons: { title: string; body: string }[];
  rows: AltRow[];
  faqs: { q: string; a: string }[];
};

function Cellv({ value, primary }: { value: boolean | string; primary?: boolean }) {
  if (value === true) return <Check className={`mx-auto size-[18px] ${primary ? 'text-emerald-600' : 'text-emerald-600/80'}`} strokeWidth={2.75} />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" />;
  return <span className={`text-[13px] font-medium ${primary ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>{value}</span>;
}

export function AlternativePage({ data }: { data: AltData }) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" /> Private by design · free during launch
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            The private {data.competitor} alternative
          </h1>
          <p className="mt-2 text-lg font-medium text-primary">{data.tagline}</p>
          <p className="mt-4 text-muted-foreground">{data.intro}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link href="/#tools">Try the tools free <ArrowRight className="size-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/compare">Full comparison</Link></Button>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {data.reasons.map((r) => (
            <div key={r.title} className="rounded-xl border bg-card p-5">
              <CloudOff className="size-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{r.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[48%] border-b bg-muted/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature
                </th>
                <th className="border-b bg-primary/5 px-3 py-3 text-center text-sm font-bold text-primary">
                  DiemDesk
                  <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-emerald-600">Free during launch</span>
                </th>
                <th className="border-b bg-muted/40 px-3 py-3 text-center text-sm font-bold">{data.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.label}>
                  <td className="border-b border-border/60 px-4 py-3 font-medium">{r.label}</td>
                  <td className="border-b border-border/60 bg-primary/5 px-3 py-3 text-center"><Cellv value={r.us} primary /></td>
                  <td className="border-b border-border/60 px-3 py-3 text-center"><Cellv value={r.them} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {data.competitor} figures are from their{' '}
          <a href={data.competitorUrl} target="_blank" rel="nofollow noopener" className="text-primary hover:underline">published plans</a>{' '}
          as of <strong>July 2026</strong> and may change — verify at the source. See the{' '}
          <Link href="/compare" className="text-primary hover:underline">full comparison</Link> for more names.
        </p>

        <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 text-sm text-muted-foreground dark:border-amber-500/25 dark:bg-amber-950/10">
          <p>
            <strong className="text-foreground">Fair disclosure:</strong> DiemDesk is in pre-launch. Annotate, Redact and
            OCR are marked <em>coming soon</em>, and the Pro plan isn&rsquo;t on sale yet — so everything is free right
            now. We&rsquo;d rather show the full roadmap than hide it.
          </p>
        </div>

        <section className="mx-auto mt-16 max-w-2xl">
          <h2 className="text-center text-xl font-semibold">Switching from {data.competitor} — your questions</h2>
          <div className="mt-5 space-y-3">
            {data.faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card px-4 py-3">
                <summary className="cursor-pointer list-none font-medium marker:content-none">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-14 flex flex-col items-center gap-3 text-center">
          <h2 className="text-xl font-semibold">Give it a try — nothing to install</h2>
          <p className="max-w-md text-sm text-muted-foreground">No signup, no upload, no watermark. Drop in a file and watch it work entirely in your browser.</p>
          <Button asChild size="lg" className="mt-1"><Link href="/#tools">Browse all tools <ArrowRight className="size-4" /></Link></Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
