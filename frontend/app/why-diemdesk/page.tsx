import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck, Zap, BadgeCheck, Sparkles, Globe2, HandCoins, ArrowRight, Scale,
  FileText, PenLine, Repeat, ImageIcon, Eye, CheckCircle2, MinusCircle,
} from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';

export const metadata: Metadata = {
  title: 'Why DiemDesk? The Honest Case for Switching | DiemDesk',
  description:
    'Your files never leave your device, the free tier is actually free — and we say where the big names still win. The honest case for switching.',
  alternates: { canonical: '/why-diemdesk' },
  openGraph: {
    images: ['/og.png'],
    title: 'Why DiemDesk? The honest case for switching',
    description: 'On-device privacy you can verify, a free tier that is actually free — and an honest list of where the big names still win.',
    type: 'website',
  },
};

const FAQS = [
  {
    q: 'How do I verify that my file really never leaves my device?',
    a: 'Open your browser’s developer tools (F12 → Network tab), then run any on-device tool. You will see no upload request carrying your file — the processing engine runs inside your browser. No other proof required: your own browser is the witness.',
  },
  {
    q: 'If the tools are free and private, how does DiemDesk make money?',
    a: 'On-device tools cost us almost nothing to run, so they stay free and unlimited. We charge for the things that genuinely cost us money or add pro-grade power: server conversions beyond the free daily allowance, OCR, the AI document suite, batch processing and the encrypted File Vault.',
  },
  {
    q: 'Is DiemDesk really unlimited on the free plan?',
    a: 'Every in-browser tool: yes — no daily task caps, no watermarks, no signup, files up to 100 MB. The few server-processed tools (Office conversions) include 3 free per day. We publish the exact line on the pricing page.',
  },
  {
    q: 'What does DiemDesk honestly not do as well as Adobe or iLovePDF?',
    a: 'Adobe’s desktop Acrobat is deeper for print production and preflight. iLovePDF offers a layout-preserving translation mode we deliberately skipped in v1 (we translate the text faithfully instead). We list the current gaps openly on this page and close them release by release — the changelog is the receipt.',
  },
];

const PILLARS = [
  {
    icon: ShieldCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    title: 'Privacy you can verify, not trust',
    body: 'The big online tools upload your file to their servers to process it — the worst place for a bank statement or a contract. DiemDesk processes on your device. Don’t take our word: open DevTools (F12 → Network) and watch. No upload happens.',
  },
  {
    icon: HandCoins,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
    title: 'A free tier that is actually free',
    body: 'The famous names cap you at 1–2 tasks a day, watermark your output, or gate basics behind trials. Here, every in-browser tool is free and unlimited — no signup, no watermark, files up to 100 MB. That’s the permanent deal, not a promotion.',
  },
  {
    icon: Zap,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
    title: 'Speed without a queue',
    body: 'No upload, no server queue, no download-your-result wait. In our benchmark, a 27 MB scanned deck compressed to 6.8 MB right in the browser — the same file barely shrank on two big-name online compressors. A 1 GB PDF rotates in under a minute, on-device.',
  },
  {
    icon: Sparkles,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/30',
    title: 'AI you can check',
    body: 'Our AI summaries, answers and quiz questions cite the page they came from — click the chip, verify the claim. Competitors hand you an answer and ask for faith. And even with AI, the file itself never leaves your device: only text goes, and only when you ask.',
  },
  {
    icon: BadgeCheck,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    title: 'True redaction, not black paint',
    body: 'Many tools draw a black box over text — the words are still in the file, one copy-paste away from a data leak. DiemDesk rebuilds redacted pages so the content underneath is permanently gone, and verifies it after export.',
  },
  {
    icon: Globe2,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    title: 'Built India-first, priced worldwide',
    body: 'Hindi, Tamil, Telugu and eight more Indian languages front-and-centre in translation. AI that recognises PAN and Aadhaar as identity data worth protecting. Tools that respect metered data by not uploading in the first place.',
  },
];

const GROUPS = [
  {
    icon: FileText,
    title: 'PDF essentials — merge, split, compress, convert',
    points: [
      'Everything runs in your browser: merge, split, compress, rotate, reorder, page numbers, watermark — unlimited, no queue.',
      'Compress is DPI-aware, not a blind quality slider: it analyses each page and keeps text crisp while images slim down.',
      'Split by max file size — “make every part under 10 MB for email” — which most big names still don’t offer.',
    ],
    href: '/#tools',
    linkLabel: 'Browse the PDF tools',
  },
  {
    icon: PenLine,
    title: 'Editors — annotate, sign, fill, redact, edit',
    points: [
      'Sign, annotate and fill forms with your file on your screen only — signatures never touch a server.',
      'Redact performs true removal (the text is gone from the file, verified after export), with regex presets and an AI finder that you approve item by item.',
      'Your work auto-saves on-device: close the tab, come back, everything is where you left it.',
    ],
    href: '/redact-pdf',
    linkLabel: 'See true redaction',
  },
  {
    icon: Repeat,
    title: 'Conversions & data',
    points: [
      'PDF → Excel extracts real editable tables on your device — the single most privacy-sensitive conversion there is, and the big names all do it server-side.',
      'Images ↔ PDF, HEIC → JPG, and Office conversions (3 free per day; unlimited on Pro because those genuinely run on servers — we say so instead of pretending).',
      '16 developer utilities — JSON, CSV, hashes, regex — instant and local.',
    ],
    href: '/pdf-to-excel',
    linkLabel: 'Try PDF → Excel',
  },
  {
    icon: ImageIcon,
    title: 'Images & media',
    points: [
      'Compress-to-target-size: “make this photo under 200 KB” for visa portals and forms — with country presets.',
      'Passport photos for 45+ countries with auto face placement, background removal on-device (the 46 MB AI model downloads to your browser, your photo stays with you).',
      'Strip EXIF location data before sharing — the privacy chore everyone forgets.',
    ],
    href: '/compress-to-size',
    linkLabel: 'Compress to a target size',
  },
];

