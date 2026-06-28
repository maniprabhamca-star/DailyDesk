'use client';

import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, QrCode, FileText, ImageIcon, KeyRound, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolKey = 'qr' | 'pdf' | 'img' | 'pw';
const ORDER: ToolKey[] = ['qr', 'pdf', 'img', 'pw'];
const NAMES: Record<ToolKey, string> = {
  qr: 'QR generator',
  pdf: 'PDF workspace',
  img: 'Image compressor',
  pw: 'Password generator',
};

const winChrome = (
  <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
    <span className="size-2 rounded-full bg-red-400" />
    <span className="size-2 rounded-full bg-amber-400" />
    <span className="size-2 rounded-full bg-emerald-400" />
  </div>
);

function Preview({ tool }: { tool: ToolKey }) {
  if (tool === 'qr') {
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_22px_48px_rgba(15,23,42,0.32)]">
        {winChrome}
        <div className="flex flex-col items-center gap-3 p-4">
          <div className="relative">
            <svg width="104" height="104" viewBox="0 0 29 29" shapeRendering="crispEdges" role="img" aria-label="QR preview">
              <rect width="29" height="29" fill="#fff" />
              <g fill="#4f46e5">
                <path d="M0 0h7v7h-7z M1 1h5v5h-5z" fillRule="evenodd" /><rect x="2" y="2" width="3" height="3" />
                <path d="M22 0h7v7h-7z M23 1h5v5h-5z" fillRule="evenodd" /><rect x="24" y="2" width="3" height="3" />
                <path d="M0 22h7v7h-7z M1 23h5v5h-5z" fillRule="evenodd" /><rect x="2" y="24" width="3" height="3" />
                <rect x="10" y="2" width="2" height="2" /><rect x="14" y="1" width="1" height="3" /><rect x="9" y="9" width="2" height="2" /><rect x="13" y="11" width="3" height="1" /><rect x="17" y="9" width="1" height="3" /><rect x="9" y="18" width="3" height="1" /><rect x="22" y="9" width="2" height="2" /><rect x="22" y="15" width="2" height="1" /><rect x="11" y="23" width="2" height="1" /><rect x="15" y="24" width="2" height="1" /><rect x="23" y="23" width="3" height="1" />
              </g>
            </svg>
            <span className="absolute left-1/2 top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-2 border-white bg-primary text-white">
              <LayoutGrid className="size-3.5" />
            </span>
          </div>
          <div className="flex gap-1.5">
            <span className="size-4 rounded-full bg-slate-900" />
            <span className="size-4 rounded-full bg-primary" />
            <span className="size-4 rounded-full bg-emerald-500" />
            <span className="size-4 rounded-full border border-slate-200 bg-white" />
          </div>
          <div className="flex w-full gap-1.5">
            <span className="flex-1 rounded-lg bg-primary py-1.5 text-center text-[11px] font-medium text-white">PNG</span>
            <span className="flex-1 rounded-lg border border-primary py-1.5 text-center text-[11px] font-medium text-primary">SVG</span>
          </div>
        </div>
      </div>
    );
  }
  if (tool === 'pdf') {
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_22px_48px_rgba(15,23,42,0.32)]">
        {winChrome}
        <div className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-9 items-center justify-center rounded bg-red-100 text-red-600">
              <FileText className="size-5" />
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="h-2 w-[90%] rounded bg-slate-100" />
              <span className="h-2 w-[70%] rounded bg-slate-100" />
              <span className="h-2 w-[80%] rounded bg-slate-100" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">3 files · 12 pages</p>
          <div className="flex flex-wrap gap-1.5">
            {['Merge', 'Split', 'Sign'].map((t) => (
              <span key={t} className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">{t}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (tool === 'img') {
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_22px_48px_rgba(15,23,42,0.32)]">
        {winChrome}
        <div className="flex flex-col gap-2.5 p-4">
          <div className="flex h-[70px] items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-violet-400 text-white">
            <ImageIcon className="size-7" />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 line-through">4.8 MB</span>
            <span className="font-medium text-emerald-600">820 KB · −83%</span>
          </div>
          <div className="h-1.5 rounded-full bg-emerald-100">
            <div className="h-1.5 w-[17%] rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_22px_48px_rgba(15,23,42,0.32)]">
      {winChrome}
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
          <span className="flex-1 font-mono text-xs tracking-wide text-slate-900">sCk^L&lt;8+eI</span>
          <Copy className="size-3.5 text-primary" />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Strength</span>
          <span className="font-medium text-emerald-600">Strong · 92 bits</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200">
          <div className="h-1.5 w-[88%] rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

const ICONS: Record<ToolKey, typeof QrCode> = { qr: QrCode, pdf: FileText, img: ImageIcon, pw: KeyRound };
const POS: Record<ToolKey, string> = {
  qr: 'top-0 left-0',
  pdf: 'top-0 right-0',
  img: 'bottom-0 left-0',
  pw: 'bottom-0 right-0',
};

export function ShowcasePanel() {
  const [active, setActive] = useState<ToolKey>('qr');
  const paused = useRef(false);

  // Auto-rotate (covers mobile/no-hover); pauses while a user is hovering.
  useEffect(() => {
    const id = setInterval(() => {
      if (paused.current) return;
      setActive((cur) => ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden w-1/2 flex-col overflow-hidden bg-gradient-to-br from-primary to-violet-600 p-7 text-white md:flex">
      <div className="pointer-events-none absolute -right-12 -top-16 size-52 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-violet-500/40 blur-3xl" />

      <div className="relative z-10 flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/20">
          <LayoutGrid className="size-[18px]" />
        </span>
        DailyDesk
      </div>

      <div className="relative my-6 flex-1">
        {ORDER.map((t) => {
          const Icon = ICONS[t];
          const on = active === t;
          return (
            <button
              key={t}
              aria-label={NAMES[t]}
              onMouseEnter={() => { paused.current = true; setActive(t); }}
              onMouseLeave={() => { paused.current = false; }}
              onClick={() => setActive(t)}
              className={cn(
                'absolute z-20 flex size-11 items-center justify-center rounded-xl text-white transition-all',
                POS[t],
                on ? 'scale-110 bg-white/30 shadow-lg' : 'bg-white/15 hover:bg-white/25',
              )}
            >
              <Icon className="size-5" />
            </button>
          );
        })}

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[215px] w-[200px]">
            <div className="absolute inset-0 rounded-full bg-white/25 blur-3xl" />
            <div className="absolute -right-2 bottom-1.5 left-4 top-3 rotate-6 rounded-2xl bg-white/15" />
            {ORDER.map((t) => (
              <div
                key={t}
                className={cn('absolute inset-0 transition-opacity duration-300', active === t ? 'opacity-100' : 'opacity-0')}
                aria-hidden={active !== t}
              >
                <Preview tool={t} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <p className="mb-1 text-sm font-medium text-indigo-100">{NAMES[active]}</p>
        <p className="text-xl font-medium leading-tight">Everything you need, in one place.</p>
      </div>
    </div>
  );
}
