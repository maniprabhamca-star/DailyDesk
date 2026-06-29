'use client';

import Link from 'next/link';
import { Search, Wand2, CloudOff, Ban, UserX, Droplets } from 'lucide-react';
import { catalog, BADGE, type CatTool, type Badge } from '@/components/app/catalog';

function Row({ t, color }: { t: CatTool; color: string }) {
  const Icon = t.icon;
  const B = BADGE[t.badge];
  const inner = (
    <div className={`flex items-center gap-3 rounded-lg px-2 py-2 ${t.soon ? '' : 'hover:bg-accent'}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1A`, color }}>
        <Icon className="size-[18px]" strokeWidth={2.25} />
      </span>
      <span className="flex-1 truncate text-sm font-semibold text-foreground">
        {t.name}
        {t.soon && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">soon</span>}
      </span>
      <B.icon className="size-4 shrink-0" style={{ color: B.color }} aria-label={B.label} />
    </div>
  );
  return t.href ? <Link href={t.href}>{inner}</Link> : <div className="cursor-default opacity-90">{inner}</div>;
}

export function AllToolsDirectory() {
  return (
    <section className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {/* Trust strip */}
        <div className="mb-9 flex flex-wrap justify-center gap-x-7 gap-y-2">
          {[
            { icon: CloudOff, t: 'No uploads' },
            { icon: Ban, t: 'No ads' },
            { icon: UserX, t: 'No signup' },
            { icon: Droplets, t: 'No watermark' },
          ].map((x) => (
            <span key={x.t} className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80">
              <x.icon className="size-4 text-emerald-600" strokeWidth={2.25} /> {x.t}
            </span>
          ))}
        </div>

        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">All tools</h2>
          <button onClick={() => window.dispatchEvent(new Event('dd-command-open'))} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Search className="size-4" /> Filter…
            <kbd className="rounded border px-1 text-[10px]">⌘K</kbd>
          </button>
        </div>

        {/* Workflows (coming soon) */}
        <div className="mb-8">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-600">
            <Wand2 className="size-4" strokeWidth={2.25} /> Workflows <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] text-violet-700 dark:bg-violet-950/50">coming soon</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {['Merge → Compress', 'Scan → OCR → Compress', 'Images → PDF → Sign'].map((w) => (
              <span key={w} className="rounded-full border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground">{w}</span>
            ))}
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((g) => (
            <div key={g.label}>
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
              <div className="space-y-0.5">
                {g.tools.map((t) => <Row key={t.name} t={t} color={g.color} />)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5">
          {(Object.keys(BADGE) as Badge[]).map((k) => {
            const B = BADGE[k];
            return (
              <span key={k} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <B.icon className="size-4" style={{ color: B.color }} /> {B.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
