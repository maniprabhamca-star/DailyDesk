import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { INDIA_FORMS, FORM_GROUPS } from '@/lib/india-forms';

export const metadata: Metadata = {
  title: 'Indian Tax, GST & EPF Forms Explained | DiemDesk',
  description:
    'Form 16, 26AS, ITR, 15G, PAN, GSTR and EPF forms in plain English: who files them, when, and what people get wrong. Free on-device tools for the paperwork.',
  alternates: { canonical: '/india-forms' },
  openGraph: {
    images: ['/og.png'],
    title: 'Indian statutory forms, explained — DiemDesk',
    description: 'What each form is, who files it, and the mistake that costs people most.',
    type: 'website',
  },
};

const faqs = [
  {
    q: 'Do you host the actual form PDFs?',
    a: 'No, deliberately. Government forms are revised without notice, and a stale copy served from our domain would be worse than none — you would file last year’s version and find out months later. Every page links to the issuing authority, whose copy is the current one.',
  },
  {
    q: 'Can DiemDesk file my return or claim?',
    a: 'No. These are explainers, and our tools are document tools. Filing happens on the income tax portal, the GST portal or the EPFO member portal. What we help with is everything around it: combining two Form 16s, compressing proofs under a payroll portal’s upload cap, turning a statement into rows, redacting an account number before forwarding.',
  },
  {
    q: 'Why does an Indian forms library exist on a PDF tools site?',
    a: 'Because the document work is the part nobody helps with. A filing season is mostly PDFs: certificates to reconcile, scans to shrink, statements to convert. Those jobs are what these tools do, and they do them without your documents leaving your device.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

export default function IndiaFormsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" /> Plain English · nothing uploaded
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Indian tax, GST and EPF forms, explained</h1>
          <p className="mt-3 text-muted-foreground">
            What each form actually is, who files it, when, and the mistake that costs people the most. Written for the
            person filling it in, not for someone who already knows.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/#tools">
                Open the tools <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {FORM_GROUPS.map((group) => {
          const forms = INDIA_FORMS.filter((f) => f.group === group);
          return (
            <section key={group} className="mt-12">
              <h2 className="flex items-baseline gap-2 text-xl font-bold tracking-tight">
                {group}
                <span className="text-sm font-medium text-muted-foreground">· {forms.length}</span>
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {forms.map((f) => (
                  <Link
                    key={f.slug}
                    href={`/india-forms/${f.slug}`}
                    className="group rounded-xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
                  >
                    <p className="text-sm font-semibold group-hover:text-primary">{f.name}</p>
                    {f.aka && <p className="mt-0.5 text-xs text-muted-foreground">{f.aka}</p>}
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{f.what}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-12 rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 text-sm leading-relaxed text-muted-foreground dark:border-amber-500/25 dark:bg-amber-950/10">
          <b className="text-foreground">Explainers, not tax advice.</b> Deadlines, thresholds and eligibility change
          every year and are frequently extended. Treat the dates here as orientation and the issuing authority as the
          authority. DiemDesk is not affiliated with or endorsed by any government department, we do not host copies of
          government forms, and we do not file anything on your behalf.
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Questions</h2>
          <dl className="mt-4 space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border bg-card p-4">
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
