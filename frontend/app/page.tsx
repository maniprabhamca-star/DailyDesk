'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LayoutGrid, Search, ShieldCheck, Smartphone, Check, BadgeCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/app/site-header';
import { AllToolsDirectory } from '@/components/home/all-tools-directory';
import { liveToolCount } from '@/components/app/catalog';
import { FeatureSpotlights } from '@/components/home/feature-spotlights';
import { HeroShowcase, HeroPrivacy } from '@/components/home/hero-tiles';
import { PRICING } from '@/lib/pricing';

function openCommand() {
  window.dispatchEvent(new Event('dd-command-open'));
}

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
  const heroSearchRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>

      <SiteHeader heroSearchRef={heroSearchRef} />

      {/* Bento hero */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="relative col-span-2 flex min-h-[300px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-6 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
            <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-medium">{liveToolCount} tools · one workspace</span>
            <div className="relative">
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Everything you need, in one place.</h1>
              <p className="mt-1.5 text-sm text-indigo-100">Fast, private, beautifully simple.</p>
              <button ref={heroSearchRef} onClick={openCommand} className="mt-4 flex w-full items-center gap-2.5 rounded-xl bg-white/95 px-4 py-3.5 text-left text-[15px] text-slate-500 shadow-sm transition hover:bg-white">
                <Search className="size-[18px]" /> Search tools…
                <kbd className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[11px]">⌘K</kbd>
              </button>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" className="bg-white text-primary hover:bg-white/90"><Link href="/register">Get started</Link></Button>
                <Button asChild size="sm" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10"><Link href="#tools">Explore</Link></Button>
              </div>
            </div>
          </div>

          <HeroShowcase className="col-span-1" />
          <HeroPrivacy className="col-span-1" />
        </div>
      </section>

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

      {/* Footer */}
      <footer className="border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><LayoutGrid className="size-4" /></span><span className="font-semibold">DailyDesk</span></div>
              <p className="mt-3 text-sm text-muted-foreground">The private, all-in-one toolkit. Your files never leave your device.</p>
              <p className="mt-4 text-xs text-muted-foreground">iOS & Android apps — coming soon</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Tools</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/merge-pdf" className="hover:text-foreground">Merge PDF</Link></li>
                <li><Link href="/tools/qr-code" className="hover:text-foreground">QR generator</Link></li>
                <li><Link href="/tools/password" className="hover:text-foreground">Password generator</Link></li>
                <li><Link href="#tools" className="hover:text-foreground">All tools</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/register" className="hover:text-foreground">Get started</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Log in</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Legal</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
                <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
                <li><Link href="/refund-policy" className="hover:text-foreground">Refunds</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} DailyDesk. Private preview.</p>
            <p className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-600" /> Files never leave your browser</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
