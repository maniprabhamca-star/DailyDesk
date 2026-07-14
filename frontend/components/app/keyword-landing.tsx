import Link from 'next/link';
import { ChevronDown, ArrowRight, Check } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import type { Faq } from '@/components/pdf/tool-page';

// A lightweight SEO landing page that targets a specific keyword and sends the
// visitor into the actual tool. No tool embedded — just persuasion + a clear CTA.
export function KeywordLanding({
  h1,
  lede,
  ctaHref,
  ctaLabel,
  bullets,
  body,
  faqs,
}: {
  h1: string;
  lede: string;
  ctaHref: string;
  ctaLabel: string;
  bullets?: string[];
  body?: React.ReactNode;
  faqs?: Faq[];
}) {
  const jsonLd = faqs && faqs.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{h1}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{lede}</p>
        <Link href={ctaHref} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
          {ctaLabel} <ArrowRight className="size-4" />
        </Link>

        {bullets && bullets.length > 0 && (
          <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {body && <div className="prose-sm mt-10 max-w-none text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground">{body}</div>}

        {faqs && faqs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-4 divide-y rounded-xl border bg-card">
              {faqs.map((f, i) => (
                <details key={i} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                    {f.q}<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 rounded-xl border bg-card p-5 text-center shadow-soft">
          <p className="text-sm font-medium">Ready? It’s free and runs entirely in your browser.</p>
          <Link href={ctaHref} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
            {ctaLabel} <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
