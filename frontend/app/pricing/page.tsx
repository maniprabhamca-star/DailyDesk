'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check, Minus, ShieldCheck, CloudOff, Lock, Star, ChevronDown, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProCheckout } from '@/components/app/pro-checkout';
import { ProWaitlist } from '@/components/app/pro-waitlist';
import { WAITLIST_MODE } from '@/lib/flags';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { PRICING } from '@/lib/pricing';
import { useCurrency, currencySymbol, fmtAmount, price, PRO_PRICE, BUSINESS_PRICE, STATEMENT_PRICE, STATEMENT_PAGES, AI_ACTIONS } from '@/lib/currency';
import { useIsOwner } from '@/lib/plan';
import { liveToolCount } from '@/components/app/catalog';
// Numbers only — importing US_FORMS/INDIA_FORMS here would pull ~1,300 lines of
// form data into the client bundle of a pricing page. See lib/forms-count.ts.
import { FORM_COUNT, US_FORM_COUNT, INDIA_FORM_COUNT, FORM_AUTHORITY_COUNT } from '@/lib/forms-count';
import { Landmark } from 'lucide-react';

type Cell = boolean | string;
// `business` is OPTIONAL on purpose, and the renderer falls back to `pro` when
// it is absent. Business IS Pro plus volume, so a row that repeats the Pro value
// in a third column is noise — and worse, the day somebody improves a Pro cell
// and forgets its twin, the table silently claims Business is worse than Pro.
// Specify it only where the tier genuinely differs.
type Row = { label: string; comp: Cell; free: Cell; pro: Cell; business?: Cell; link?: { href: string; text: string } };
const businessCell = (r: Row): Cell => (r.business !== undefined ? r.business : r.pro);

const baseGroups: { title: string; rows: Row[] }[] = [
  {
    title: 'Value & trust',
    // "Price per year" free/pro cells are made currency-aware in the component;
    // the competitor figure stays USD because those products bill in USD.
    rows: [
      { label: 'Price per year', comp: 'Up to ~$240', free: '$0', pro: '~$60', business: '~$190' },
      { label: 'Tools available', comp: '~21', free: `${liveToolCount}+`, pro: `${liveToolCount}+` },
      { label: 'Works offline in your browser', comp: 'Paid apps only', free: 'Not yet', pro: 'Not yet', link: { href: '/security#offline', text: 'Where this stands' } },
      { label: 'No signup required to use tools', comp: false, free: true, pro: true },
      { label: 'Money-back guarantee', comp: 'Conditional / none', free: 'Always free', pro: '14 days, no questions' },
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
      { label: 'File size — in-browser tools (compress, merge, edit, images)', comp: 'Big, but ~2 runs/day', free: '100 MB, unlimited runs', pro: 'Unlimited' },
      { label: 'Office conversions (server-side)', comp: 'Paid / capped', free: '3 free a day', pro: 'Unlimited' },
      { label: 'Compression', comp: 'Basic free / strong paid', free: 'Strong & Maximum', pro: 'Strong & Maximum' },
      { label: 'Fill forms & e-sign', comp: 'Limited per day', free: true, pro: true, link: { href: '/forms', text: 'The forms library' } },
      { label: 'Annotate — highlight, draw, box & comment', comp: 'Paid / limited', free: 'Coming soon', pro: 'Coming soon' },
      { label: 'Redact — permanently remove sensitive text', comp: 'Covers only / paid', free: 'Coming soon', pro: 'Coming soon' },
      { label: 'Search & pattern redact (emails, SSNs, cards)', comp: 'Paid only', free: false, pro: 'Coming soon' },
      { label: 'Full in-place text editing — change existing text', comp: 'Paid only', free: false, pro: true },
      { label: 'Batch processing — many files at once', comp: 'Paid only', free: false, pro: true },
      { label: 'Office conversions — PDF ↔ Word, Excel, PowerPoint', comp: 'Paid / limited', free: 'Single files', pro: 'Single + batch' },
      { label: 'OCR — scanned PDFs to searchable text', comp: 'Paid only', free: 'Coming soon', pro: 'Coming soon' },
      { label: 'Saved workflows — one-click automations', comp: 'Paid only', free: false, pro: true },
    ],
  },
  {
    // The forms libraries were missing from this table entirely, which meant the
    // page argued for us on tools every competitor also has and said nothing
    // about the one thing none of them do. They are free, and they stay free —
    // this group exists to make a free advantage visible, not to gate it.
    //
    // Every row here is identical across Free, Pro and Business on purpose. The
    // Business column inherits automatically (see `businessCell`), so repeating
    // the value would be noise.
    title: 'Government forms',
    rows: [
      {
        label: 'Plain-English guides to official forms',
        comp: 'Not offered',
        free: `${FORM_COUNT} forms, ${FORM_AUTHORITY_COUNT} authorities`,
        pro: `${FORM_COUNT} forms, ${FORM_AUTHORITY_COUNT} authorities`,
        link: { href: '/forms', text: 'Browse them' },
      },
      { label: `US federal forms — IRS, USCIS & more`, comp: 'Not offered', free: `${US_FORM_COUNT} forms`, pro: `${US_FORM_COUNT} forms` },
      { label: 'Indian statutory forms — income tax, GST, EPFO', comp: 'Not offered', free: `${INDIA_FORM_COUNT} forms`, pro: `${INDIA_FORM_COUNT} forms` },
      { label: 'Every form re-checked at the source, with the date shown', comp: false, free: true, pro: true },
      { label: 'No account needed to read any of it', comp: false, free: true, pro: true },
    ],
  },
  {
    title: 'AI & secure storage',
    rows: [
      { label: 'AI actions — summarize, chat, translate', comp: 'None free / paid credits', free: 'Coming soon', pro: `${AI_ACTIONS.pro} a month`, business: `${AI_ACTIONS.business} a month` },
      { label: 'Opt-in encrypted File Vault (optional cloud storage)', comp: 'Not offered', free: 'Coming soon', pro: 'Coming soon' },
    ],
  },
  {
    // The Bank Statement Converter used to sit below this table as its own price
    // list, which is exactly how we ended up selling two subscriptions that do
    // not add up to a plan. It is a row in the table now, because that is what
    // it is: an allowance that rises with the tier.
    title: 'Bank statements',
    rows: [
      { label: 'Bank statement pages a month', comp: 'Separate product ($29+/mo)', free: `${STATEMENT_PAGES.free} pages`, pro: `${STATEMENT_PAGES.pro} pages`, business: `${STATEMENT_PAGES.business} pages` },
      { label: 'Every row reconciled against the running balance', comp: false, free: true, pro: true },
      { label: 'Export to Tally, QuickBooks (QBO) & OFX', comp: 'QBO/OFX only', free: false, pro: false, business: true },
      { label: 'Saved per-client presets', comp: 'Paid only', free: false, pro: false, business: true },
    ],
  },
  {
    title: 'Speed & support',
    rows: [
      { label: 'Processing speed', comp: 'Standard', free: 'Standard', pro: 'Priority' },
      { label: 'Support', comp: 'Email (paid)', free: 'Community', pro: 'Priority email', business: 'Priority email' },
      { label: 'Invoiced billing', comp: 'Enterprise only', free: false, pro: false, business: 'On request' },
    ],
  },
];

