'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import {
  ShieldCheck, CloudOff, Ban, UserX, ArrowRight, Download, Check,
  Combine, Shrink, PenTool, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { liveToolCount } from '@/components/app/catalog';

function TrustChips() {
  const items = [
    { icon: CloudOff, t: 'No file uploads' },
    { icon: Ban, t: 'No ads' },
    { icon: UserX, t: 'No signup' },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((x) => (
        <span key={x.t} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <x.icon className="size-3.5" style={{ color: '#059669' }} strokeWidth={2.25} /> {x.t}
        </span>
      ))}
    </div>
  );
}

// A browser-framed product screenshot that slides between real tools — premium
// (looks like the real app) AND cycling. Pauses on hover, respects reduced-motion,
// and the whole frame links to the current tool (honest: it's a real demo).
const SLIDES = [
  { slug: 'compress-pdf', color: '#0d9488', Icon: Shrink, name: 'Compress a PDF', sub: 'report.pdf · 4.8 MB', from: '4.8 MB', to: '820 KB', result: 'Compressed · 820 KB' },
  { slug: 'merge-pdf', color: '#e11d48', Icon: Combine, name: 'Merge files', sub: '3 documents', from: '3 files', to: '1 PDF', result: 'Merged · merged.pdf' },
  { slug: 'jpg-to-pdf', color: '#d97706', Icon: ImageIcon, name: 'Image to PDF', sub: 'photo.jpg', from: 'JPG', to: 'PDF', result: 'Converted · document.pdf' },
];

function ToolScene({ Icon, color, name, sub, from, to, result }: (typeof SLIDES)[number]) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22`, color }}><Icon className="size-[18px]" strokeWidth={2.25} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center gap-3">
        <span className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">{from}</span>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        <span className="rounded-lg px-3 py-2 text-sm font-medium" style={{ backgroundColor: `${color}14`, color }}>{to}</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-3.5" /> {result}</span>
        <Download className="size-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function FramedSlider() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => { if (!paused.current) setI((p) => (p + 1) % SLIDES.length); }, 3600);
    return () => clearInterval(id);
  }, [reduce]);
  const s = SLIDES[i];
  return (
    <Link
      href={`/${s.slug}`}
      aria-label={`${s.name} — open tool`}
      onPointerEnter={() => { paused.current = true; }}
      onPointerLeave={() => { paused.current = false; }}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-lift transition-shadow hover:shadow-card"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        <span className="ml-2 flex-1 truncate rounded-md border bg-background px-2 py-1 text-center text-[11px] text-muted-foreground">diemdesk.com/{s.slug}</span>
        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="relative h-[200px] md:h-[212px]">
        {SLIDES.map((sl, idx) => (
          <div key={sl.slug} className={`absolute inset-0 transition-opacity duration-500 ${idx === i ? 'opacity-100' : 'opacity-0'}`} aria-hidden={idx !== i}>
            <ToolScene {...sl} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-3">
        {SLIDES.map((_, idx) => (
          <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-4 bg-primary' : 'w-1.5 bg-border'}`} />
        ))}
      </div>
    </Link>
  );
}

// The product screenshot surrounded by floating tool tiles + a few accent marks —
// our own take on the "product cluster" hero visual (brand colours, our tools).
function ProductCluster() {
  // Four tool tiles pinned to the FRAME's corners (not the outer box), so they
  // pop off each corner cleanly at every width instead of drifting over the
  // slider content on narrow screens — the tidy "product + corner badges" look.
  const tiles = [
    { bg: 'bg-violet-500', Icon: PenTool, cls: '-left-4 -top-4' },
    { bg: 'bg-amber-500', Icon: ImageIcon, cls: '-right-4 -top-4' },
    { bg: 'bg-teal-500', Icon: Shrink, cls: '-left-4 -bottom-4' },
    { bg: 'bg-rose-600', Icon: Combine, cls: '-right-4 -bottom-4' },
  ];
  return (
    <div className="relative mx-auto flex h-[320px] w-full max-w-[520px] items-center justify-center md:h-[368px] md:translate-y-6">
      <div aria-hidden className="pointer-events-none absolute inset-8 rounded-[40px]" style={{ background: 'radial-gradient(closest-side, rgba(124,58,237,0.10), transparent)' }} />
      {/* the sliding browser-framed product shot with tool tiles on its corners */}
      <div className="relative w-[360px] max-w-[86%] md:max-w-[92%]">
        <FramedSlider />
        {tiles.map((t, i) => (
          <span key={i} className={`absolute z-10 flex size-10 items-center justify-center rounded-2xl text-white shadow-lift ring-4 ring-background ${t.bg} ${t.cls}`}>
            <t.Icon className="size-[18px]" strokeWidth={2.25} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function HeroHybrid() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-8 pt-7 sm:px-6 sm:pb-12 sm:pt-9 md:grid-cols-2 lg:gap-16">
        <div className="md:pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Private by design
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Every daily tool.<br />
            <span className="text-primary lg:whitespace-nowrap">Your files stay yours.</span>
          </h1>
          <p className="mt-7 max-w-sm text-base leading-relaxed text-muted-foreground">
            Merge, compress, convert, sign — {liveToolCount}+ PDF and everyday tools. Free, no signup, and private by default.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg"><Link href="/register">Start free</Link></Button>
            <Link href="/#how" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              See how it works <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8"><TrustChips /></div>
        </div>
        <ProductCluster />
      </div>
    </section>
  );
}
