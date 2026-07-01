'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import {
  ShieldCheck, CloudOff, Ban, UserX, ArrowRight, FileText, Download, Check,
  Search, Combine, QrCode, Sparkles, Shrink, PenTool, Plus, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { liveToolCount } from '@/components/app/catalog';

/* ------------------------------------------------------------------ */
/*  Shared product-shot cards (the "real tool" visuals in each hero)   */
/* ------------------------------------------------------------------ */

// Compress before/after, in a browser frame. `dark` = the Midnight (V1) styling.
function CompressShot({ dark = false }: { dark?: boolean }) {
  const frame = dark
    ? 'border-white/10 bg-[#12172a] shadow-[0_20px_45px_-18px_rgba(0,0,0,0.6)]'
    : 'border bg-card shadow-lift';
  const bar = dark ? 'bg-white/10' : 'bg-muted';
  const barFill = dark ? 'bg-white/20' : 'bg-border';
  const url = dark ? 'text-slate-500 border-white/10 bg-white/5' : 'text-muted-foreground border bg-background';
  const dot = dark ? 'border-b border-white/10' : 'border-b';
  const teal = '#0d9488';
  const nameText = dark ? 'text-slate-200' : 'text-foreground';
  const subText = dark ? 'text-slate-500' : 'text-muted-foreground';

  return (
    <div className={`overflow-hidden rounded-2xl ${frame}`}>
      <div className={`flex items-center gap-2 px-3 py-2.5 ${dot}`}>
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        <span className={`ml-2 flex-1 truncate rounded-md px-2 py-1 text-center text-[11px] ${url}`}>dailydesk.app/compress-pdf</span>
      </div>
      <div className="p-4">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(13,148,136,0.16)', color: teal }}><FileText className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className={`text-[13px] font-semibold ${nameText}`}>report.pdf</div>
            <div className={`text-[11px] ${subText}`}>4.8 MB</div>
          </div>
          <span className="flex size-[52px] items-center justify-center rounded-full border-4 text-[13px] font-semibold" style={{ borderColor: teal, color: teal }}>−83%</span>
        </div>
        <div className={`mb-1 text-[11px] ${subText}`}>Before</div>
        <div className={`mb-2.5 h-2 overflow-hidden rounded-full ${bar}`}><div className={`h-full w-full rounded-full ${barFill}`} /></div>
        <div className={`mb-1 text-[11px] ${subText}`}>After</div>
        <div className={`mb-3.5 h-2 overflow-hidden rounded-full ${bar}`}><div className="h-full rounded-full" style={{ width: '17%', backgroundColor: teal }} /></div>
        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(13,148,136,0.12)' }}>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: dark ? '#5eead4' : '#0f6e56' }}><Check className="size-3.5" /> Compressed · 820 KB</span>
          <Download className="size-3.5" style={{ color: teal }} />
        </div>
      </div>
    </div>
  );
}

