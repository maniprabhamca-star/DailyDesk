import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { US_FORMS, US_FORM_GROUPS, CHECKED_ON_LABEL } from '@/lib/us-forms';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';

const totalFields = US_FORMS.reduce((n, f) => n + f.fields, 0);

export const metadata: Metadata = {
  title: 'US Tax & IRS Forms, Filled On Your Device | DiemDesk',
  description:
    'W-9, W-4, W-7, SS-4, 2848, 433-A and more: what each form is, who files it, and what people get wrong. Fill them in your browser — nothing is uploaded.',
  alternates: { canonical: '/us-forms' },
  openGraph: {
    images: ['/og.png'],
    title: 'US federal forms, explained and filled privately — DiemDesk',
    description: 'What each form is, who files it, the revision we verified, and the mistake that costs people most.',
    type: 'website',
  },
};

const faqs = [
  {
    q: 'Do you host the form PDFs?',
    a: 'No, deliberately. Federal forms are revised without notice, and a stale copy served from our domain would be worse than none — it would look current and somebody would file it. Every page here links to the issuing agency and states the revision we verified, with the date we checked. Sites that host a copy and badge it "official" without linking to the source are asking you to take their word for it.',
  },
  {
    q: 'What does "nothing is uploaded" actually mean?',
    a: 'The fill, sign, merge, compress and redact tools open and rewrite the PDF inside the browser tab, using your own machine to do the work. The file is never sent to us and we keep no copy, because we never receive one. You do not have to believe that: open your browser’s Network tab before you choose a file, and you will see no request carrying it.',
  },
  {
    q: 'Why does this matter more for these forms than for other PDFs?',
    a: 'Because of what is typed into them. A W-9 is a bare Social Security number. A W-7 travels with your passport. A 433-A lists every account, vehicle and source of income you have, across 515 fields. Filling one of those in a cloud editor means that information transits and is processed by a third party, for no reason — the work can be done on the device it is already on.',
  },
  {
    q: 'Can DiemDesk file these for me?',
    a: 'No, and nothing here submits anything to any agency. These are document tools and plain-English explainers. You fill and sign the form here, then file it yourself with the agency, which is the only party that can accept it.',
  },
  {
    q: 'How do I know the revision shown is still current?',
    a: 'Each page shows the revision and the date we checked it against the agency, so you can judge how fresh the claim is instead of trusting a badge. We also run a script that re-checks every revision, field count and page count against the IRS directly, and the link on each page goes to the agency so you can confirm in one click.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

export default function UsFormsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" /> Revisions verified at source · nothing uploaded
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            US federal forms, explained and filled on your own device
          </h1>
          <p className="mt-3 text-muted-foreground">
            {US_FORMS.length} forms, {totalFields.toLocaleString('en-US')} fillable fields between them. For each one:
            what it is, who files it, the revision the agency publishes today, and the mistake that costs people the
            most. You download the form from the agency and fill it here — the file never leaves your machine.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/fill-pdf-form">
                Open Fill PDF form <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Every revision, field count and page count below was measured at the source on {CHECKED_ON_LABEL}.
          </p>
        </div>

        {US_FORM_GROUPS.map((group) => {
          const forms = US_FORMS.filter((f) => f.group === group);
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
                    href={`/us-forms/${f.slug}`}
                    className="group rounded-xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold group-hover:text-primary">Form {f.short}</p>
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                        Rev. {f.revision} · {f.fields} fields
                      </span>
                    </div>
                    {f.aka && <p className="mt-0.5 text-xs text-muted-foreground">{f.aka}</p>}
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{f.what}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-12 rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
          <b className="text-foreground">Explainers, not tax or legal advice.</b> Filing dates, thresholds and
          eligibility change and are frequently extended, so treat the guidance here as orientation and the issuing
          agency as the authority. We do not host copies of federal forms, and we do not file anything on your behalf.
        </div>
        <ThirdPartyNotice
          className="mt-3"
          subject="the Internal Revenue Service or any other government agency"
          because="Each form and agency is named so you can go to the source and check the revision for yourself"
        />

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

        <p className="mt-10 text-sm text-muted-foreground">
          Filing in India instead?{' '}
          <Link href="/india-forms" className="font-medium text-primary underline underline-offset-2">
            Indian tax, GST and EPF forms
          </Link>{' '}
          are covered the same way.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
