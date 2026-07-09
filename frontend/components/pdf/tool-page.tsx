import { ChevronDown } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { ToolGate } from '@/components/app/tool-gate';
import { UpgradeCard } from '@/components/app/upgrade-card';

export type Faq = { q: string; a: string };

export function PdfToolPage({
  title,
  description,
  steps,
  faqs,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  steps: string[];
  faqs: Faq[];
  children: React.ReactNode;
  wide?: boolean;
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

      <SiteHeader />

      <main className={`mx-auto w-full flex-1 px-4 py-10 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{description}</p>
        </div>

        <div className="mt-8"><ToolGate>{children}</ToolGate></div>

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

        <section className="mx-auto mt-6 max-w-3xl">
          <h2 className="text-base font-bold tracking-tight">Frequently asked questions</h2>
          <div className="mt-2 grid gap-1">
            {faqs.map((f, i) => (
              <details key={i} className="group rounded-lg border bg-card px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  {f.q}
                  <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <UpgradeCard />
    </div>
  );
}
