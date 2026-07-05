import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus, ShieldCheck, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { liveToolCount } from '@/components/app/catalog';

export const metadata: Metadata = {
  title: 'DiemDesk vs Smallpdf, iLovePDF & Adobe — PDF Tools Compared',
  description:
    'An honest comparison of DiemDesk with Smallpdf, iLovePDF, Sejda and Adobe Acrobat: price, free-plan limits, privacy and features. Prices from each vendor’s published plans (July 2026).',
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
    label: 'Price (paid plan)',
    cells: ['Free now · Pro ~$5.98/mo planned', '~$10–15/mo', '$5–9/mo', '$19.99–29.99/mo'],
  },
  {
    label: 'Free plan',
    cells: ['Every tool, no daily cap', '2 tasks / day', 'Limited tasks + ads', '7-day trial only'],
  },
  {
    label: 'Files stay on your device (no upload)',
    cells: [true, false, false, false],
    note: 'DiemDesk’s in-browser tools process files locally — they’re never uploaded. The others are cloud services.',
  },
  { label: 'Use a tool without an account', cells: [true, 'For most', 'For most', 'Account required'] },
  { label: 'No ads, no watermarks on free', cells: [true, 'Some limits', 'Ads on free', '—'] },
  { label: 'Combine unlimited files free (merge, images → PDF)', cells: [true, 'Capped / paid', 'Up to 25 files', 'Trial only'] },
  {
    label: 'Beyond PDF — image, QR, password & video tools',
    cells: [`${liveToolCount}+ tools`, 'PDF-focused', 'PDF-focused', 'PDF-focused'],
  },
  {
    label: 'Redaction that truly removes text',
    cells: ['Free (coming soon) + Pro search & patterns', 'Limited / paid', 'Paid', 'Paid'],
  },
  { label: 'Works in any modern browser, nothing to install', cells: [true, true, true, 'Desktop app / online'] },
];

const SOURCES = [
  { name: 'Smallpdf pricing', href: 'https://smallpdf.com/pricing' },
  { name: 'iLovePDF pricing', href: 'https://www.ilovepdf.com/pricing' },
  { name: 'Sejda pricing', href: 'https://www.sejda.com/upgrade' },
  { name: 'Adobe Acrobat pricing', href: 'https://www.adobe.com/acrobat/pricing.html' },
];

const faqs = [
  {
    q: 'Is DiemDesk a good Smallpdf or iLovePDF alternative?',
    a: 'Yes — DiemDesk covers the same everyday PDF jobs (merge, split, compress, convert, sign and more) plus image, QR and video tools, with two big differences: the in-browser tools never upload your files, and there are no daily task limits on the free plan.',
  },
  {
    q: 'Do my files get uploaded like they do on other sites?',
    a: 'No. DiemDesk’s in-browser tools open and process your file on your own device, so it never leaves your browser. A few tools genuinely need a server (Office conversions and — later — OCR); for those we’re upfront, process quickly and don’t keep your file.',
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
          Competitor prices and limits are from each company&rsquo;s published plans as of <strong>July 2026</strong> and
          may change — verify at the source:{' '}
          {SOURCES.map((s, i) => (
            <span key={s.href}>
              <a href={s.href} target="_blank" rel="nofollow noopener" className="text-primary hover:underline">{s.name}</a>
              {i < SOURCES.length - 1 ? ' · ' : ''}
            </span>
          ))}
          . Also worth a look: <strong>Sejda</strong> (free: 3 tasks/hour, 50&nbsp;MB, 200 pages; paid from ~$7.50/week).
        </p>

        {/* Per-competitor deep dives (internal links → the /*-alternative pages). */}
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-sm font-medium">Switching from a specific tool?</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
            <Link href="/smallpdf-alternative" className="text-primary hover:underline">Smallpdf alternative</Link>
            <Link href="/ilovepdf-alternative" className="text-primary hover:underline">iLovePDF alternative</Link>
            <Link href="/sejda-alternative" className="text-primary hover:underline">Sejda alternative</Link>
            <Link href="/adobe-acrobat-alternative" className="text-primary hover:underline">Adobe Acrobat alternative</Link>
          </div>
        </div>

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
      </main>
      <SiteFooter />
    </div>
  );
}
