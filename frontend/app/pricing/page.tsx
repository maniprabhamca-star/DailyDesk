'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  LayoutGrid, Check, Minus, ShieldCheck, CloudOff, Sparkles, Star, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Cell = boolean | string;
type Row = { label: string; free: Cell; pro: Cell; hint?: string };

const groups: { title: string; rows: Row[] }[] = [
  {
    title: 'Privacy & access',
    rows: [
      { label: 'Files processed in your browser — never uploaded', free: true, pro: true },
      { label: 'No ads, ever', free: true, pro: true },
      { label: 'No watermarks', free: true, pro: true },
      { label: 'Daily usage limit', free: 'Unlimited', pro: 'Unlimited' },
      { label: 'Desktop & mobile apps', free: true, pro: true },
    ],
  },
  {
    title: 'PDF & everyday tools',
    rows: [
      { label: 'Core PDF tools — merge, split, rotate, organize', free: true, pro: true },
      { label: 'Convert (JPG ↔ PDF, and more)', free: true, pro: true },
      { label: 'QR code & password generators', free: true, pro: true },
      { label: 'Maximum file size', free: '100 MB', pro: 'Unlimited' },
      { label: 'Compression', free: 'Standard', pro: 'Strong + target size' },
      { label: 'Batch processing — many files at once', free: false, pro: true },
      { label: 'Office conversions — PDF ↔ Word, Excel, PowerPoint', free: false, pro: true },
      { label: 'OCR — turn scanned PDFs into searchable text', free: false, pro: true },
      { label: 'Saved workflows — one-click multi-step automations', free: false, pro: true },
    ],
  },
  {
    title: 'AI & secure storage',
    rows: [
      { label: 'AI actions — summarize, chat, translate', free: '15 / month', pro: '2,000 / month' },
      { label: 'End-to-end encrypted File Vault', free: '1 GB', pro: 'Unlimited' },
    ],
  },
  {
    title: 'Speed & support',
    rows: [
      { label: 'Processing speed', free: 'Standard', pro: 'Priority' },
      { label: 'Support', free: 'Community', pro: 'Priority email' },
    ],
  },
];

const faqs = [
  { q: 'Is the free plan really free?', a: 'Yes — unlimited use of all our core tools, no ads, no watermarks, no credit card. Our everyday tools run in your browser, so they cost us nothing to give away.' },
  { q: 'What do I actually get with Pro?', a: 'Power features that go beyond the basics: batch processing, Office conversions (PDF↔Word/Excel/PPT), OCR, unlimited file size, saved workflows, 2,000 monthly AI actions, and unlimited encrypted File Vault storage.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel in one click — you keep Pro until the end of your paid period, then move to the free plan. And new subscribers are covered by our money-back guarantee (14 days monthly / 30 days annual).' },
  { q: 'Are my files safe?', a: 'Our tools never upload your files — everything happens on your device. The optional File Vault is end-to-end encrypted, so even we can’t read it. See our Security page for details.' },
];

