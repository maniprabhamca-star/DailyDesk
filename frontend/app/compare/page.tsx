import type { Metadata } from 'next';
import Link from 'next/link';
import { ALTERNATIVES } from '@/lib/alternatives';
import { Check, Minus, ShieldCheck, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { liveToolCount } from '@/components/app/catalog';
import { FORM_COUNT, US_FORM_COUNT, INDIA_FORM_COUNT, FORM_AUTHORITY_COUNT } from '@/lib/forms-count';
import { CHECKED_ON_LABEL } from '@/lib/us-forms';

export const metadata: Metadata = {
  title: 'DiemDesk vs Smallpdf, iLovePDF & Adobe — PDF Tools Compared',
  description:
    "An honest comparison of DiemDesk with Smallpdf, iLovePDF, Sejda and Adobe Acrobat: price, free-plan limits, privacy and features. Sourced July 2026.",
  alternates: { canonical: '/compare' },
  openGraph: {
    images: ['/og.png'],
    title: 'DiemDesk vs Smallpdf, iLovePDF & Adobe Acrobat',
    description: 'Price, free-plan limits, privacy and features — compared honestly, with sources.',
    type: 'website',
  },
};

// Columns: 0 = DiemDesk, 1 = Smallpdf, 2 = iLovePDF, 3 = Adobe Acrobat.
// Every competitor figure is from that company's published plans (July 2026) —
// sources are linked below the table. We keep competitor cells conservative:
// where a rival has a feature (often paid), we say so rather than overclaim.
type Cell = boolean | string;
const COLS = ['DiemDesk', 'Smallpdf', 'iLovePDF', 'Adobe Acrobat'] as const;

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell]; note?: string }[] = [
  {
    // All four figures re-read from the companies' own pricing pages on the
    // date in CHECKED_ON_LABEL. Two of ours were wrong before that: Smallpdf
    // was written as "~$10–15/mo" when their page shows $15.00, and Adobe as
    // "$19.99–29.99" when the plans page shows $14.99–24.99. A comparison table
    // that overstates a rival's price is the one kind of error that discredits
    // every other row on it.
    label: 'Price (paid plan)',
    cells: ['Free now · Pro ~$5.98/mo planned', '$15/mo billed yearly', '$5/mo billed yearly ($60/yr)', '$14.99–24.99/mo'],
  },
  {
    label: 'Free plan',
    cells: [
      'Every in-browser tool, no daily cap',
      'Daily download limit on 21 tools',
      '“Limited document processing” + ads',
      'Paid plans only',
    ],
    note:
      `Smallpdf’s own pricing page puts “Daily download limit” against 21 named tools on the free plan — including ` +
      `Merge, Split, Rotate, Delete Pages, Basic Compression, Annotator, Sign, Protect and every Office conversion. ` +
      `Lifting that cap is most of what their $15 buys. DiemDesk puts no cap on any in-browser tool at any price, ` +
      `including $0. Read on ${CHECKED_ON_LABEL}.`,
  },
  {
    label: 'Files stay on your device (no upload)',
    cells: [true, false, false, false],
    note: 'DiemDesk’s in-browser tools process files locally — they’re never uploaded. The others’ online tools run in the cloud (Adobe also sells a desktop app).',
  },
  { label: 'Use a tool without an account', cells: [true, 'For most', 'For most', 'Account required'] },
  { label: 'No ads, no watermarks on free', cells: [true, 'Some limits', 'Ads on free', '—'] },
  { label: 'Combine unlimited files free (merge, images → PDF)', cells: [true, 'Capped / paid', 'Up to 25 files', 'Trial only'] },
  {
    label: 'Beyond PDF — image, QR, dev, notes, budget & video tools',
    cells: [`${liveToolCount}+ tools`, 'PDF-focused', 'PDF-focused', 'PDF-focused'],
  },
  {
    // The counts come from lib/forms-count.ts, which tests/unit/forms-count.test.ts
    // pins to the real catalogues — a number on a comparison page is a claim.
    label: 'Guides to government forms — which one you need, and which revision',
    cells: [`${FORM_COUNT} forms, ${FORM_AUTHORITY_COUNT} authorities`, false, false, false],
    note:
      `All four can fill in a PDF form. Knowing WHICH form to fill is the different thing: DiemDesk publishes ` +
      `plain-English guides to ${US_FORM_COUNT} US federal and ${INDIA_FORM_COUNT} Indian statutory forms, each ` +
      `naming the revision we verified and the date we checked it, and linking to the agency that publishes it. ` +
      `We host no copies and charge nothing for any of it. Checked on ${CHECKED_ON_LABEL}: Smallpdf’s own tools ` +
      `page and iLovePDF’s home page list nothing of the kind. The sites that do sell this are template ` +
      `subscriptions — US Legal Forms publishes $8/mo and $15/mo plans — and they are selling you the document, ` +
      `not telling you which one you need.`,
  },
  {
    label: 'Redaction that truly removes text',
    cells: ['Yes + AI finds the personal info', 'Limited / paid', 'Paid', 'Paid'],
    note: 'DiemDesk rebuilds redacted pages so the text is gone, not just covered — and an AI pass can find names, IDs and account numbers for you to approve.',
  },
  {
    label: 'AI answers & summaries that cite the page',
    cells: ['Yes — every claim is checkable', 'AI, uncited', 'AI, uncited', 'AI, uncited'],
    note: 'Chat, summarize, translate and quiz your PDF — and DiemDesk’s AI cites the exact page for every answer, and never uploads the file (only the text it needs).',
  },
  {
    label: 'PDF → Excel, on your device & free',
    cells: [true, 'Paid / cloud', 'Paid / cloud', 'Paid'],
  },
  {
    label: 'PDF → Markdown (for notes & AI prompts)',
    cells: [true, false, false, false],
    note: 'Convert a PDF to clean Markdown — headings, lists and tables — on your device. None of the big names offer this; it’s built for the AI era.',
  },
  {
    label: 'Bates numbering for legal discovery, free',
    cells: [true, false, false, 'Paid (Acrobat Pro)'],
    note: 'Sequential legal stamps continuous across a whole file set — free and on-device here, a paid desktop feature elsewhere.',
  },
  {
    label: 'Read a PDF aloud (voice, on-device)',
    cells: [true, false, false, 'Yes (Reader)'],
    note: 'Listen to any PDF with your device’s own voice, following the highlighted text — no upload. Adobe’s desktop Reader can read aloud; Smallpdf and iLovePDF don’t.',
  },
  {
    label: 'End-to-end encrypted File Vault (we can’t read it)',
    cells: ['Yes (Pro)', false, false, 'Cloud storage (provider-readable)'],
    note: 'Files are encrypted on your device before upload — DiemDesk stores sealed boxes it cannot open. Mainstream cloud storage holds the keys.',
  },
  { label: 'Works in any modern browser, nothing to install', cells: [true, true, true, 'Desktop app / online'] },
];

