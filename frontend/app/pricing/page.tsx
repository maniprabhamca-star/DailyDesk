'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  Check, Minus, ShieldCheck, CloudOff, Lock, Star, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProCheckout } from '@/components/app/pro-checkout';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { PRICING } from '@/lib/pricing';

type Cell = boolean | string;
type Row = { label: string; comp: Cell; free: Cell; pro: Cell; link?: { href: string; text: string } };

const groups: { title: string; rows: Row[] }[] = [
  {
    title: 'Value & trust',
    rows: [
      { label: 'Price per year', comp: 'Up to ~$240', free: '$0', pro: '~$49' },
      { label: 'Tools available', comp: '~21', free: '25+', pro: '25+' },
      { label: 'Works offline in your browser', comp: 'Paid apps only', free: 'Coming soon', pro: 'Coming soon', link: { href: '/security#offline', text: 'See how it works' } },
      { label: 'No signup required to use tools', comp: false, free: true, pro: true },
      { label: 'Money-back guarantee', comp: 'Conditional / none', free: 'Always free', pro: '14–30 days, no questions' },
    ],
  },
  {
    title: 'Privacy & access',
    rows: [
      { label: 'Core tools processed in your browser — never uploaded', comp: 'Uploaded to their servers', free: true, pro: true },
      { label: 'No ads', comp: 'Ads on free plans', free: true, pro: true },
      { label: 'No watermarks', comp: true, free: true, pro: true },
      { label: 'Daily usage limit', comp: 'Often ~2 tasks/day', free: 'Unlimited', pro: 'Unlimited' },
      { label: 'Desktop & mobile apps', comp: 'Paid only', free: true, pro: true },
    ],
  },
  {
    title: 'PDF & everyday tools',
    rows: [
      { label: 'Core PDF tools — merge, split, rotate, organize', comp: 'Limited per day', free: true, pro: true },
      { label: 'Convert (JPG ↔ PDF, and more)', comp: 'Limited per day', free: true, pro: true },
      { label: 'QR code & password generators', comp: 'Rarely offered', free: true, pro: true },
      { label: 'Maximum file size', comp: '~25–100 MB', free: '100 MB', pro: 'Unlimited' },
      { label: 'Compression', comp: 'Basic free / strong paid', free: 'Strong & Maximum', pro: 'Strong & Maximum' },
      { label: 'Edit & annotate — highlight, draw, fill, sign', comp: 'Limited per day', free: true, pro: true },
      { label: 'Full in-place text editing — change existing text', comp: 'Paid only', free: false, pro: true },
      { label: 'Batch processing — many files at once', comp: 'Paid only', free: false, pro: true },
      { label: 'Office conversions — PDF ↔ Word, Excel, PowerPoint', comp: 'Paid / limited', free: false, pro: true },
      { label: 'OCR — scanned PDFs to searchable text', comp: 'Paid only', free: false, pro: true },
      { label: 'Saved workflows — one-click automations', comp: 'Paid only', free: false, pro: true },
    ],
  },
  {
    title: 'AI & secure storage',
    rows: [
      { label: 'AI actions — summarize, chat, translate', comp: 'None free / paid credits', free: '5 / day', pro: '70 / day' },
      { label: 'Opt-in encrypted File Vault (optional cloud storage)', comp: 'Not offered', free: '1 GB', pro: 'Unlimited' },
    ],
  },
  {
    title: 'Speed & support',
    rows: [
      { label: 'Processing speed', comp: 'Standard', free: 'Standard', pro: 'Priority' },
      { label: 'Support', comp: 'Email (paid)', free: 'Community', pro: 'Priority email' },
    ],
  },
];

const faqs = [
  { q: 'Is the free plan really free?', a: 'Yes — unlimited use of all our core tools, no ads, no watermarks, no credit card. Our everyday tools run in your browser, so they cost us nothing to give away.' },
  { q: 'Can I edit a PDF for free?', a: 'Yes. Annotating, highlighting, drawing, filling forms, and signing are free and unlimited. Only full in-place text editing — rewriting the existing text inside a PDF — is a Pro feature, the same as Adobe, Foxit, and Smallpdf.' },
  { q: 'What do I actually get with Pro?', a: 'Power features beyond the basics: full text editing, batch processing, Office conversions (PDF↔Word/Excel/PPT), OCR, unlimited file size, saved workflows, 70 AI actions a day, and unlimited encrypted File Vault storage.' },
  { q: 'Can I cancel anytime?', a: 'Yes — cancel in one click; you keep Pro until the end of your paid period. New subscribers are also covered by our money-back guarantee (14 days monthly / 30 days annual).' },
  { q: 'Do you store my files?', a: 'No — by default nothing is saved on our servers. Our everyday tools process your files right in your browser. A few Pro tools do use our servers — Office conversions and OCR (processed, then deleted) and AI (sent for that one request) — but nothing is stored. The only feature that stores files is the optional File Vault, and it’s encrypted on your device before upload, so even we can’t read it. The 1 GB / unlimited figures apply only to that opt-in Vault.' },
  { q: 'Are my files safe?', a: 'Our everyday tools never upload your files — everything happens on your device. The few Pro tools that need a server (AI, Office conversions, OCR) are minimal and we’re upfront about them, and the optional File Vault is end-to-end encrypted so even we can’t read it. See our Security page for details.' },
];

