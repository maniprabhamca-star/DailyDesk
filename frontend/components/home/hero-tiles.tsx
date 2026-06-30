'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { Shrink, Combine, QrCode, KeyRound, ArrowRight, Lock, CloudOff, Zap, ShieldCheck, type LucideIcon } from 'lucide-react';

// Hero cluster, right of the purple hero box: an animated capability showcase
// (centre) that cycles through real tools, and a privacy-first proof tile
// (rightmost). The showcase demonstrates the product working with motion, but
// stays honest (every scene links to a LIVE tool) and frugal (pauses when
// offscreen or hovered, and respects prefers-reduced-motion).

type Scene = { icon: LucideIcon; title: string; from: string; to: string; bar: string; chipBg: string; chipFg: string; w: number; href: string };

const SCENES: Scene[] = [
  { icon: Shrink, title: 'Compress a PDF', from: '4.8 MB', to: '820 KB', bar: '#1D9E75', chipBg: 'rgba(29,158,117,0.14)', chipFg: '#0F6E56', w: 18, href: '/compress-pdf' },
  { icon: Combine, title: 'Merge files', from: '3 files', to: '1 PDF', bar: '#D85A30', chipBg: 'rgba(216,90,48,0.14)', chipFg: '#993C1D', w: 34, href: '/merge-pdf' },
  { icon: QrCode, title: 'Make a QR code', from: 'a link', to: 'scannable', bar: '#378ADD', chipBg: 'rgba(55,138,221,0.14)', chipFg: '#0C447C', w: 100, href: '/tools/qr-code' },
  { icon: KeyRound, title: 'Strong password', from: 'weak', to: 'unbreakable', bar: '#639922', chipBg: 'rgba(99,153,34,0.16)', chipFg: '#27500A', w: 92, href: '/tools/password' },
];

export function HeroShowcase({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [barW, setBarW] = useState(SCENES[0].w);
  const ref = useRef<HTMLAnchorElement>(null);
  const paused = useRef(false);
  const visible = useRef(true);

  // Cycle scenes — paused on hover (so the click target is stable) and when the
  // tile is scrolled out of view. Disabled entirely under reduced-motion.
  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    const io = el
      ? new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.2 })
      : null;
    if (el && io) io.observe(el);
    const id = setInterval(() => { if (!paused.current && visible.current) setI((p) => (p + 1) % SCENES.length); }, 2400);
    return () => { clearInterval(id); io?.disconnect(); };
  }, [reduce]);

  // Re-fill the bar on each scene: snap to full, then ease to the scene's target.
  useEffect(() => {
    if (reduce) { setBarW(SCENES[i].w); return; }
    setBarW(100);
    const t = setTimeout(() => setBarW(SCENES[i].w), 90);
    return () => clearTimeout(t);
  }, [i, reduce]);

  const s = SCENES[i];
  const Icon = s.icon;

  return (
    <Link
      ref={ref}
      href={s.href}
      aria-label={`${s.title} — open tool`}
      onPointerEnter={() => { paused.current = true; }}
      onPointerLeave={() => { paused.current = false; }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" /></span>
          Live demo
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: s.chipBg, color: s.chipFg }}>
            <Icon className="size-5" strokeWidth={2.25} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">{s.title}</span>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground line-through">{s.from}</span>
            <span className="font-semibold text-emerald-600">{s.to}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${barW}%`, backgroundColor: s.bar }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {SCENES.map((_, k) => (
            <span key={k} className={`h-1 rounded-full transition-all ${k === i ? 'w-4 bg-primary' : 'w-2 bg-border'}`} />
          ))}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">10 free tools</span>
      </div>
    </Link>
  );
}

export function HeroPrivacy({ className = '' }: { className?: string }) {
  const points: { icon: LucideIcon; title: string; sub: string }[] = [
    { icon: Lock, title: '100% in your browser', sub: 'Files never leave your device' },
    { icon: CloudOff, title: '0 files uploaded', sub: 'Nothing ever hits a server' },
    { icon: Zap, title: 'Instant & offline', sub: 'No queues, no waiting' },
  ];
  return (
    <Link
      href="/security"
      className={`group flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-background p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card dark:border-emerald-900/40 dark:from-emerald-950/30 ${className}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-emerald-600" /> Private by design
      </div>
      <ul className="space-y-2.5">
        {points.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.title} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><Icon className="size-3.5" /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{p.title}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">{p.sub}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">How it works <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
    </Link>
  );
}
