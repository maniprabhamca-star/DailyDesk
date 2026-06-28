'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  Smartphone,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { allTools } from '@/components/app/tools-config';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient background accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 size-[420px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="size-[18px]" />
            </span>
            <span className="text-lg font-semibold tracking-tight">DailyDesk</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
            <Sparkles className="size-3.5" /> 10 premium tools, one workspace
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={1}
          className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Everything you need to{' '}
          <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
            get things done
          </span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={2}
          className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
        >
          PDF tools, QR codes, image editing, notes, habits, and more — fast, private, and beautifully
          simple. Most tools run right in your browser.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={3}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg">
            <Link href="/tools/qr-code">
              Try the QR generator <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#tools">Explore all tools</Link>
          </Button>
        </motion.div>
      </section>

      {/* Tools grid */}
      <section id="tools" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Reveal className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">One app, every tool</h2>
          <p className="mt-2 text-muted-foreground">Built to replace a dozen subscriptions.</p>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {allTools.map((tool, i) => {
            const Icon = tool.icon;
            const inner = (
              <motion.div
                variants={fadeUp}
                custom={i % 5}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ y: -4 }}
                className={`group relative flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift ${
                  tool.available ? '' : 'opacity-70'
                }`}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{tool.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tool.available ? 'Open now' : 'Coming soon'}
                  </p>
                </div>
                {tool.available && (
                  <ArrowRight className="absolute right-4 top-4 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </motion.div>
            );
            return tool.available ? (
              <Link key={tool.id} href={tool.href} className="h-full">
                {inner}
              </Link>
            ) : (
              <div key={tool.id} className="h-full cursor-not-allowed">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Zap, title: 'Blazing fast', body: 'Most tools run entirely in your browser — no uploads, no waiting.' },
              { icon: ShieldCheck, title: 'Private by design', body: 'Your files stay on your device for client-side tools. Encryption for the rest.' },
              { icon: Smartphone, title: 'Works everywhere', body: 'A premium experience on desktop and mobile, with native apps on the way.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-6 shadow-soft">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <Reveal className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Simple pricing</h2>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you need more.</p>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border bg-card p-6 shadow-soft">
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="mt-2 text-4xl font-bold">$0</p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {['All basic tools', '1 GB storage', 'Up to 10 notes', 'No credit card'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link href="/tools/qr-code">Get started</Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={1}>
            <div className="relative flex h-full flex-col rounded-2xl border-2 border-primary bg-card p-6 shadow-lift">
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Most popular
              </span>
              <p className="text-sm font-medium text-primary">Pro</p>
              <p className="mt-2 text-4xl font-bold">
                $4.99<span className="text-base font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {['Unlimited storage', 'All AI features', 'Unlimited PDF ops', 'Receipt scanner', 'Priority support'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full">Upgrade to Pro</Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutGrid className="size-3.5" />
            </span>
            DailyDesk — all-in-one productivity
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} DailyDesk. Private preview.</p>
        </div>
      </footer>
    </div>
  );
}
