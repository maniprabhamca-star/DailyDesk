'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutGrid, ChevronDown, Search, ArrowRight, Zap, ShieldCheck, Smartphone, Check,
  FileText, QrCode, ImageIcon, NotebookPen, BadgeCheck, Lock, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toolGroups, allTools, type Tool } from '@/components/app/tools-config';
import { AllToolsDirectory } from '@/components/home/all-tools-directory';
import { catalog } from '@/components/app/catalog';
import { FeatureSpotlights } from '@/components/home/feature-spotlights';
import { HeroShowcase, HeroPrivacy } from '@/components/home/hero-tiles';

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

function ToolCard({ t }: { t: Tool }) {
  const Icon = t.icon;
  const inner = (
    <div className="group flex h-full flex-col rounded-2xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card">
      <div className="mb-3 flex items-start justify-between">
        <span className="flex size-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${t.color}1A`, color: t.color }}>
          <Icon className="size-6" strokeWidth={2.25} />
        </span>
        {!t.available && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Soon</span>}
        {t.available && <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className="text-[15px] font-bold tracking-tight">{t.name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
    </div>
  );
  return t.available ? <Link href={t.href} className="h-full">{inner}</Link> : <div className="h-full cursor-not-allowed">{inner}</div>;
}

const categories = [
  { name: 'PDF Tools', tagline: 'Merge, split, compress, convert & more', featured: 'Merge PDF', href: '/merge-pdf', from: '#dc2626', to: '#ef4444', icon: FileText, live: true },
  { name: 'Generators', tagline: 'QR codes & secure passwords', featured: 'QR generator', href: '/tools/qr-code', from: '#4f46e5', to: '#7c3aed', icon: QrCode, live: true },
  { name: 'Image Tools', tagline: 'Compress images & remove backgrounds', featured: 'Coming soon', href: '#tools', from: '#0284c7', to: '#0ea5e9', icon: ImageIcon, live: false },
  { name: 'Workspace', tagline: 'Notes, habits, budget, vault & bio', featured: 'Coming soon', href: '#tools', from: '#d97706', to: '#f59e0b', icon: NotebookPen, live: false },
];

const why = [
  { icon: ShieldCheck, title: 'Files never leave your browser', body: 'Core tools run 100% on your device — nothing is uploaded to any server.' },
  { icon: Zap, title: 'Instant, even offline', body: 'Processing happens locally, so it’s fast and works without a connection.' },
  { icon: BadgeCheck, title: 'Free, no signup', body: 'Use the core tools free — no account, no watermark, no catch.' },
  { icon: Smartphone, title: 'Every device', body: 'A premium experience on desktop and mobile. Native apps on the way.' },
  { icon: Lock, title: 'Encrypted when saved', body: 'Optional saved files use AES-256 encryption — only you hold the key.' },
  { icon: Layers, title: 'All-in-one', body: 'PDF, images, notes, habits and more — one private workspace.' },
];

const stats = [
  { v: '10+', l: 'Tools and growing' },
  { v: '0', l: 'Files uploaded' },
  { v: '100%', l: 'In your browser' },
  { v: '$0', l: 'To get started' },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? allTools : toolGroups.find((g) => g.label === filter)?.tools ?? [];
  const pills = ['all', ...toolGroups.map((g) => g.label)];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><LayoutGrid className="size-[18px]" /></span>
            <span className="text-lg font-semibold tracking-tight">DailyDesk</span>
          </Link>
          <div className="relative hidden sm:block">
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground">
              Tools <ChevronDown className={`size-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-8 z-40 grid w-[680px] grid-cols-3 gap-x-5 gap-y-4 rounded-xl border bg-popover p-5 shadow-lift">
                  {catalog.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                      <div className="space-y-0.5">
                        {g.tools.map((t) => {
                          const Icon = t.icon;
                          const row = (
                            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                              <Icon className="size-4 shrink-0" style={{ color: g.color }} strokeWidth={2.25} />
                              <span className="truncate text-[13px] font-medium">{t.name}</span>
                              {t.soon && <span className="ml-auto text-[10px] text-muted-foreground">soon</span>}
                            </div>
                          );
                          return t.href ? <Link key={t.name} href={t.href} onClick={() => setMenuOpen(false)}>{row}</Link> : <div key={t.name} className="cursor-default opacity-70">{row}</div>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <Link href="/pricing" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Pricing</Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Log in</Link></Button>
            <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
          </div>
        </div>
      </header>

      {/* Bento hero */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="relative col-span-2 flex min-h-[300px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-6 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
            <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-medium">10 tools · one workspace</span>
            <div className="relative">
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Everything you need, in one place.</h1>
              <p className="mt-1.5 text-sm text-indigo-100">Fast, private, beautifully simple.</p>
              <button onClick={openCommand} className="mt-4 flex w-full items-center gap-2.5 rounded-xl bg-white/95 px-4 py-3.5 text-left text-[15px] text-slate-500 shadow-sm transition hover:bg-white">
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

      {/* Category tiles */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal className="mb-5"><h2 className="text-xl font-bold tracking-tight">Pick a category</h2></Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.name} delay={i}>
                <Link href={c.href} className="group flex h-full min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl p-4 text-white shadow-card transition-transform hover:-translate-y-1 sm:min-h-[180px] sm:p-5" style={{ backgroundImage: `linear-gradient(150deg, ${c.from}, ${c.to})` }}>
                  <div className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/20 sm:size-11"><Icon className="size-5" strokeWidth={2.25} /></span>
                    {!c.live && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">Soon</span>}
                  </div>
                  <div className="mt-6 sm:mt-8">
                    <p className="text-base font-bold sm:text-lg">{c.name}</p>
                    <p className="mt-0.5 text-xs text-white/85 sm:text-sm">{c.tagline}</p>
                    <p className="mt-3 hidden items-center gap-1 text-sm font-medium sm:flex">
                      {c.live ? <>Try {c.featured} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></> : 'Coming soon'}
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Browse all tools */}
      <section id="tools" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Browse all tools</h2>
          <div className="flex gap-2">
            {pills.map((p) => (
              <button key={p} onClick={() => setFilter(p)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${filter === p ? 'bg-foreground text-background' : 'border text-muted-foreground hover:text-foreground'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {filtered.map((t) => <ToolCard key={t.id} t={t} />)}
        </div>
      </section>

      {/* Feature spotlights */}
      <FeatureSpotlights />

      {/* Why DailyDesk */}
      <section className="border-y bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why DailyDesk</h2>
            <p className="mt-2 text-muted-foreground">Built private, fast, and free — without the catch.</p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {why.map((w, i) => (
              <Reveal key={w.title} delay={i % 3}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-6 shadow-soft">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><w.icon className="size-5" /></span>
                  <h3 className="text-base font-semibold">{w.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border bg-card p-8 shadow-soft sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-3xl font-bold text-primary sm:text-4xl">{s.v}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.l}</p>
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
            <p className="mt-2 text-4xl font-bold">$0</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {['All basic tools', '1 GB storage', 'Up to 10 notes', 'No credit card'].map((t) => <li key={t} className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t}</li>)}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full"><Link href="/register">Get started</Link></Button>
          </div>
          <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-card p-6 shadow-lift">
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">Most popular</span>
            <p className="text-sm font-medium text-primary">Pro</p>
            <p className="mt-2 text-4xl font-bold">$4.99<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {['Unlimited storage', 'All AI features', 'Unlimited PDF ops', 'Receipt scanner', 'Priority support'].map((t) => <li key={t} className="flex items-center gap-2"><Check className="size-4 text-primary" /> {t}</li>)}
            </ul>
            <Button className="mt-6 w-full">Upgrade to Pro</Button>
          </div>
        </div>
      </section>

      {/* All tools directory */}
      <AllToolsDirectory />

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