function CellView({ value, accent }: { value: Cell; accent?: boolean }) {
  if (value === true) return <Check className={`mx-auto size-[18px] ${accent ? 'text-emerald-600' : 'text-emerald-600'}`} strokeWidth={2.75} />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" />;
  return <span className={`text-sm font-medium ${accent ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>{value}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const proPerMonth = annual ? '4.08' : '4.99';
  const proSub = annual ? '$49 billed yearly' : 'billed monthly';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><LayoutGrid className="size-[18px]" /></span>
            <span className="text-lg font-semibold tracking-tight">DailyDesk</span>
          </Link>
          <Link href="/#tools" className="ml-auto text-sm font-medium text-foreground/80 hover:text-foreground">All tools</Link>
          <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
            <ShieldCheck className="size-3.5" /> Private by design — your files never leave your device
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            Everything most people need is free, forever. Upgrade to Pro for power features, AI, and unlimited encrypted storage.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
          <button
            onClick={() => setAnnual((v) => !v)}
            className="relative h-7 w-12 rounded-full bg-muted transition-colors"
            aria-label="Toggle annual billing"
          >
            <span className={`absolute top-1 size-5 rounded-full bg-primary transition-all ${annual ? 'left-6' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annual <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">save ~18%</span>
          </span>
        </div>

        {/* Plan cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border bg-card p-7 shadow-soft">
            <h2 className="text-lg font-bold">Free</h2>
            <p className="mt-1 text-sm text-muted-foreground">For everyday document tasks.</p>
            <p className="mt-5"><span className="text-4xl font-bold">$0</span><span className="text-muted-foreground"> /forever</span></p>
            <Button asChild variant="outline" className="mt-6"><Link href="/register">Get started free</Link></Button>
            <ul className="mt-6 space-y-2.5 text-sm">
              {['Unlimited core PDF & everyday tools', 'No ads, no watermarks, no signup wall', 'Files stay in your browser', 'Files up to 100 MB', '15 AI actions / month', '1 GB encrypted File Vault'].map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 size-[18px] shrink-0 text-emerald-600" strokeWidth={2.75} /> {f}</li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-card p-7 shadow-lift">
            <span className="absolute -top-3 left-7 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              <Star className="size-3.5" /> Most popular
            </span>
            <h2 className="text-lg font-bold">Pro</h2>
            <p className="mt-1 text-sm text-muted-foreground">For power users & businesses.</p>
            <p className="mt-5"><span className="text-4xl font-bold">${proPerMonth}</span><span className="text-muted-foreground"> /month</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{proSub}</p>
            <Button asChild className="mt-6"><Link href="/register">Go Pro</Link></Button>
            <ul className="mt-6 space-y-2.5 text-sm">
              {['Everything in Free, with no limits', 'Batch processing — many files at once', 'Office conversions (PDF ↔ Word, Excel, PPT)', 'OCR — scanned PDFs to searchable text', 'Unlimited file size + strong compression', 'Saved one-click workflows', '2,000 AI actions / month', 'Unlimited encrypted File Vault', 'Priority speed & support'].map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 size-[18px] shrink-0 text-emerald-600" strokeWidth={2.75} /> {f}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          New subscribers protected by our <Link href="/refund-policy" className="font-medium text-primary hover:underline">money-back guarantee</Link> — 14 days monthly, 30 days annual.
        </p>

        {/* Comparison table */}
        <h2 className="mt-16 text-center text-2xl font-bold tracking-tight">Compare every feature</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 bg-background pb-3 text-left text-sm font-semibold"> </th>
                <th className="w-28 pb-3 text-center text-sm font-semibold">Free</th>
                <th className="w-40 rounded-t-xl bg-primary/5 pb-3 pt-3 text-center text-sm font-bold text-primary">Pro</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.title}>
                  <tr>
                    <td colSpan={3} className="bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.title}</td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.label} className="border-b">
                      <td className="border-b border-border/60 px-3 py-3 text-sm">{r.label}</td>
                      <td className="border-b border-border/60 px-3 py-3 text-center"><CellView value={r.free} /></td>
                      <td className="border-b border-border/60 bg-primary/5 px-3 py-3 text-center"><CellView value={r.pro} accent /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 pt-5"> </td>
                <td className="px-3 pt-5 text-center"><Button asChild variant="outline" size="sm"><Link href="/register">Start free</Link></Button></td>
                <td className="rounded-b-xl bg-primary/5 px-3 pb-5 pt-5 text-center"><Button asChild size="sm"><Link href="/register">Go Pro</Link></Button></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Privacy callout */}
        <div className="mt-16 rounded-2xl border bg-gradient-to-br from-emerald-50 to-background p-8 text-center dark:from-emerald-950/20">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white"><CloudOff className="size-6" strokeWidth={2.25} /></span>
          <h2 className="mt-4 text-xl font-bold tracking-tight">The privacy others can&rsquo;t match</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Unlike other PDF tools, DailyDesk processes your files right in your browser — they&rsquo;re never uploaded to a server. Free or Pro, your documents stay yours. <Link href="/security" className="font-medium text-primary hover:underline">How it works →</Link>
          </p>
        </div>

        {/* FAQ */}
        <h2 className="mt-16 text-center text-2xl font-bold tracking-tight">Pricing questions</h2>
        <div className="mx-auto mt-6 max-w-2xl divide-y rounded-xl border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg"><Link href="/register">Get started — it&rsquo;s free</Link></Button>
          <p className="mt-3 text-xs text-muted-foreground">No credit card required.</p>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-sm text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><LayoutGrid className="size-3.5" /></span> DailyDesk</span>
          <span className="flex gap-4 text-xs">
            <Link href="/security" className="hover:text-foreground">Security</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/refund-policy" className="hover:text-foreground">Refunds</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
