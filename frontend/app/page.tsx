'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LayoutGrid, ShieldCheck, Smartphone, Check, BadgeCheck, Lock, Apple, Play, MapPin, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/app/site-header';
import { HeroHybrid } from '@/components/home/hero-variants';
import { AllToolsDirectory } from '@/components/home/all-tools-directory';
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
  { icon: ShieldCheck, title: 'Files never leave your browser', body: 'Core tools run 100% on your device — nothing is uploaded to any server.' },
  { icon: BadgeCheck, title: 'Free, no signup', body: 'Use the core tools free — no account, no watermark, no catch.' },
  { icon: Smartphone, title: 'Every device', body: 'A premium experience on desktop and mobile. Native apps on the way.' },
  { icon: Lock, title: 'Encrypted when saved', body: 'Optional saved files use AES-256 encryption — only you hold the key.' },
];

const stats = [
  { v: `${liveToolCount}`, l: 'Tools and growing' },
  { v: '0', l: 'Files uploaded' },
  { v: '100%', l: 'In your browser' },
  { v: '$0', l: 'To get started' },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>

      <SiteHeader />

      <HeroHybrid />

      {/* All tools — the single canonical tools section */}
      <AllToolsDirectory />

      {/* Feature spotlights */}
      <FeatureSpotlights />

      {/* Why DailyDesk */}
      <section className="border-y bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why DailyDesk</h2>
            <p className="mt-2 text-muted-foreground">Built private, fast, and free — without the catch.</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {why.map((w, i) => (
              <Reveal key={w.title} delay={i % 2}>
                <div className="flex h-full items-start gap-3.5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><w.icon className="size-5" /></span>
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
            <Button asChild className="mt-6 w-full"><Link href="/register">Go Pro</Link></Button>
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

      {/* Footer — dark anchor (soft slate, not full black) */}
      <footer className="relative overflow-hidden border-t border-white/10 bg-[#0f172a] text-slate-300">
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-5 pt-9 sm:px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><LayoutGrid className="size-[18px]" /></span>
                <span className="text-lg font-semibold tracking-tight text-white">DailyDesk</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                Every daily tool — private, fast, and free. Your files never leave your device.
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <ShieldCheck className="size-3.5" /> 100% in your browser
              </span>
              {/* App badges — custom "coming soon" (honest; swap for real store badges at launch) */}
              <div className="mt-4 flex flex-wrap gap-2.5">
                {[
                  { Icon: Apple, name: 'App Store' },
                  { Icon: Play, name: 'Google Play' },
                ].map((b) => (
                  <span key={b.name} className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 transition-colors hover:bg-white/10">
                    <b.Icon className="size-6 text-white" />
                    <span className="leading-tight">
                      <span className="block text-[9px] uppercase tracking-wide text-slate-400">Coming soon</span>
                      <span className="block text-[13px] font-semibold text-white">{b.name}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
            {[
              { title: 'Tools', color: '#a78bfa', links: [
                { label: 'Compress PDF', href: '/compress-pdf' },
                { label: 'Merge PDF', href: '/merge-pdf' },
                { label: 'QR generator', href: '/tools/qr-code' },
                { label: 'All tools', href: '/#tools' },
              ] },
              { title: 'Product', color: '#2dd4bf', links: [
                { label: 'Pricing', href: '/pricing' },
                { label: 'Get started', href: '/register' },
                { label: 'Log in', href: '/login' },
              ] },
              { title: 'Legal', color: '#fbbf24', links: [
                { label: 'Privacy', href: '/privacy' },
                { label: 'Security', href: '/security' },
                { label: 'Terms', href: '/terms' },
                { label: 'Refunds', href: '/refund-policy' },
              ] },
            ].map((col) => (
              <div key={col.title}>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: col.color }} /> {col.title}
                </p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}><Link href={l.href} className="font-medium text-slate-400 transition-colors hover:text-white">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Trust pills */}
          <div className="mt-7 flex flex-wrap gap-2">
            {[
              { icon: MapPin, label: 'Made in the USA' },
              { icon: Lock, label: 'AES-256 encryption' },
              { icon: EyeOff, label: 'No tracking' },
            ].map((t) => (
              <span key={t.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                <t.icon className="size-3.5" /> {t.label}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} DailyDesk · Private preview</p>
            <p className="flex items-center gap-2 text-emerald-300">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
              In-browser tools never upload your files — verify in the Network tab
            </p>
          </div>
        </div>
        {/* Background wordmark — faint, right-aligned, sits above the bottom bar */}
        <div aria-hidden className="pointer-events-none absolute bottom-20 right-2 z-0 select-none whitespace-nowrap text-[52px] font-bold leading-none tracking-tighter text-white/[0.04] sm:text-[80px] lg:text-[104px]">
          DailyDesk
        </div>
      </footer>
    </div>
  );
}