// Command-palette shot (theme-aware) for the Daylight (V2) hero.
function PaletteShot() {
  const rows = [
    { icon: Shrink, bg: 'rgba(13,148,136,0.14)', fg: '#0d9488', title: 'Compress a PDF', sub: 'Shrink the size — stays crisp', enter: true },
    { icon: Combine, bg: 'rgba(225,29,72,0.12)', fg: '#e11d48', title: 'Merge files', sub: 'Join into one PDF' },
    { icon: QrCode, bg: 'rgba(99,102,241,0.12)', fg: '#6366f1', title: 'Make a QR code', sub: 'From any link' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-lift">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <Search className="size-4 text-muted-foreground" />
        <span className="text-sm">compress</span>
        <span className="ml-auto rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
      </div>
      <div className="p-2">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${i === 0 ? 'bg-accent' : ''}`}>
              <span className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: r.bg, color: r.fg }}><Icon className="size-4" strokeWidth={2.25} /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.title}</p><p className="text-[11px] text-muted-foreground">{r.sub}</p></div>
              {r.enter && <span className="text-[11px] font-medium text-primary">↵</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustChips({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const text = tone === 'dark' ? 'text-slate-400' : 'text-muted-foreground';
  const icon = tone === 'dark' ? '#34d399' : '#059669';
  const items = [
    { icon: CloudOff, t: 'No file uploads' },
    { icon: Ban, t: 'No ads' },
    { icon: UserX, t: 'No signup' },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((x) => (
        <span key={x.t} className={`flex items-center gap-1.5 text-xs font-medium ${text}`}>
          <x.icon className="size-3.5" style={{ color: icon }} strokeWidth={2.25} /> {x.t}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  V1 · Midnight — dark, product-led, two-column (Linear-style)       */
/* ------------------------------------------------------------------ */
export function HeroV1() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: '#0b0e17',
        backgroundImage:
          'radial-gradient(680px 400px at 12% 0%, rgba(124,58,237,0.34), transparent 70%), radial-gradient(600px 400px at 96% 110%, rgba(16,185,129,0.16), transparent 70%)',
      }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-violet-200">
            <ShieldCheck className="size-3.5" /> Private by design
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.03] tracking-tight text-white sm:text-6xl">
            Every daily tool.<br />Nothing ever uploaded.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400 sm:text-lg">
            Merge, compress, convert, sign — {liveToolCount}+ tools that run 100% in your browser. Free, no signup.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg"><Link href="/register">Start free — no signup</Link></Button>
            <Link href="/security" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              See how it works <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8"><TrustChips tone="dark" /></div>
        </div>
        <div><CompressShot dark /></div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  V2 · Daylight — light, warm, centered (Notion-style)               */
/* ------------------------------------------------------------------ */
export function HeroV2() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{ background: 'radial-gradient(720px 360px at 50% -6%, rgba(124,58,237,0.13), transparent 70%)' }}
      />
      <div className="relative mx-auto max-w-4xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" /> {liveToolCount}+ tools · one workspace
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
          Your all-in-one toolkit.<br className="hidden sm:block" /> Private, and free.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Every PDF and everyday tool you reach for, running right in your browser. Your files never leave your device.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg"><Link href="/register">Start free — no signup</Link></Button>
          <Link href="/#tools" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Browse tools <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-6 flex justify-center"><TrustChips /></div>
      </div>
      <div className="relative mx-auto mt-12 max-w-xl px-4 sm:px-6"><PaletteShot /></div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Hybrid — V2 warm centered layout + V1 framed product shot + orbs   */
/* ------------------------------------------------------------------ */
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
        <span className="ml-2 flex-1 truncate rounded-md border bg-background px-2 py-1 text-center text-[11px] text-muted-foreground">dailydesk.app/{s.slug}</span>
        <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="relative h-[188px]">
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
  // Slider (the cycling live-tool showcase) is the star; a few calm tool tiles frame it.
  const tiles = [
    { bg: 'bg-violet-500', Icon: PenTool, cls: 'left-0 top-8' },
    { bg: 'bg-amber-500', Icon: ImageIcon, cls: 'right-1 top-2' },
    { bg: 'bg-teal-500', Icon: Shrink, cls: 'left-1 bottom-6' },
    { bg: 'bg-rose-600', Icon: Combine, cls: 'right-0 bottom-6' },
  ];
  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[430px]">
      <div aria-hidden className="pointer-events-none absolute inset-10 rounded-[40px]" style={{ background: 'radial-gradient(closest-side, rgba(124,58,237,0.10), transparent)' }} />
      {/* subtle accent mark (desktop only) */}
      <Plus aria-hidden className="absolute left-1/2 top-1 hidden size-4 -translate-x-1/2 text-amber-400 sm:block" />
      {/* the sliding browser-framed product shot — the centrepiece */}
      <div className="absolute left-1/2 top-1/2 w-[310px] max-w-[88%] -translate-x-1/2 -translate-y-1/2">
        <FramedSlider />
      </div>
      {/* calm framing tool tiles */}
      {tiles.map((t, i) => (
        <span key={i} className={`absolute z-10 flex size-10 items-center justify-center rounded-2xl text-white shadow-lift ${t.bg} ${t.cls}`}>
          <t.Icon className="size-[18px]" strokeWidth={2.25} />
        </span>
      ))}
    </div>
  );
}

export function HeroHybrid() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-2 lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Private by design
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
            Every daily tool.<br />
            <span className="text-primary">None of it uploaded.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Merge, compress, convert, sign — {liveToolCount}+ PDF and everyday tools. Free, no signup, and 100% on your device.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg"><Link href="/register">Start free — no signup</Link></Button>
            <Link href="/security" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
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

export function HeroVariant({ variant }: { variant: string }) {
  if (variant === 'v1') return <HeroV1 />;
  if (variant === 'v2') return <HeroV2 />;
  if (variant === 'hybrid') return <HeroHybrid />;
  return null;
}
