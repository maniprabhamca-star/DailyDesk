import { ChevronDown } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';

export type Faq = { q: string; a: string };

export function PdfToolPage({
  title,
  description,
  steps,
  faqs,
  children,
}: {
  title: string;
  description: string;
  steps: string[];
  faqs: Faq[];
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `${title} — DailyDesk`,
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
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{description}</p>
        </div>

        <div className="mt-8">{children}</div>

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
      </main>

      <SiteFooter />
    </div>
  );
}
