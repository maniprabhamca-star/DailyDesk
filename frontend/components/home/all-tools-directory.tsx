'use client';

import Link from 'next/link';
import { CSSProperties } from 'react';
import { Search, Wand2, CloudOff, Ban, UserX, Droplets } from 'lucide-react';
import { catalog, BADGE, type CatTool } from '@/components/app/catalog';

// Per-tool colour + one-line benefit. Each tool gets its OWN hue (not one colour
// per group) and a benefit blurb — our distinct, premium take on a tool grid.
const META: Record<string, { color: string; desc: string }> = {
  'Merge PDF': { color: '#e11d48', desc: 'Join files into one' },
  'Split PDF': { color: '#d97706', desc: 'Pull out pages' },
  'Compress PDF': { color: '#0d9488', desc: 'Shrink the size' },
  'Rotate PDF': { color: '#0284c7', desc: 'Turn pages visually' },
  'Delete pages': { color: '#dc2626', desc: 'Remove pages' },
  'Page numbers': { color: '#7c3aed', desc: 'Stamp numbers' },
  'JPG to PDF': { color: '#4f46e5', desc: 'Images into a PDF' },
  'PDF to JPG': { color: '#c026d3', desc: 'Pages to images' },
  'PDF to Word': { color: '#2563eb', desc: 'Editable Word doc' },
  'Word to PDF': { color: '#1d4ed8', desc: 'Word into a PDF' },
  'HTML to PDF': { color: '#0891b2', desc: 'Web page to PDF' },
  'Edit PDF': { color: '#ea580c', desc: 'Change text & images' },
  'Annotate': { color: '#c2410c', desc: 'Highlight & comment' },
  'Watermark': { color: '#0f766e', desc: 'Stamp a watermark' },
  'Redact PDF': { color: '#475569', desc: 'Black out secrets' },
  'Sign PDF': { color: '#7c3aed', desc: 'Add your signature' },
  'Protect PDF': { color: '#b45309', desc: 'Password-lock it' },
  'OCR': { color: '#0284c7', desc: 'Make scans searchable' },
  'Chat with PDF': { color: '#db2777', desc: 'Ask your document' },
  'Summarize': { color: '#7c3aed', desc: 'Get the gist' },
  'Translate': { color: '#2563eb', desc: 'Into any language' },
  'QR generator': { color: '#059669', desc: 'Make a QR code' },
  'Password': { color: '#6d28d9', desc: 'Strong passwords' },
  'Smart notes': { color: '#16a34a', desc: 'Quick notes' },
  'Habit tracker': { color: '#ea580c', desc: 'Build streaks' },
  'Budget tracker': { color: '#0d9488', desc: 'Track spending' },
  'File vault': { color: '#4f46e5', desc: 'Encrypted storage' },
  'Link in bio': { color: '#db2777', desc: 'One link page' },
};

function Tile({ t, groupColor }: { t: CatTool; groupColor: string }) {
  const Icon = t.icon;
  const B = BADGE[t.badge];
  const color = META[t.name]?.color ?? groupColor;
  const desc = META[t.name]?.desc;

  const inner = (
    <div
      style={{ ['--tool' as string]: color } as CSSProperties}
      className={`group relative h-full rounded-2xl border bg-card p-3.5 shadow-soft transition-all ${
        t.soon ? 'opacity-80' : 'hover:-translate-y-0.5 hover:border-[color:var(--tool)] hover:shadow-md'
      }`}
    >
      {/* privacy signal — our identity, tucked top-right */}
      <B.icon className="absolute right-2.5 top-2.5 size-[15px]" style={{ color: B.color }} aria-label={B.label} />

      <span
        className="mb-2.5 flex size-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105"
        style={{ backgroundColor: color }}
      >
        <Icon className="size-[19px]" strokeWidth={2.25} />
      </span>

      <p className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-foreground">
        {t.name}
        {t.soon && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">soon</span>}
      </p>
      {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
    </div>
  );

  return t.href ? (
    <Link href={t.href} className="block">{inner}</Link>
  ) : (
    <div className="cursor-default">{inner}</div>
  );
}

export function AllToolsDirectory() {
  return (
    <section id="tools" className="scroll-mt-20 border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
        {/* Trust strip — one straight line on all sizes (smaller on mobile so it never wraps) */}
        <div className="mb-9 flex items-center justify-center gap-x-3 sm:gap-x-7">
          {[
            { icon: CloudOff, t: 'No uploads' },
            { icon: Ban, t: 'No ads' },
            { icon: UserX, t: 'No signup' },
            { icon: Droplets, t: 'No watermark' },
          ].map((x) => (
            <span key={x.t} className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-foreground/80 sm:gap-1.5 sm:text-sm">
              <x.icon className="size-3.5 shrink-0 text-emerald-600 sm:size-4" strokeWidth={2.25} /> {x.t}
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

        {/* Grouped tile grids */}
        <div className="space-y-8">
          {catalog.map((g) => (
            <div key={g.label}>
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} /> {g.label}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {g.tools.map((t) => <Tile key={t.name} t={t} groupColor={g.color} />)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend — clean 2×2 grid on mobile (no ragged wrap), centered row on desktop */}
        <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-3 border-y pb-6 pt-6 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-5 sm:gap-y-2">
          {(Object.keys(BADGE) as (keyof typeof BADGE)[]).map((k) => {
            const B = BADGE[k];
            return (
              <span key={k} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <B.icon className="size-4 shrink-0" style={{ color: B.color }} /> {B.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
