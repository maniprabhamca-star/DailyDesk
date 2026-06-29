'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck, CloudOff, ArrowRight, FileText, Scissors, Combine, Search, QrCode, Lock,
} from 'lucide-react';

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
    <section className="mx-auto max-w-6xl space-y-28 px-4 py-20 sm:px-6 md:space-y-36">

      {/* 1 · Privacy */}
      <Row eyebrow="Private by design" eyebrowColor="#059669" title="Your files never leave your device." body="Most tools run entirely in your browser. Nothing is uploaded, nothing is stored — your documents stay yours, every time." cta="Try a tool" href="/merge-pdf">
        <div className="relative rounded-2xl border bg-gradient-to-br from-emerald-50 to-background p-6 dark:from-emerald-950/20">
          <div className="mx-auto max-w-xs overflow-hidden rounded-xl border bg-card shadow-lift">
            <div className="flex items-center gap-1.5 border-b px-3 py-2">
              <span className="size-2 rounded-full bg-red-400" /><span className="size-2 rounded-full bg-amber-400" /><span className="size-2 rounded-full bg-emerald-400" />
              <span className="ml-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="size-3" /> this device</span>
            </div>
            <div className="space-y-2 p-5">
              <div className="h-2 w-[80%] rounded bg-muted" /><div className="h-2 w-[95%] rounded bg-muted" /><div className="h-2 w-[70%] rounded bg-muted" />
              <div className="!mt-5 flex flex-col items-center gap-2 rounded-lg bg-emerald-500/10 p-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white"><ShieldCheck className="size-6" strokeWidth={2.25} /></span>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Stays on your device</p>
              </div>
            </div>
          </div>
          <span className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-soft"><CloudOff className="size-3.5 text-emerald-600" /> 0 uploads</span>
        </div>
      </Row>

      {/* 2 · PDF */}
      <Row reverse eyebrow="PDF workspace" eyebrowColor="#dc2626" title="Everything for your PDFs." body="Merge, split, compress, convert, sign and more — 20+ PDF tools, all free and private. Replace your $20/mo PDF subscription." cta="Open PDF tools" href="/merge-pdf">
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

    </section>
  );
}
