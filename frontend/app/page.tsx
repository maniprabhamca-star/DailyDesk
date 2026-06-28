'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutGrid, ChevronDown, Search, ArrowRight, Zap, ShieldCheck, Smartphone, Check, FileText, QrCode, ImageIcon, Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toolGroups, allTools, type Tool } from '@/components/app/tools-config';

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
    <div className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${t.color}1A`, color: t.color }}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {t.name}
          {!t.available && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Soon</span>}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
      </div>
      {t.available && <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
    </div>
  );
  return t.available ? <Link href={t.href} className="h-full">{inner}</Link> : <div className="h-full cursor-not-allowed">{inner}</div>;
}

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
                <div className="absolute left-0 top-8 z-40 grid w-[560px] grid-cols-2 gap-x-6 gap-y-1 rounded-xl border bg-popover p-4 shadow-lift">
                  {toolGroups.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{g.label}</p>
                      {g.tools.map((t) => {
                        const Icon = t.icon;
                        const row = (
                          <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-accent">
                            <span className="flex size-7 items-center justify-center rounded-md" style={{ backgroundColor: `${t.color}1A`, color: t.color }}><Icon className="size-4" /></span>
                            <span className="text-sm">{t.name}</span>
                            {!t.available && <span className="ml-auto text-[10px] text-muted-foreground">soon</span>}
                          </div>
                        );
                        return t.available ? <Link key={t.id} href={t.href} onClick={() => setMenuOpen(false)}>{row}</Link> : <div key={t.id} className="cursor-not-allowed opacity-60">{row}</div>;
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <Link href="/#pricing" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Pricing</Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Log in</Link></Button>
            <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
          </div>
        </div>
      </header>

      {/* Bento hero */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="grid auto-rows-[120px] grid-cols-2 gap-3 md:grid-cols-4">
          {/* Hero tile */}
          <div className="relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-6 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
            <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-medium">10 tools · one workspace</span>
            <div className="relative">
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Everything you need, in one place.</h1>
              <p className="mt-1.5 text-sm text-indigo-100">Fast, private, beautifully simple.</p>
              <button onClick={openCommand} className="mt-4 flex w-full max-w-xs items-center gap-2 rounded-lg bg-white/95 px-3 py-2.5 text-left text-sm text-slate-500 shadow-sm transition hover:bg-white">
                <Search className="size-4" /> Search tools…
                <kbd className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
              </button>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" className="bg-white text-primary hover:bg-white/90"><Link href="/register">Get started</Link></Button>
                <Button asChild size="sm" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10"><Link href="#tools">Explore</Link></Button>
              </div>
            </div>
          </div>

          {/* PDF tile — stacked pages */}
          <div className="flex flex-col rounded-2xl border border-red-200/60 bg-gradient-to-br from-red-50 to-background p-3 dark:border-red-900/40">
            <div className="relative flex-1">
              <div className="absolute left-[18px] top-2 bottom-1 right-1 rotate-[7deg] rounded-md border border-red-200/70 bg-card" />
              <div className="absolute left-1.5 top-1 bottom-1.5 right-3.5 rounded-md border border-red-200/70 bg-card p-2 shadow-soft">
                <div className="mb-1 h-1 w-[55%] rounded bg-red-300" />
                <div className="mb-0.5 h-[3px] w-[90%] rounded bg-red-100" /><div className="mb-0.5 h-[3px] w-[75%] rounded bg-red-100" /><div className="h-[3px] w-[85%] rounded bg-red-100" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-md bg-red-100 text-red-600"><FileText className="size-3" /></span><span className="text-xs font-semibold text-red-900 dark:text-red-300">PDF · 30+ tools</span></div>
          </div>

          {/* QR tile — real code */}
          <Link href="/tools/qr-code" className="flex flex-col rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-background p-3 transition hover:-translate-y-0.5 dark:border-indigo-900/40">
            <div className="flex flex-1 items-center justify-center">
              <div className="rounded-lg border bg-white p-1.5 shadow-soft">
                <svg width="48" height="48" viewBox="0 0 29 29" shapeRendering="crispEdges" role="img" aria-label="QR">
                  <rect width="29" height="29" fill="#fff" />
                  <g fill="#4f46e5"><path d="M0 0h7v7h-7z M1 1h5v5h-5z" fillRule="evenodd" /><rect x="2" y="2" width="3" height="3" /><path d="M22 0h7v7h-7z M23 1h5v5h-5z" fillRule="evenodd" /><rect x="24" y="2" width="3" height="3" /><path d="M0 22h7v7h-7z M1 23h5v5h-5z" fillRule="evenodd" /><rect x="2" y="24" width="3" height="3" /><rect x="10" y="2" width="2" height="2" /><rect x="14" y="1" width="1" height="3" /><rect x="9" y="9" width="2" height="2" /><rect x="13" y="11" width="3" height="1" /><rect x="17" y="9" width="1" height="3" /><rect x="9" y="18" width="3" height="1" /><rect x="22" y="9" width="2" height="2" /><rect x="11" y="23" width="2" height="1" /><rect x="23" y="23" width="3" height="1" /></g>
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-600"><QrCode className="size-3" /></span><span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">QR generator</span></div>
          </Link>

          {/* Image tile — before/after */}
          <div className="flex flex-col rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50 to-background p-3 dark:border-sky-900/40">
            <div className="flex flex-1 flex-col gap-1 rounded-lg border bg-card p-1.5 shadow-soft">
              <div className="flex-1 rounded bg-gradient-to-br from-blue-400 to-violet-400" />
              <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground line-through">4.8MB</span><span className="text-[10px] font-semibold text-emerald-600">820KB</span></div>
            </div>
            <div className="mt-2 flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-md bg-sky-100 text-sky-600"><ImageIcon className="size-3" /></span><span className="text-xs font-semibold text-sky-900 dark:text-sky-300">Image · −83%</span></div>
          </div>

          {/* Password tile */}
          <Link href="/tools/password" className="flex flex-col rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-background p-3 transition hover:-translate-y-0.5 dark:border-emerald-900/40">
            <div className="flex flex-1 flex-col justify-center gap-2 rounded-lg border bg-card p-2 shadow-soft">
              <span className="font-mono text-xs tracking-wide text-foreground">sCk^L&lt;8+e</span>
              <div className="h-1.5 rounded-full bg-emerald-100"><div className="h-1.5 w-[88%] rounded-full bg-emerald-500" /></div>
            </div>
            <div className="mt-2 flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-600"><Key className="size-3" /></span><span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">Passwords</span></div>
          </Link>
        </div>
      </section>

      {/* Browse all tools */}
      <section id="tools" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => <ToolCard key={t.id} t={t} />)}
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/30 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {[
            { icon: Zap, title: 'Blazing fast', body: 'Most tools run entirely in your browser — no uploads, no waiting.' },
            { icon: ShieldCheck, title: 'Private by design', body: 'Your files stay on your device for client-side tools.' },
            { icon: Smartphone, title: 'Works everywhere', body: 'A premium experience on desktop and mobile, native apps on the way.' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-6 shadow-soft">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="size-5" /></span>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
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

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><LayoutGrid className="size-3.5" /></span> DailyDesk</div>
          <p className="text-xs">© {new Date().getFullYear()} DailyDesk. Private preview.</p>
        </div>
      </footer>
    </div>
  );
}
