'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, Smartphone, Check, BadgeCheck, Infinity as InfinityIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LaunchBanner } from '@/components/app/launch-banner';
import { BILLING_ENABLED } from '@/lib/flags';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { HeroHybrid } from '@/components/home/hero-variants';
import { AllToolsDirectory } from '@/components/home/all-tools-directory';
import { JumpBackIn } from '@/components/home/jump-back-in';
import { ProofStrip } from '@/components/home/proof-strip';
import { liveToolCount } from '@/components/app/catalog';
import { FeatureSpotlights } from '@/components/home/feature-spotlights';
import { PRICING } from '@/lib/pricing';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] as const } }),
};

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} variants={fadeUp} custom={delay} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
      {children}
    </motion.div>
  );
}

const why = [
  { icon: ShieldCheck, color: '#059669', title: 'Files never leave your browser', body: 'Core tools run 100% on your device — nothing is uploaded to any server.' },
  { icon: BadgeCheck, color: '#4f46e5', title: 'Free, no signup', body: 'Use the core tools free — no account, no watermark, no catch.' },
  { icon: Smartphone, color: '#0891b2', title: 'Every device', body: 'A premium experience on desktop and mobile. Native apps on the way.' },
  { icon: InfinityIcon, color: '#d97706', title: 'No daily limits', body: 'Use every tool as often as you like — no 2-tasks-a-day caps like other sites.' },
];

const stats: { v: string; l: string; note?: string }[] = [
  { v: `${liveToolCount}`, l: 'Tools and growing' },
  { v: '0', l: 'Ads or trackers' },
  { v: '0', l: 'Files uploaded', note: 'for in-browser tools' },
  { v: '$0', l: 'To get started' },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>

      <LaunchBanner />

      <SiteHeader />

      <HeroHybrid />

      {/* Returning visitors: their recent tools, one tap away (local-only) */}
      <JumpBackIn />

      {/* All tools — the single canonical tools section */}
      <AllToolsDirectory />

      {/* Verifiable proof — the documented compress test (our kind of social proof) */}
      <ProofStrip />

      {/* Feature spotlights */}
      <FeatureSpotlights />

      {/* Why DiemDesk */}
      <section className="border-y bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why DiemDesk</h2>
            <p className="mt-2 text-muted-foreground">Built private, fast, and free — without the catch.</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {why.map((w, i) => (
              <Reveal key={w.title} delay={i % 2}>
                <div className="flex h-full items-start gap-3.5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${w.color}1a`, color: w.color }}><w.icon className="size-5" /></span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold">{w.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-y-6 rounded-2xl border bg-card p-8 shadow-soft sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="border-border px-4 text-center sm:border-l sm:first:border-l-0">
              <p className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{s.v}</p>
              <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.l}</p>
              {s.note && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{s.note}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <Reveal className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you need more.</p>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft">
            <p className="text-sm font-medium text-muted-foreground">Free</p>
            <p className="mt-2 text-4xl font-bold">$0<span className="text-base font-normal text-muted-foreground">/forever</span></p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {PRICING.freeFeatures.slice(0, 6).map((t) => <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t}</li>)}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full"><Link href="/register">Get started free</Link></Button>
          </div>
          <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-card p-6 shadow-lift">
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">Most popular</span>
            <p className="text-sm font-medium text-primary">Pro</p>
            <p className="mt-2 text-4xl font-bold">${PRICING.pro.annualPerMonth}<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{PRICING.pro.annualNote}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {PRICING.proFeatures.slice(0, 6).map((t) => <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t}</li>)}
            </ul>
            {BILLING_ENABLED ? (
              <Button asChild className="mt-6 w-full"><Link href="/register">Go Pro</Link></Button>
            ) : (
              <Button className="mt-6 w-full" variant="secondary" disabled><Clock className="size-4" /> Pro — coming soon</Button>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-sm"><Link href="/pricing" className="font-medium text-primary hover:underline">See full pricing &amp; feature comparison →</Link></p>
      </section>

      {/* Closing CTA */}
      <section className="border-t bg-gradient-to-b from-muted/20 to-background">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready when you are.</h2>
          <p className="mx-auto mt-2.5 max-w-lg text-muted-foreground">
            Start with {liveToolCount}+ private tools — free, no signup, and nothing ever leaves your device.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/register">Start free — no signup</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/#tools">Browse all tools</Link></Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
