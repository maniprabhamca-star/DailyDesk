import Link from 'next/link';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { ToolGate } from '@/components/app/tool-gate';
import { UpgradeCard } from '@/components/app/upgrade-card';
import { EngineWarmup } from '@/components/pdf/engine-warmup';
import { UploadWatch } from '@/components/app/upload-watch';
import { ToolFacts } from '@/components/app/tool-facts';
import { LastImproved } from '@/components/app/last-improved';
import { NextSteps } from '@/components/app/next-steps';

export type Faq = { q: string; a: string };

export function PdfToolPage({
  title,
  description,
  steps,
  faqs,
  children,
  wide = false,
  sibling,
}: {
  title: string;
  description: string;
  steps: string[];
  faqs: Faq[];
  children: React.ReactNode;
  wide?: boolean;
  /** For a tool that genuinely overlaps another one. Says which job the other
   *  tool does better, ABOVE the dropzone — where somebody who landed on the
   *  wrong one is still deciding, rather than buried in the FAQ they will read
   *  after downloading the wrong thing. */
  sibling?: { text: string; href: string; label: string };
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `${title} — DiemDesk`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description,
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Every PDF tool page pre-warms the pdf.js engine so the first drop is instant. */}
      <EngineWarmup />
      <SiteHeader />

      {/* `wide` editors (Annotate/Edit/Redact) get a roomy, app-like canvas that
          uses the screen; the reading sections below stay at a comfortable width. */}
      <main className={`mx-auto w-full flex-1 px-4 py-10 sm:px-6 ${wide ? 'max-w-[1400px]' : 'max-w-3xl'}`}>
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{description}</p>
        </div>

        {sibling && (
          <div className="mx-auto mt-5 max-w-xl rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {sibling.text}{' '}
            <Link
              href={sibling.href}
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              {sibling.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="mt-8"><ToolGate>{children}</ToolGate></div>

        <div className={wide ? 'mx-auto w-full max-w-4xl' : ''}>
        {/* Three blocks every tool inherits. Each reads the current route itself,
            so adding a tool needs no page edit: the counter measures real bytes,
            the facts render only where lib/tool-facts has data, and "last
            improved" only where the changelog mentions this tool. */}
        <UploadWatch />
        <ToolFacts />
        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="rounded-xl border bg-card p-4 shadow-soft">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                <p className="mt-2 text-sm text-muted-foreground">{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">Frequently asked questions</h2>
          <div className="mt-4 divide-y rounded-xl border bg-card">
            {faqs.map((f, i) => (
              <details key={i} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <NextSteps />
        <LastImproved />
        </div>
      </main>

      <SiteFooter />
      <UpgradeCard />
    </div>
  );
}