const HONEST_GAPS = [
  { have: false, text: 'Adobe’s desktop Acrobat is still deeper for print production, preflight and PDF/X workflows. If that’s your day job, you need Acrobat — we’d rather tell you than waste your afternoon.' },
  { have: false, text: 'iLovePDF offers layout-preserving PDF translation; our v1 deliberately translates text faithfully (side-by-side) instead of attempting layout reconstruction. Layout-preserving is on our roadmap; theirs exists today.' },
  { have: false, text: 'No native iOS app yet. Android works via the installable web app (share from Gmail works); iPhone users get the browser experience for now.' },
  { have: false, text: 'OCR and Office conversions run on servers (with clear free limits) — physics, not policy: those engines don’t fit in a browser yet. We label every server tool with a badge so you always know which is which.' },
];

export default function WhyDiemDeskPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="flex-1">
        {/* hero */}
        <section className="border-b bg-gradient-to-b from-primary/[0.06] to-transparent">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">The switch question</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Why DiemDesk?</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Fair question — the big names work. Here’s the honest answer: they work <b className="text-foreground">by taking your files</b>.
              Every upload of a statement, a contract, a medical report is a copy of your life on someone else’s server.
              DiemDesk does the same jobs <b className="text-foreground">on your device</b> — and where we’re not better yet, we say so, on this page.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/#tools" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90">
                Try any tool free <ArrowRight className="size-4" />
              </Link>
              <Link href="/compare" className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-2.5 text-sm font-bold transition hover:border-primary/50">
                <Scale className="size-4 text-primary" /> The full comparison table
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No signup. No watermark. Verify the privacy claim yourself: F12 → Network → run a tool.</p>
          </div>
        </section>

        {/* pillars */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Six differences you can check</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">Not marketing adjectives — specific, testable differences. Every one links to a way to verify it.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.title} className={`rounded-2xl border p-6 shadow-soft transition-shadow hover:shadow-md ${p.bg}`}>
                <p.icon className={`size-6 ${p.color}`} />
                <h3 className="mt-3 text-base font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* per-group benefits */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Tool by tool: what’s actually different</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {GROUPS.map((g) => (
                <div key={g.title} className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><g.icon className="size-5" /></span>
                    <h3 className="text-base font-bold leading-snug">{g.title}</h3>
                  </div>
                  <ul className="mt-4 flex-1 space-y-2.5">
                    {g.points.map((pt, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={g.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                    {g.linkLabel} <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* honest gaps */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl border-2 border-amber-500/30 bg-amber-500/[0.06] p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <Eye className="size-6 text-amber-600 dark:text-amber-400" />
              <h2 className="text-2xl font-bold tracking-tight">Where the big names still beat us — honestly</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A benefits page that only lists benefits is an advertisement. Here’s the other side, kept current —
              when we close a gap, it moves to the <Link href="/changelog" className="font-semibold text-primary hover:underline">changelog</Link>.
            </p>
            <ul className="mt-6 space-y-3">
              {HONEST_GAPS.map((gap, i) => (
                <li key={i} className="flex gap-3 rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
                  <MinusCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{gap.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
            Statements about other products describe their <strong>online tools</strong> as published by each company as of{' '}
            <strong>July 2026</strong> and may change — verify at the source, and see the{' '}
            <Link href="/compare" className="text-primary hover:underline">side-by-side table with sources</Link>. Our speed figures
            are from our own benchmarks on our test files; your files and hardware will vary — every tool is free to try, so the
            best benchmark is yours. Adobe, Acrobat, iLovePDF and Smallpdf are trademarks of their respective owners; DiemDesk is
            not affiliated with them. Spot something outdated or unfair? <Link href="/feedback" className="text-primary hover:underline">Tell us</Link> — we&rsquo;ll fix it.
          </p>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight">The questions switchers ask</h2>
          <div className="mt-6 divide-y rounded-2xl border bg-card">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border bg-gradient-to-br from-primary/10 to-violet-500/10 p-8 text-center">
            <h3 className="text-xl font-bold">The fastest way to decide is to try one file.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Drop it in, watch the Network tab stay quiet, keep the result. No account, nothing to cancel.</p>
            <Link href="/#tools" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90">
              Open the toolkit <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
