import Link from 'next/link';
import { ShieldCheck, CloudOff, Sparkles, MessageSquare, Crown, Check, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { liveToolCount } from '@/components/app/catalog';
import { PRICING } from '@/lib/pricing';

const freeNow = [
  'Every tool — PDF, image, video, QR & utilities',
  'Unlimited use — no daily task limits (competitors cap you)',
  'Single-file Office conversions — PDF ↔ Word, Excel, PowerPoint',
  'Video compress & Video → GIF — private, right in your browser',
  'Full-strength compression & editing — nothing crippled',
  'No signup, no watermarks, no ads — files never leave your device',
];

const proLater = [
  'OCR — turn scanned PDFs into editable, searchable text',
  'Batch processing — many files in one go',
  'Unlimited file size',
  'Saved one-click workflows',
  'Priority speed & support',
  'More AI actions + encrypted File Vault (a little later)',
];

export default function FreePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> Launch period
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Free for everyone, worldwide — right now.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            DiemDesk is in its launch period, which means <strong className="text-foreground">every tool is completely free</strong> — no
            signup, no limits, anywhere in the world. Pro features for power users arrive in a few months.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/#tools">Start using the tools</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/feedback">Share feedback</Link></Button>
          </div>
        </div>

        {/* What's free now */}
        <section className="mt-14 rounded-2xl border bg-card p-7 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CloudOff className="size-5 text-emerald-600" /> What you get free, today</h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-1">
            {freeNow.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm"><Check className="mt-0.5 size-[18px] shrink-0 text-emerald-600" strokeWidth={2.75} /> {f}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            All {liveToolCount}+ tools, free during launch — genuinely useful, not a trial.
          </p>
        </section>

        {/* Why free */}
        <section className="mt-6 rounded-2xl border bg-card p-7 shadow-soft">
          <h2 className="text-lg font-bold">Why we&rsquo;re giving it away</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We&rsquo;re building the most private, genuinely useful everyday toolkit on the web — and we want to build it
            <em> with </em> you. During launch, everything is free so we can hear what you love, what&rsquo;s missing, and what
            you&rsquo;d happily pay for. Your feedback shapes what we build next. Because the core tools run right in your
            browser, giving them away costs us nothing — so they&rsquo;ll always stay free.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <Link href="/feedback" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
              <MessageSquare className="size-4" /> Tell us what you think →
            </Link>
          </p>
        </section>

        {/* What's coming */}
        <section className="mt-6 rounded-2xl border-2 border-primary/40 bg-card p-7 shadow-lift">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Crown className="size-5 text-amber-500" /> Coming soon: DiemDesk Pro</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            In a few months we&rsquo;ll add <strong className="text-foreground">Pro</strong> — power features for heavy and business
            users. Everything you use free today stays free; Pro simply adds more muscle:
          </p>
          <ul className="mt-4 grid gap-2.5">
            {proLater.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm"><Crown className="mt-0.5 size-4 shrink-0 text-amber-500" /> {f}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            Planned at <strong className="text-foreground">${PRICING.pro.monthly}/month</strong> (or {PRICING.pro.annualNote}) when it launches — but not yet. There&rsquo;s nothing to buy today.
          </p>

          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <Award className="size-4" /> Founding member offer
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Go Pro in the launch window and <strong className="text-foreground">lock in $4.99/month for life</strong> —
              even as we add features and the price rises later. Our thank-you for being here early.
            </p>
          </div>
        </section>

        {/* Help shape Pro — feedback ask */}
        <section className="mt-6 rounded-2xl border bg-primary/5 p-7 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary"><MessageSquare className="size-6" /></span>
          <h2 className="mt-4 text-lg font-bold">Help shape Pro</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            You decide what Pro becomes. Tell us <strong className="text-foreground">which tools you love</strong> and
            <strong className="text-foreground"> which features you&rsquo;d pay for</strong> — OCR, batch, bigger files,
            AI, something we haven&rsquo;t thought of? Your feedback directly sets our roadmap.
          </p>
          <Button asChild className="mt-5"><Link href="/feedback">Share what you want →</Link></Button>
        </section>

        {/* Privacy reminder */}
        <section className="mt-6 rounded-2xl border bg-gradient-to-br from-emerald-50 to-background p-7 text-center dark:from-emerald-950/20">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-500 text-white"><ShieldCheck className="size-6" strokeWidth={2.25} /></span>
          <h2 className="mt-4 text-lg font-bold">Private by design — free or Pro</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Your everyday tools run in your browser and never upload your files. That promise never changes.
            <Link href="/security" className="ml-1 font-medium text-primary hover:underline">How it works →</Link>
          </p>
        </section>

        <div className="mt-10 text-center">
          <Button asChild size="lg"><Link href="/#tools">Browse all tools — free</Link></Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
