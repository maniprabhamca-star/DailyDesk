'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import {
  ShieldCheck, CloudOff, Ban, UserX, ArrowRight, Download, Check,
  Combine, Shrink, PenTool, Image as ImageIcon, FileText, Lock, ScanSearch,
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

function PrivacyCommandDemo() {
  return (
    <Link
      href="/share-safe-pdf-check"
      aria-label="Open Share-Safe PDF Check"
      className="group block overflow-hidden rounded-2xl border bg-card shadow-lift transition-shadow hover:shadow-card"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        <span className="ml-2 flex-1 truncate rounded-md border bg-background px-2 py-1 text-center text-[11px] text-muted-foreground">private workspace</span>
        <ShieldCheck className="size-3.5 text-emerald-600" />
      </div>
      <div className="p-4">
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Client packet</p>
              <p className="text-[11px] text-muted-foreground">12 pages · on-device</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700">0 uploads</span>
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ['Metadata', 'Clean'],
              ['Links', 'Review'],
              ['Blank pages', '2 found'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { Icon: ScanSearch, label: 'Check' },
            { Icon: Lock, label: 'Protect' },
            { Icon: Download, label: 'Export' },
          ].map((x) => (
            <div key={x.label} className="rounded-xl border bg-background p-2 text-center">
              <x.Icon className="mx-auto size-4 text-primary" />
              <p className="mt-1 text-[10px] font-medium text-muted-foreground">{x.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><Check className="size-3.5" /> Ready to share</span>
          <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export function HeroVisualOptions() {
  const variants = [
    {
      name: 'Private Command Center',
      eyebrow: 'Best default',
      title: 'Every document task, private by design.',
      copy: 'A calm command center for PDF cleanup, safe sharing, packet building, signatures, and everyday file work. No real document content in the hero.',
      note: 'Strongest all-around homepage direction: premium, useful, and clearly private.',
      Visual: PrivacyCommandDemo,
    },
    {
      name: 'Workflow In Motion',
      eyebrow: 'Fading demo',
      title: 'Drop a file in. Watch the workflow finish.',
      copy: 'Shows DiemDesk as a guided process instead of a static tool grid: clean, check, organize, export.',
      note: 'Uses a fading/rotating synthetic tool deck, similar to the main site feel but without sensitive PDF screenshots.',
      Visual: FadingWorkflowDemo,
    },
    {
      name: 'Share-Safe First',
      eyebrow: 'Privacy proof',
      title: 'Know what is inside before you send.',
      copy: 'Makes the first impression about trust: links, metadata, blank pages, exposed text, signatures, and file size checked before sharing.',
      note: 'Best if you want DiemDesk to own the “safe to send” positioning.',
      Visual: ShareSafeHeroDemo,
    },
    {
      name: 'Packet Builder',
      eyebrow: 'Workflow template',
      title: 'Build client packets without the file chaos.',
      copy: 'A premium workflow visual for combining forms, cleaning pages, adding signatures, and exporting a polished client packet.',
      note: 'Good for business users because it shows an outcome, not just tools.',
      Visual: PacketBuilderHeroDemo,
    },
    {
      name: 'Clean Scan Studio',
      eyebrow: 'Before/after',
      title: 'Turn messy scans into share-ready PDFs.',
      copy: 'Highlights everyday scan cleanup: deskew, contrast, page cleanup, screenshot story mode, and export.',
      note: 'Best visual for showing transformation while keeping content generic and safe.',
      Visual: CleanScanHeroDemo,
    },
  ];
  return (
    <div className="grid gap-8">
      {variants.map((v, i) => (
        <section key={v.name} className="overflow-hidden rounded-3xl border bg-card shadow-soft">
          <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Option {i + 1}</span>
                <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{v.eyebrow}</span>
              </div>
              <h2 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{v.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{v.copy}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                <span className="rounded-full border bg-background px-2.5 py-1">No real PDFs shown</span>
                <span className="rounded-full border bg-background px-2.5 py-1">Private/on-device proof</span>
                <span className="rounded-full border bg-background px-2.5 py-1">Premium product UI</span>
              </div>
              <p className="mt-5 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">{v.note}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-background to-emerald-500/10 p-4">
              <v.Visual />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function FadingWorkflowDemo() {
  return (
    <div className="mx-auto max-w-[520px]">
      <FramedSlider />
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] font-medium text-muted-foreground">
        {['Drop', 'Clean', 'Check', 'Export'].map((step, i) => (
          <div key={step} className="rounded-xl border bg-background px-2 py-2">
            <span className="mx-auto mb-1 flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">{i + 1}</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareSafeHeroDemo() {
  return (
    <div className="mx-auto max-w-[520px] overflow-hidden rounded-2xl border bg-card shadow-lift">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <ShieldCheck className="size-4 text-emerald-600" />
        <span className="text-sm font-semibold">Share-Safe Check</span>
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700">On your device</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border bg-muted/30 p-3">
          <FileText className="mb-3 size-8 text-primary" />
          <p className="text-sm font-semibold">packet-preview.pdf</p>
          <p className="text-xs text-muted-foreground">Synthetic preview only</p>
          <div className="mt-4 h-28 rounded-lg bg-background p-3">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="mt-2 h-2 w-full rounded bg-muted/70" />
            <div className="mt-2 h-2 w-2/3 rounded bg-muted/70" />
            <div className="mt-5 h-7 rounded border border-dashed border-primary/35 bg-primary/5" />
          </div>
        </div>
        <div className="grid gap-2">
          {[
            ['Metadata', 'Removed', 'text-emerald-700'],
            ['Private links', '2 to review', 'text-amber-700'],
            ['Blank pages', '1 found', 'text-amber-700'],
            ['File size', 'Ready', 'text-emerald-700'],
          ].map(([label, status, color]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-semibold ${color}`}>{status}</span>
            </div>
          ))}
          <div className="mt-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground">Review before sharing</div>
        </div>
      </div>
    </div>
  );
}

function PacketBuilderHeroDemo() {
  return (
    <div className="mx-auto max-w-[520px] rounded-2xl border bg-card p-4 shadow-lift">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Client Packet Builder</p>
          <p className="text-xs text-muted-foreground">Template: onboarding packet</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">7 steps</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2">
          {['Cover page', 'Agreement', 'W-9 form', 'Signature page'].map((label, i) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <span className={`flex size-5 items-center justify-center rounded-full ${i < 3 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>{i < 3 ? <Check className="size-3" /> : i + 1}</span>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
        <div className="relative min-h-[190px]">
          {[0, 1, 2].map((n) => (
            <div key={n} className="absolute rounded-xl border bg-white shadow-soft" style={{ inset: `${n * 13}px ${36 - n * 12}px ${26 - n * 7}px ${n * 16}px`, transform: `rotate(${(n - 1) * 2}deg)` }}>
              <div className="m-3 h-3 w-1/2 rounded bg-muted" />
              <div className="mx-3 mt-3 h-2 rounded bg-muted/60" />
              <div className="mx-3 mt-2 h-2 w-2/3 rounded bg-muted/60" />
              <div className="absolute bottom-3 right-3 rounded-md border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary">SIGN</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CleanScanHeroDemo() {
  return (
    <div className="mx-auto max-w-[520px] rounded-2xl border bg-card p-4 shadow-lift">
      <div className="flex items-center gap-2">
        <ScanSearch className="size-4 text-primary" />
        <p className="text-sm font-semibold">Clean Scan Studio</p>
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700">Private cleanup</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Before</p>
          <div className="-rotate-2 rounded-lg bg-white p-3 shadow-soft">
            <div className="h-3 w-3/5 rounded bg-slate-300" />
            <div className="mt-3 h-2 rounded bg-slate-200" />
            <div className="mt-2 h-2 w-5/6 rounded bg-slate-200" />
            <div className="mt-5 h-16 rounded bg-slate-100" />
          </div>
        </div>
        <div className="rounded-xl border bg-emerald-500/5 p-3">
          <p className="mb-2 text-xs font-semibold text-emerald-700">After</p>
          <div className="rounded-lg bg-white p-3 shadow-soft">
            <div className="h-3 w-3/5 rounded bg-slate-800" />
            <div className="mt-3 h-2 rounded bg-slate-400" />
            <div className="mt-2 h-2 w-5/6 rounded bg-slate-400" />
            <div className="mt-5 h-16 rounded border border-dashed border-emerald-400 bg-emerald-50" />
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold text-muted-foreground">
        {['Deskew', 'Sharpen', 'Export'].map((label) => <span key={label} className="rounded-lg border bg-background px-2 py-1.5">{label}</span>)}
      </div>
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
        <PrivacyCommandDemo />
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
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Private by design
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Every daily tool.<br />
            <span className="text-primary lg:whitespace-nowrap">Your files stay yours.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Merge, compress, convert, sign — {liveToolCount}+ PDF and everyday tools. Free, no signup, and private by design.
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