const faqs = [
  { q: 'Is the free plan really free?', a: 'Yes — unlimited use of all our core tools, no ads, no watermarks, no credit card. Our everyday tools run in your browser, so they cost us nothing to give away.' },
  { q: 'Can I edit a PDF for free?', a: 'Yes. Annotating, highlighting, drawing, filling forms, and signing are free and unlimited. Only full in-place text editing — rewriting the existing text inside a PDF — is a Pro feature, the same as Adobe, Foxit, and Smallpdf.' },
  { q: 'What do I actually get with Pro?', a: 'Scale and power features: batch processing (many files at once), unlimited file size (Free already handles up to 100 MB in your browser), unlimited Office conversions and OCR, full in-place text editing, saved workflows, and priority speed. On-device batch, an encrypted File Vault, a defensible redaction certificate, and more AI come a little later. To be clear: the in-browser tools stay free and unlimited — Free also includes 3 Office conversions a day, and Pro removes that cap.' },
  { q: 'Do I have to pay for the forms library?', a: `No, and there is no plan on this page that unlocks more of it. All ${FORM_COUNT} forms across ${FORM_AUTHORITY_COUNT} issuing authorities are readable without an account, and the tools for filling and signing them are free too. We do not host copies of anyone’s forms — each page says what the form is for, which revision we last verified and on what date, and links you to the agency that publishes it. Sites that charge a monthly subscription for form templates are selling you the document; we are telling you which one you need and handing you the tools.` },
  { q: 'What is Business, and do I need it?', a: 'Business is Pro plus the volume and exports an accountant actually needs: 300 bank-statement pages a month instead of 20, exports to Tally, QuickBooks (QBO) and OFX, saved per-client presets, more AI actions, and invoiced billing on request. If converting other people’s statements is part of your job, it is cheaper than buying Pro and the statement converter separately. If it isn’t, Pro is the one you want.' },
  { q: 'Does the founding offer apply to Business?', a: 'No — the first 1,000 founding members lock in Pro at its founding price for life, and that offer covers Pro only. Business is priced the same for everyone.' },
  { q: 'I’m on Pro. How do I move to Business?', a: 'Email us and we will move you across and credit what you have already paid for the current period — you are never charged twice for the same month. One-click upgrades are coming; until then we would rather do it by hand than sell you a second subscription.' },
  { q: 'Can I cancel anytime?', a: 'Yes — cancel in one click; you keep Pro until the end of your paid period. New subscribers are also covered by our 14-day money-back guarantee.' },
  { q: 'Do you store my files?', a: 'No — by default nothing is saved on our servers. Our everyday tools process your files right in your browser. A few tools do use our servers — Office conversions and OCR (processed, then deleted), and later AI (sent for that one request) — but nothing is stored. The only feature that stores files is the optional File Vault, and it’s encrypted on your device before upload, so even we can’t read it. The 1 GB / unlimited figures apply only to that opt-in Vault.' },
  { q: 'Are my files safe?', a: 'Our everyday tools never upload your files — everything happens on your device. The few tools that need a server (Office conversions, OCR, and later AI) are minimal and we’re upfront about them, and the optional File Vault is end-to-end encrypted so even we can’t read it. See our Security page for details.' },
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
  const currency = useCurrency();
  const sym = currencySymbol(currency);
  const pp = PRO_PRICE[currency];
  const proPerMonth = fmtAmount(annual ? pp.annualPerMonth : pp.monthly, currency);
  const proSub = annual ? `${sym}${fmtAmount(pp.annual, currency)} billed yearly` : 'billed monthly';
  const bp = BUSINESS_PRICE[currency];
  const bizPerMonth = fmtAmount(annual ? bp.annualPerMonth : bp.monthly, currency);
  const bizSub = annual ? `${sym}${fmtAmount(bp.annual, currency)} billed yearly` : 'billed monthly';
  const founding = currency === 'INR' ? '₹417/mo' : '$4.99/mo';
  // The owner sees the COMPLETE, unrestricted pricing — the real checkout, not the
  // launch waitlist — so they can review and test the full paid flow anytime.
  const isOwner = useIsOwner();
  const showWaitlist = WAITLIST_MODE && !isOwner;

  // Currency-aware comparison table (only the "Price per year" free/pro cells change).
  const groups = useMemo(() => baseGroups.map((g) => ({
    ...g,
    rows: g.rows.map((r) => (r.label === 'Price per year'
      ? { ...r, free: `${sym}0`, pro: `~${sym}${fmtAmount(pp.annual, currency)}`, business: `~${sym}${fmtAmount(bp.annual, currency)}` }
      : r)),
  })), [currency, sym, pp.annual, bp.annual]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-6">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
            <ShieldCheck className="size-3.5" /> Private by design — in-browser tools never upload your files
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            Everything most people need is free, forever. Pro adds the power features. Business is for the people whose
            clients&rsquo; paperwork is the job — one subscription instead of two.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
          <button onClick={() => setAnnual((v) => !v)} className="relative h-7 w-12 rounded-full bg-muted transition-colors" aria-label="Toggle annual billing">
            <span className={`absolute top-1 size-5 rounded-full bg-primary transition-all ${annual ? 'left-6' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annual <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">save ~16%</span>
          </span>
        </div>

        {/* Plan cards */}
        {/* Three tiers. `lg` rather than `md` for the three-across break: at the
            md width three 7-unit-padded cards squeeze the price and the feature
            lines wrap to three each. Two-then-one below that reads better than
            three cramped columns. */}
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border bg-card p-7 shadow-soft">
            <h2 className="text-lg font-bold">Free</h2>
            <p className="mt-1 text-sm text-muted-foreground">{PRICING.audience.free}</p>
            <p className="mt-5"><span className="text-4xl font-bold">{sym}0</span><span className="text-muted-foreground"> /forever</span></p>
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
            <p className="mt-1 text-sm text-muted-foreground">{PRICING.audience.pro}</p>
            <p className="mt-5"><span className="text-4xl font-bold">{sym}{proPerMonth}</span><span className="text-muted-foreground"> /month</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{proSub}</p>
            {showWaitlist ? (
              <ProWaitlist className="mt-6" />
            ) : (
              <>
                <ProCheckout className="mt-6" interval={annual ? 'year' : 'month'} />
                {/* "Pro at" and the second sentence are not decoration. A
                    lifetime discount on the tier that carries the margin is the
                    one pricing mistake that cannot be undone, so the limit has
                    to be on the page BEFORE anyone can buy — not added after
                    somebody has already read it as covering everything. */}
                <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
                  Founding offer — first 1,000 members lock in Pro at {founding} for life.{' '}
                  <span className="font-normal opacity-80">Business is not included.</span>
                </p>
              </>
            )}
            <ul className="mt-6 space-y-2.5 text-sm">
              {PRICING.proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 size-[18px] shrink-0 text-emerald-600" strokeWidth={2.75} /> {f}</li>
              ))}
            </ul>
          </div>

          {/* Business. Not styled as the "popular" card: that badge belongs on
              the tier most people should buy, and most people are not
              accountants. This one earns attention from the sum-of-parts line
              under the price, which is a fact rather than a flourish. */}
          <div className="flex flex-col rounded-2xl border bg-card p-7 shadow-soft">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Business</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Includes Pro</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{PRICING.audience.business}</p>
            <p className="mt-5"><span className="text-4xl font-bold">{sym}{bizPerMonth}</span><span className="text-muted-foreground"> /month</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{bizSub}</p>
            {showWaitlist ? (
              // One form on the page, not two. A second email field twelve
              // inches below the first reads as a different list and splits the
              // signups we are collecting precisely to find out who wants what.
              <Button asChild variant="outline" className="mt-6">
                <Link href="#pro-waitlist"><Bell className="size-4" /> Notify me at launch</Link>
              </Button>
            ) : (
              <>
                <ProCheckout className="mt-6" interval={annual ? 'year' : 'month'} sells="business" variant="outline" />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Less than Pro and the statement converter bought separately
                  {' '}({sym}{fmtAmount(pp.monthly + STATEMENT_PRICE[currency].proMonthly, currency)}/mo).
                </p>
              </>
            )}
            <ul className="mt-6 space-y-2.5 text-sm">
              {PRICING.businessFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 size-[18px] shrink-0 text-emerald-600" strokeWidth={2.75} /> {f}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          New subscribers protected by our <Link href="/refund-policy" className="font-medium text-primary hover:underline">14-day money-back guarantee</Link>, monthly or annual.
        </p>

        {/* The credit pack, as a footnote.
            It used to be a third price card under its own heading, and that is
            precisely how we ended up selling two subscriptions that do not add
            up to a plan: a capability got its own price list instead of a row
            in the tier it belongs to. The allowances now live in the table
            above. What survives here is the one thing the table cannot say —
            that somebody who refuses a subscription entirely can still buy
            pages once. It stays because it is the only thing we sell to that
            person, and it anchors the {sym}{fmtAmount(bp.monthly, currency)}. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl border border-dashed px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="flex size-5 items-center justify-center rounded text-emerald-600 dark:text-emerald-400"><Landmark className="size-3.5" /></span>
          <span>
            <b className="font-semibold text-foreground">Rather not subscribe?</b> Bank statement pages also come as a
            one-time pack — {price(STATEMENT_PRICE[currency].pack, currency)} for {STATEMENT_PRICE[currency].packPages} pages,
            never expires. Free includes {STATEMENT_PAGES.free} pages a month with no signup.
          </span>
        </div>

        {/* Comparison table */}
        <h2 className="mt-16 text-center text-2xl font-bold tracking-tight">How we compare</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">See exactly what you get with DiemDesk versus typical competitor free plans.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="pb-3 text-left text-sm font-semibold"> </th>
                <th className="w-40 pb-3 text-center align-bottom text-sm font-semibold text-muted-foreground">
                  Competitors
                  <span className="block text-[11px] font-normal text-muted-foreground">typical free plan</span>
                </th>
                <th className="w-28 pb-3 text-center align-bottom text-sm font-semibold">DiemDesk<span className="block text-[11px] font-normal text-muted-foreground">Free</span></th>
                <th className="w-36 rounded-t-xl bg-primary/5 px-2 pb-3 pt-3 text-center align-bottom text-sm font-bold text-primary">DiemDesk<span className="block text-[11px] font-semibold">Pro</span></th>
                <th className="w-36 rounded-t-xl bg-emerald-500/[0.07] px-2 pb-3 pt-3 text-center align-bottom text-sm font-bold text-emerald-700 dark:text-emerald-400">DiemDesk<span className="block text-[11px] font-semibold">Business</span></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.title}>
                  <tr>
                    <td colSpan={5} className="bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.title}</td>
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
                      <td className="border-b border-border/60 bg-emerald-500/[0.07] px-3 py-3 text-center"><CellView value={businessCell(r)} tone="pro" /></td>
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
                <td className="rounded-b-xl bg-emerald-500/[0.07] px-3 pb-5 pt-5 text-center"><ProCheckout size="sm" interval={annual ? 'year' : 'month'} sells="business" variant="outline" /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* The "Competitors" column here is a composite — the typical shape of a
            major PDF tool's free tier, not any one product. Somebody reading it
            wants to know WHICH products and on what date we read their pages,
            and until now this was the only page with a comparison table and no
            way through to the sourced one. */}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Competitor details reflect typical free tiers of major PDF tools and may change.{' '}
          <Link href="/compare" className="font-medium text-primary hover:underline">
            See the named, sourced comparison →
          </Link>
        </p>

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
