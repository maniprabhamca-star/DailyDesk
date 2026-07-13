'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, FileText, Scissors, Combine, Search, QrCode,
  Shrink, RotateCw, ListOrdered, Image as ImageIcon, KeyRound,
} from 'lucide-react';
import Image from 'next/image';
import { liveToolCount } from '@/components/app/catalog';

function Row({
  reverse, eyebrow, eyebrowColor, title, body, cta, href, children,
}: {
  reverse?: boolean; eyebrow: string; eyebrowColor: string; title: string; body: string; cta: string; href: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center gap-8 md:gap-14 ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}
    >
      <div className="w-full md:w-1/2">{children}</div>
      <div className="w-full md:w-1/2">
        <p className="text-sm font-bold uppercase tracking-wider" style={{ color: eyebrowColor }}>{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <Link href={href} className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary hover:gap-2.5 transition-all">
          {cta} <ArrowRight className="size-4" />
        </Link>
      </div>
    </motion.div>
  );
}

export function FeatureSpotlights() {
  return (
    <section className="mx-auto max-w-6xl space-y-14 px-4 pb-14 pt-8 sm:px-6 md:space-y-20">

      {/* 1 · Breadth of tools — live launcher grid */}
      <Row eyebrow="All-in-one toolkit" eyebrowColor="#7c3aed" title="One workspace. Every tool, every day." body="PDFs, QR codes, passwords and more — a whole toolkit that runs free, right in your browser. One tab, everything you reach for." cta="Browse all tools" href="/#tools">
        <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-background p-6 dark:from-violet-950/20">
          <div className="mx-auto max-w-xs">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Your toolkit</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{liveToolCount} free tools</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { icon: Shrink, cls: 'bg-teal-500/15 text-teal-600 dark:text-teal-300' },
                { icon: Combine, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-300' },
                { icon: Scissors, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
                { icon: RotateCw, cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
                { icon: ListOrdered, cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
                { icon: ImageIcon, cls: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300' },
                { icon: QrCode, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
                { icon: KeyRound, cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' },
              ].map((t, i) => {
                const Icon = t.icon;
                return (
                  <div key={i} className="flex items-center justify-center rounded-xl border bg-card p-3 shadow-soft transition-transform hover:-translate-y-0.5">
                    <span className={`flex size-8 items-center justify-center rounded-lg ${t.cls}`}><Icon className="size-4" strokeWidth={2.25} /></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Row>

      {/* PDF workspace */}
      <Row reverse eyebrow="PDF workspace" eyebrowColor="#dc2626" title="Everything for your PDFs." body="Merge, split, compress, convert, sign and more — a complete PDF workspace, private by design. Replace your $20/mo PDF subscription." cta="Open PDF tools" href="/merge-pdf">
        <div className="relative rounded-2xl border bg-gradient-to-br from-red-50 to-background p-6 dark:from-red-950/20">
          <div className="relative mx-auto h-52 max-w-xs">
            <div className="absolute left-4 top-3 h-44 w-40 rotate-[6deg] rounded-xl border bg-card" />
            <div className="absolute left-1 top-1 h-44 w-44 rounded-xl border bg-card p-4 shadow-lift">
              <div className="mb-3 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-red-100 text-red-600"><FileText className="size-4" /></span><span className="text-xs font-semibold">document.pdf</span></div>
              <div className="space-y-1.5"><div className="h-1.5 w-[90%] rounded bg-muted" /><div className="h-1.5 w-[75%] rounded bg-muted" /><div className="h-1.5 w-[85%] rounded bg-muted" /><div className="h-1.5 w-[60%] rounded bg-muted" /></div>
            </div>
            <span className="absolute -right-1 top-6 flex size-10 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lift"><span className="text-[10px] font-bold">DOC</span></span>
            <span className="absolute -right-2 top-24 flex size-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lift"><span className="text-[10px] font-bold">JPG</span></span>
            <span className="absolute bottom-2 left-2 flex size-10 items-center justify-center rounded-xl bg-violet-500 text-white shadow-lift"><Scissors className="size-5" /></span>
            <span className="absolute bottom-3 right-10 flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lift"><Combine className="size-5" /></span>
          </div>
        </div>
      </Row>

      {/* 3 · Command palette */}
      <Row eyebrow="Keyboard-first" eyebrowColor="#4f46e5" title="Find any tool in a keystroke." body="Press ⌘K anywhere to search and launch any tool instantly. One workspace, zero hunting through menus." cta="Explore all tools" href="/#tools">
        <div className="relative rounded-2xl border bg-gradient-to-br from-indigo-50 to-background p-6 dark:from-indigo-950/20">
          <div className="mx-auto max-w-sm overflow-hidden rounded-xl border bg-card shadow-lift">
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <span className="text-sm">compress</span>
              <span className="ml-auto rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
            </div>
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-red-100 text-red-600"><FileText className="size-4" /></span>
                <div className="flex-1"><p className="text-sm font-semibold">Compress a PDF</p><p className="text-[11px] text-muted-foreground">PDF workspace</p></div>
                <span className="text-[11px] font-medium text-primary">↵</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><QrCode className="size-4" /></span>
                <div className="flex-1"><p className="text-sm font-semibold">Generate a QR code</p><p className="text-[11px] text-muted-foreground">QR generator</p></div>
              </div>
            </div>
          </div>
        </div>
      </Row>

      {/* Flagship finale — the DiemDesk Editor: a premium, single-accent product showcase (deliberately larger + centered, not a zigzag row). */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-[1.75rem] border bg-muted/30 px-5 py-12 sm:px-10 sm:py-16"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">The DiemDesk Editor</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.05]">Your PDF, your canvas.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-lg">Annotate, sign, redact and edit with the precision of a design tool and the ease of a doc — ⌘K commands, snap-to guides, a live properties inspector and reusable signatures. Nothing uploaded, ever.</p>
        </div>

        {/* Real editor screen — a genuine pdf.js-rendered document composited into the
            editor UI (annotate + sign). Generated by scripts/gen-editor-showcase.mjs. */}
        <div className="mx-auto mt-11 max-w-3xl overflow-hidden rounded-2xl border shadow-2xl ring-1 ring-black/5">
          <Image
            src="/editor-showcase.png"
            alt="The DiemDesk Editor — highlighting and signing a PDF, entirely on your device"
            width={1536}
            height={980}
            className="block h-auto w-full"
            sizes="(min-width: 768px) 48rem, 100vw"
            unoptimized
          />
        </div>

        <div className="mt-9 text-center">
          <Link href="/annotate-pdf" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-sm transition-all hover:gap-2.5 hover:shadow-lg">
            Open the DiemDesk Editor <ArrowRight className="size-4" />
          </Link>
        </div>
      </motion.div>

    </section>
  );
}