const SOURCES = [
  { name: 'Smallpdf pricing', href: 'https://smallpdf.com/pricing' },
  { name: 'iLovePDF pricing', href: 'https://www.ilovepdf.com/pricing' },
  { name: 'Sejda pricing', href: 'https://www.sejda.com/upgrade' },
  { name: 'Adobe Acrobat plans', href: 'https://www.adobe.com/acrobat/plans.html' },
  // Read for the government-forms row: the first two to check what they list,
  // the third for the price quoted in that row's note.
  { name: 'Smallpdf tools list', href: 'https://smallpdf.com/pdf-tools' },
  { name: 'US Legal Forms pricing', href: 'https://www.uslegalforms.com/pricing/' },
  { name: 'DocuClipper pricing', href: 'https://www.docuclipper.com/pricing/' },
];

const faqs = [
  {
    q: 'Is DiemDesk a good Smallpdf or iLovePDF alternative?',
    a: 'Yes — DiemDesk covers the same everyday PDF jobs (merge, split, compress, sign and more) plus image, QR and video tools, with two big differences: the in-browser tools never upload your files, and they have no daily limits (only the server-side Office conversions have a small free daily allowance — 3 a day).',
  },
  {
    q: 'Do my files get uploaded like they do on other sites?',
    a: 'No. DiemDesk’s in-browser tools open and process your file on your own device, so it never leaves your browser. A few tools genuinely need a server (Office conversions, OCR, and the AI tools, which send only text — never the file); for those we’re upfront, process quickly and don’t keep your file.',
  },
  {
    q: 'Is it really free?',
    a: 'Every tool is free during launch, worldwide. Because the in-browser tools cost us nothing to run, they stay free. A later Pro plan will add scale features (batch, bigger server-tool files, search & pattern redaction, saved workflows) — we gate scale, never everyday quality.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

function Cellview({ value, primary }: { value: Cell; primary?: boolean }) {
  if (value === true) return <Check className={`mx-auto size-[18px] ${primary ? 'text-emerald-600' : 'text-emerald-600/80'}`} strokeWidth={2.75} />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" />;
  return <span className={`text-[13px] font-medium ${primary ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>{value}</span>;
}

export default function ComparePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" /> Compared honestly, with sources
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">DiemDesk vs Smallpdf, iLovePDF &amp; Adobe Acrobat</h1>
          <p className="mt-3 text-muted-foreground">
            The everyday PDF jobs are the same everywhere. What differs is the price, the daily limits, and whether your
            files are uploaded to someone else&rsquo;s server. Here&rsquo;s the honest picture — with links so you can
            check every figure yourself.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[34%] border-b bg-muted/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature
                </th>
                {COLS.map((c, i) => (
                  <th key={c} className={`border-b px-3 py-3 text-center text-sm font-bold ${i === 0 ? 'bg-primary/5 text-primary' : 'bg-muted/40'}`}>
                    {c}
                    {i === 0 && <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-emerald-600">Free during launch</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="align-middle">
                  <td className="border-b border-border/60 px-4 py-3">
                    <span className="font-medium">{r.label}</span>
                    {r.note && <span className="mt-0.5 block text-[11px] text-muted-foreground">{r.note}</span>}
                  </td>
                  {r.cells.map((cell, i) => (
                    <td key={i} className={`border-b border-border/60 px-3 py-3 text-center ${i === 0 ? 'bg-primary/5' : ''}`}>
                      <Cellview value={cell} primary={i === 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Competitor prices and limits are read from each company&rsquo;s own published plans, most recently on{' '}
          <strong>{CHECKED_ON_LABEL}</strong>. They change them without telling us — verify at the source:{' '}
          {SOURCES.map((s, i) => (
            <span key={s.href}>
              <a href={s.href} target="_blank" rel="nofollow noopener" className="text-primary hover:underline">{s.name}</a>
              {i < SOURCES.length - 1 ? ' · ' : ''}
            </span>
          ))}
          . Also worth a look: <strong>Sejda</strong> (free: 3 tasks/hour, 50&nbsp;MB, 200 pages; paid from ~$7.50/week).
        </p>

        {/* Per-competitor deep dives → the /*-alternative pages.
            Derived from ALTERNATIVES, not typed here. The first four were typed,
            the next five were not, and they shipped reachable from nowhere. */}
        <div className="mx-auto mt-10 max-w-3xl">
          <p className="text-center text-sm font-medium">Switching from a specific tool?</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALTERNATIVES.map((a) => (
              <Link
                key={a.slug}
                href={`/${a.slug}`}
                className="group rounded-xl border bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-soft"
              >
                <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
                  {a.name} alternative
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{a.hook}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Bank statement conversion — a different market, so a separate table.
            DocuClipper is not a PDF tool suite and putting it in the main grid
            would compare two things that do not compete, which flatters nobody
            and informs no one. The axis that matters here is cost per page,
            because that is the axis THEY chose: their own headline is "pay only
            for the pages you convert". */}
        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-xl font-semibold">Bank statement conversion, by the page</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
            Converting client statements is its own job with its own tools. The dedicated products meter by page, so
            that is the honest way to compare them — read from{' '}
            <a href="https://www.docuclipper.com/pricing/" target="_blank" rel="nofollow noopener" className="text-primary hover:underline">
              DocuClipper&rsquo;s pricing page
            </a>{' '}
            on {CHECKED_ON_LABEL}.
          </p>
          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-2.5 font-semibold">Plan</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Pages / month</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cost per page</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr:last-child]:border-0">
                <tr>
                  <td className="px-4 py-2.5">DocuClipper Starter</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$29.00/mo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">60</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$0.483</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">DocuClipper Starter <span className="text-muted-foreground">(annual)</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$20.30/mo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">60</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$0.338</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">DocuClipper Business <span className="text-muted-foreground">(annual)</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$111.30/mo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">640</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$0.174</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">DocuClipper Enterprise <span className="text-muted-foreground">(annual)</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$279.30/mo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">1,800</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$0.155</td>
                </tr>
                <tr className="bg-emerald-500/[0.07] font-semibold">
                  <td className="px-4 py-2.5">DiemDesk Business</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">$19.00/mo</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">300</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">$0.063</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Against their entry plan that is <strong className="text-foreground">7.6&times; cheaper per page</strong>,
            and we are still cheaper per page than their $279/mo tier. Two things worth saying in their favour, because
            a comparison that only flatters us is not worth reading:{' '}
            <strong className="text-foreground">every seat is included on their plans</strong> — that is their own
            headline and it is a real advantage over our single-user Business tier — and they sell overage pages at
            $0.10. Our parsing runs on your device, so there is no per-page cost to pass on and nothing to meter.
          </p>
        </section>

        {/* Honest caveats — never advertise what isn't live yet as if it were. */}
        <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 text-sm text-muted-foreground dark:border-amber-500/25 dark:bg-amber-950/10">
          <p>
            <strong className="text-foreground">Fair disclosure:</strong> DiemDesk is in pre-launch. Annotate, Redact
            and OCR are marked <em>coming soon</em> and roll out shortly; the Pro plan isn&rsquo;t on sale yet, so
            everything is currently free. We&rsquo;d rather show the full roadmap upfront than hide it.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-xl font-semibold">See it for yourself</h2>
          <p className="max-w-md text-sm text-muted-foreground">No signup, no upload, no watermark. Drop in a file and watch it work entirely in your browser.</p>
          <Button asChild size="lg" className="mt-1"><Link href="/#tools">Browse all tools <ArrowRight className="size-4" /></Link></Button>
        </div>

        <section className="mx-auto mt-16 max-w-2xl">
          <h2 className="text-center text-xl font-semibold">Questions</h2>
          <div className="mt-5 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card px-4 py-3">
                <summary className="cursor-pointer list-none font-medium marker:content-none">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mx-auto mt-14 max-w-2xl rounded-xl border border-border bg-muted/40 p-4 text-center text-sm leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Trademark &amp; affiliation notice</p>
          <p>
            DiemDesk is an independent product and is <strong>not affiliated with, endorsed by, or sponsored by</strong>{' '}
            any of the companies named on this page. All product and company names, including Adobe Acrobat, iLovePDF,
            Smallpdf and US Legal Forms, are trademarks of their respective owners, used only for identification and
            honest comparison. Every figure here was read from the company&rsquo;s own page on the date stated beside
            it; they change their prices without telling us, so check the source links above before relying on one.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