function CellView({ value, tone }: { value: Cell; tone?: 'pro' | 'muted' }) {
  if (value === true) return <Check className={`mx-auto size-[18px] ${tone === 'muted' ? 'text-muted-foreground' : 'text-emerald-600'}`} strokeWidth={2.75} />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" />;
  return (
    <span className={`text-[13px] font-medium ${tone === 'pro' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground'}`}>{value}</span>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const proPerMonth = annual ? PRICING.pro.annualPerMonth : PRICING.pro.monthly;
  const proSub = annual ? PRICING.pro.annualNote : 'billed monthly';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
            <ShieldCheck className="size-3.5" /> Private by design — in-browser tools never upload your files
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            Everything most people need is free, forever. Upgrade to Pro for power features, AI, and unlimited encrypted storage.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
          <button onClick={() => setAnnual((v) => !v)} className="relative h-7 w-12 rounded-full bg-muted transition-colors" aria-label="Toggle annual billing">
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
              {PRICING.freeFeatures.map((f) => (
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
            <ProCheckout className="mt-6" interval={annual ? 'year' : 'month'} />
            <ul className="mt-6 space-y-2.5 text-sm">
              {PRICING.proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 size-[18px] shrink-0 text-emerald-600" strokeWidth={2.75} /> {f}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          New subscribers protected by our <Link href="/refund-policy" className="font-medium text-primary hover:underline">money-back guarantee</Link> — 14 days monthly, 30 days annual.
        </p>

        {/* Comparison table */}
        <h2 className="mt-16 text-center text-2xl font-bold tracking-tight">How we compare</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">See exactly what you get with DiemDesk versus typical competitor free plans.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="pb-3 text-left text-sm font-semibold"> </th>
                <th className="w-44 pb-3 text-center align-bottom text-sm font-semibold text-muted-foreground">
                  Competitors
                  <span className="block text-[11px] font-normal text-muted-foreground/70">typical free plan</span>
                </th>
                <th className="w-28 pb-3 text-center align-bottom text-sm font-semibold">DiemDesk<span className="block text-[11px] font-normal text-muted-foreground">Free</span></th>
                <th className="w-36 rounded-t-xl bg-primary/5 px-2 pb-3 pt-3 text-center align-bottom text-sm font-bold text-primary">DiemDesk<span className="block text-[11px] font-semibold">Pro</span></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.title}>
                  <tr>
                    <td colSpan={4} className="bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.title}</td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.label}>
                      <td className="border-b border-border/60 px-3 py-3 text-sm">
                        {r.label}
                        {r.link && <Link href={r.link.href} className="ml-2 whitespace-nowrap text-xs font-medium text-primary hover:underline">{r.link.text} →</Link>}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3 text-center"><CellView value={r.comp} tone="muted" /></td>
                      <td className="border-b border-border/60 px-3 py-3 text-center"><CellView value={r.free} /></td>
                      <td className="border-b border-border/60 bg-primary/5 px-3 py-3 text-center"><CellView value={r.pro} tone="pro" /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 pt-5"> </td>
                <td className="px-3 pt-5"> </td>
                <td className="px-3 pt-5 text-center"><Button asChild variant="outline" size="sm"><Link href="/register">Start free</Link></Button></td>
                <td className="rounded-b-xl bg-primary/5 px-3 pb-5 pt-5 text-center"><ProCheckout size="sm" interval={annual ? 'year' : 'month'} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Competitor details reflect typical free tiers of major PDF tools and may change.</p>

        {/* Storage clarity — tools never stored vs opt-in vault */}
        <div className="mt-10 rounded-2xl border bg-card p-6 shadow-soft">
          <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-emerald-600" strokeWidth={2.25} /> How storage works — no surprises</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CloudOff className="size-4 text-emerald-600" /> Everyday tools — nothing is stored</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">When you use our everyday in-browser tools — merge, compress, edit, sign and more — your files are processed entirely on your device and <strong>never reach our servers</strong>. By default, DiemDesk saves nothing — there&rsquo;s nothing to leak.</p>
            </div>
            <div className="rounded-xl bg-emerald-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Lock className="size-4 text-emerald-600" /> File Vault — optional &amp; encrypted</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">The File Vault is the <strong>only</strong> feature that stores files — and <strong>only if you choose</strong> to save one. Even then it&rsquo;s encrypted on your device first, so <strong>we can never read it</strong>. <Link href="/security#file-vault" className="font-medium text-primary hover:underline">Learn more →</Link></p>
            </div>
          </div>
        </div>

        {/* Privacy callout */}
        <div className="mt-16 rounded-2xl border bg-gradient-to-br from-emerald-50 to-background p-8 text-center dark:from-emerald-950/20">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white"><CloudOff className="size-6" strokeWidth={2.25} /></span>
          <h2 className="mt-4 text-xl font-bold tracking-tight">The privacy others can&rsquo;t match</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Unlike other PDF tools, DiemDesk runs your everyday tools right in your browser — those files are never uploaded. The few tools that need a server (AI, Office conversions, OCR) are minimal and transparent. Free or Pro, your documents stay yours. <Link href="/security" className="font-medium text-primary hover:underline">How it works →</Link>
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

      <SiteFooter />
    </div>
  );
}
