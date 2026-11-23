import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, FileText, Link2Off, Hand } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { US_FORMS, US_FORM_GROUPS } from '@/lib/us-forms';
import { INDIA_FORMS, FORM_GROUPS as INDIA_FORM_GROUPS } from '@/lib/india-forms';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { CheckedAgo } from '@/components/forms/checked-ago';

// Counts are derived from the catalogues, never typed in. Two libraries that
// each state their own size and a hub that states a third number is how a site
// starts lying about itself one page at a time.
const usCount = US_FORMS.length;
const inCount = INDIA_FORMS.length;
const total = usCount + inCount;
const usFields = US_FORMS.reduce((n, f) => n + f.fields, 0);
const authorities = [...new Set([...US_FORMS.map((f) => f.authority), ...INDIA_FORMS.map((f) => f.authority)])].length;

export const metadata: Metadata = {
  title: 'Government Forms, Explained & Filled Privately | DiemDesk',
  description:
    `${total} US federal and Indian statutory forms: what each one is, who files it, the version the agency publishes today, and the mistake that costs people most. Fill them in your browser — nothing is uploaded.`,
  alternates: { canonical: '/forms' },
  openGraph: {
    images: ['/og.png'],
    title: 'Government forms, explained and filled on your own device — DiemDesk',
    description:
      'Two libraries, one promise: we host no copies. Every form links to the issuing authority, and the version is verified at source.',
    type: 'website',
  },
};

const libraries = [
  {
    href: '/us-forms',
    flag: '🇺🇸',
    title: 'US federal forms',
    count: usCount,
    groups: US_FORM_GROUPS,
    blurb:
      'W-9, W-4, I-9, I-130, SS-4, 2848, 433-A and more. Each page carries the version marker the agency prints on the document itself, plus the field and page count measured off the real PDF.',
    stat: `${usFields.toLocaleString('en-US')} fillable fields measured`,
    cta: 'Browse US forms',
  },
  {
    href: '/india-forms',
    flag: '🇮🇳',
    title: 'Indian statutory forms',
    count: inCount,
    groups: INDIA_FORM_GROUPS,
    blurb:
      'Form 16, 26AS, the ITR series, GSTR-1/3B/9, EPF claims, PAN and Aadhaar. Most of these are filed online now, so each page covers the PDF work around the filing rather than pretending you post a form.',
    stat: 'No version markers — and that is deliberate',
    cta: 'Browse Indian forms',
  },
];

const faqs = [
  {
    q: 'Why two libraries instead of one list?',
    a: 'Because they are not the same kind of thing, and merging them would require pretending they are. A US federal form is a PDF you download, fill in and submit, so every page here states the revision printed on the document and the field count measured off it. An Indian statutory form is mostly a web filing — ITRs are e-filed, EPF claims go through the UAN portal, GST returns are filed on the GST portal — so there is no PDF revision to measure and no field count to state. A single table with half its columns empty would look like missing data instead of a different reality.',
  },
  {
    q: 'Do you host the form files?',
    a: 'No, and that is the whole design. Government forms are revised without notice, so a copy served from our domain would be worse than none — it would look current, and somebody would file it. Every page links to the issuing authority and says plainly that the authority’s copy is the one that counts. When you click through to fill a US form, the current version is fetched from the agency at that moment and handed straight to the editor in your browser.',
  },
  {
    q: 'How current are the versions you state?',
    a: 'Each US form page states a version marker and the date we verified it at the agency. A scheduled job re-reads all of them every week — the marker off the document, the field count and page count off the real PDF — and emails us when any of it drifts. The Indian pages make no version claim, because there is nothing there to verify; what gets checked weekly instead is that every authority link still resolves.',
  },
  {
    q: 'Can DiemDesk file a form for me?',
    a: 'No. Nothing here submits anything to any agency, and nothing here is tax or legal advice. These are document tools and plain-English explainers. You fill and sign the form on your own machine, then file it yourself with the agency, which is the only party that can accept it.',
  },
  {
    q: 'What does "nothing is uploaded" mean in practice?',
    a: 'The fill, sign, merge, compress and redact tools open and rewrite the PDF inside the browser tab, using your own machine. The file is never sent to us, and we keep no copy because we never receive one. You do not have to take that on trust: open your browser’s Network tab before you choose a file and you will see no request carrying it.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'Government forms, explained and filled privately',
      description: `${total} US federal and Indian statutory forms, each linking to the issuing authority.`,
      url: 'https://diemdesk.com/forms',
      hasPart: libraries.map((l) => ({
        '@type': 'CollectionPage',
        name: l.title,
        url: `https://diemdesk.com${l.href}`,
      })),
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

const promises = [
  {
    icon: Link2Off,
    title: 'We host no copies',
    body: 'Not one form PDF is served from our domain. Every page points at the authority, because a stale copy that looks current is worse than no copy at all.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified, with a date',
    body: 'Where there is a version to verify, we state it and say when we last checked it against the agency — instead of wearing an "official" badge and linking to the source zero times.',
  },
  {
    icon: Hand,
    title: 'Filled on your device',
    body: 'A W-9 is a bare Social Security number. A 433-A lists every account you own. None of that needs to transit a third party, so none of it does.',
  },
];

export default function FormsHubPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" /> We host no copies · nothing uploaded
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Government forms, explained — and filled on your own device
          </h1>
          <p className="mt-3 text-muted-foreground">
            {total} forms from {authorities} issuing authorities across two libraries. For each one: what it is, who
            files it, the version the authority publishes today, and the mistake that costs people the most. You get
            the form from the authority and fill it here — the file never leaves your machine.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/fill-pdf-form">
                Open Fill PDF form <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            US versions, field counts and page counts are measured at the source.{' '}
            <CheckedAgo />.
          </p>
        </div>

        {/* The two libraries. Side by side rather than one above the other: they
            are peers, and stacking them would read as a primary and a footnote. */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {libraries.map((l) => (
            <section key={l.href} className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight">
                  <span aria-hidden className="mr-2">{l.flag}</span>
                  {l.title}
                </h2>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {l.count} forms
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{l.blurb}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {l.groups.map((g) => (
                  <li
                    key={g}
                    className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {g}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5 shrink-0" aria-hidden /> {l.stat}
              </p>
              <div className="mt-5 flex-1" />
              <Button asChild variant="outline" className="w-full">
                <Link href={l.href}>
                  {l.cta} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </section>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight">The three rules both libraries follow</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {promises.map((p) => (
              <div key={p.title} className="rounded-xl border bg-card p-4 shadow-soft">
                <p.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-2.5 text-sm font-semibold">{p.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
          <b className="text-foreground">Explainers, not tax or legal advice.</b> Filing dates, thresholds and
          eligibility change and are frequently extended, so treat everything here as orientation and the issuing
          authority as the authority. We host no copies of any form, and we file nothing on your behalf.
        </div>
        <ThirdPartyNotice
          className="mt-3"
          subject="the Internal Revenue Service, USCIS, the Income Tax Department, the EPFO or any other government body"
          because="Each form and authority is named so you can go to the source and check the current version for yourself"
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
      </main>
      <SiteFooter />
    </div>
  );
}
