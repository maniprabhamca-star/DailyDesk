'use client';

import Link from 'next/link';
import { CSSProperties, useEffect, useState } from 'react';
import { Search, Sparkles, MessageSquare, AlignLeft, Languages, HelpCircle, EyeOff, GitCompare, ArrowRight, Rows3, PanelLeft } from 'lucide-react';
import { catalog, BADGE, type CatTool } from '@/components/app/catalog';

// The AI suite gets its own violet block on the home preview (approved home
// de-clutter mockup): one honest "Launching with Pro" badge instead of six
// "soon" chips, benefit microcopy per tile, tiles link to the tools' real
// pages (SEO pages with the coming-soon gate + FAQs — an informative funnel).
const AI_SUITE = [
  { name: 'Chat with PDF', href: '/chat-pdf', icon: MessageSquare, desc: 'page-cited answers you can verify' },
  { name: 'Summarize', href: '/summarize-pdf', icon: AlignLeft, desc: 'checkable summary, any language' },
  { name: 'Translate', href: '/translate-pdf', icon: Languages, desc: '30+ languages, glossary control' },
  { name: 'Question generator', href: '/pdf-question-generator', icon: HelpCircle, desc: 'quiz + Anki export for revision' },
  { name: 'AI find & redact', href: '/redact-pdf', icon: EyeOff, desc: 'spots personal info, you approve' },
  { name: 'Meaning compare', href: '/compare-pdf', icon: GitCompare, desc: 'what changed — amounts, dates, terms' },
];

function AiSuiteBlock({ id }: { id: string }) {
  return (
    <div id={id} className="scroll-mt-24 rounded-2xl border-[1.5px] border-violet-500/30 bg-gradient-to-br from-violet-500/[0.06] to-violet-500/[0.02] p-4 sm:p-5">
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span className="size-2 rounded-full bg-violet-500" /> AI document suite
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          <Sparkles className="size-2.5" /> Launching with Pro
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">· answers cite the page · your file never leaves your device</span>
        <Link href="/pricing" className="ml-auto shrink-0 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">Explore the suite &rarr;</Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {AI_SUITE.map((t) => (
          <Link key={t.name} href={t.href}
            className="group rounded-2xl border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-violet-500/60 hover:shadow-md">
            <span className="mb-2.5 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm transition-transform group-hover:scale-105">
              <t.icon className="size-[19px]" strokeWidth={2.25} />
            </span>
            <p className="text-sm font-semibold leading-tight text-foreground">{t.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Per-tool colour + one-line benefit. Each tool gets its OWN hue (not one colour
// per group) and a benefit blurb — our distinct, premium take on a tool grid.
const META: Record<string, { color: string; desc: string }> = {
  'PDF viewer': { color: '#0284c7', desc: 'Open & read on-device' },
  'Merge PDF': { color: '#e11d48', desc: 'Join files into one' },
  'Split PDF': { color: '#d97706', desc: 'Pull out pages' },
  'Compress PDF': { color: '#0d9488', desc: 'Shrink the size' },
  'Rotate PDF': { color: '#0284c7', desc: 'Turn pages visually' },
  'Reorder pages': { color: '#9333ea', desc: 'Drag into a new order' },
  'Delete pages': { color: '#dc2626', desc: 'Remove pages' },
  'Page numbers': { color: '#7c3aed', desc: 'Stamp numbers' },
  'JPG to PDF': { color: '#4f46e5', desc: 'Images into a PDF' },
  'PDF to JPG': { color: '#c026d3', desc: 'Pages to images' },
  'Extract images': { color: '#db2777', desc: 'Original pictures out' },
  'PDF to Word': { color: '#2563eb', desc: 'Editable Word doc' },
  'Word to PDF': { color: '#1d4ed8', desc: 'Word into a PDF' },
  'Excel to PDF': { color: '#15803d', desc: 'Sheets into a PDF' },
  'PowerPoint to PDF': { color: '#c2410c', desc: 'Slides into a PDF' },
  'HTML to PDF': { color: '#0891b2', desc: 'Web page to PDF' },
  'Edit PDF': { color: '#ea580c', desc: 'Change text & images' },
  'Annotate': { color: '#c2410c', desc: 'Highlight & comment' },
  'Watermark': { color: '#0f766e', desc: 'Stamp a watermark' },
  'Remove metadata': { color: '#65a30d', desc: 'Wipe hidden info' },
  'Redact PDF': { color: '#475569', desc: 'Black out secrets' },
  'Sign PDF': { color: '#7c3aed', desc: 'Add your signature' },
  'Protect PDF': { color: '#b45309', desc: 'Password-lock it' },
  'Unlock PDF': { color: '#0369a1', desc: 'Remove a known password' },
  'OCR': { color: '#0284c7', desc: 'Make scans searchable' },
  'Chat with PDF': { color: '#db2777', desc: 'Ask your document' },
  'Summarize': { color: '#7c3aed', desc: 'Get the gist' },
  'Translate': { color: '#2563eb', desc: 'Into any language' },
  'QR generator': { color: '#059669', desc: 'Make a QR code' },
  'Password': { color: '#6d28d9', desc: 'Strong passwords' },
  'Compress image': { color: '#ea580c', desc: 'Shrink JPG & PNG' },
  'Resize image': { color: '#0891b2', desc: 'Exact pixels or percent' },
  'Crop image': { color: '#be185d', desc: 'Frame the exact shot' },
  'Convert image': { color: '#9333ea', desc: 'WebP ↔ PNG ↔ JPG' },
  'HEIC to JPG': { color: '#0ea5e9', desc: 'iPhone photos to JPG' },
  'Background remover': { color: '#db2777', desc: 'Cut out the subject' },
  'Compress video': { color: '#dc2626', desc: 'Shrink video size' },
  'Video to GIF': { color: '#7c3aed', desc: 'Clip to a GIF' },
  'Word counter': { color: '#0d9488', desc: 'Words & characters' },
  'Unit converter': { color: '#b45309', desc: 'Any unit to any' },
  'JSON formatter': { color: '#475569', desc: 'Pretty-print JSON' },
  'Color picker': { color: '#c026d3', desc: 'Grab any color' },
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

  // "soon" tools show but aren't clickable for the public (owner-only-until-Pro
  // tools like Annotate/Redact/Edit reach the real tool only by URL, via the gate).
  return t.href && !t.soon ? (
    <Link href={t.href} className="block">{inner}</Link>
  ) : (
    <div className="cursor-default">{inner}</div>
  );
}

// On the home page we show a tidy PREVIEW — each category capped to one row with
// a "See all" link — and move the full directory to /tools, so the landing page
// doesn't become a wall of ~65 tiles. `full` (on /tools) shows everything; a
// live search always shows every match regardless.
const HOME_LIMIT = 6;
const TOTAL_TOOLS = catalog.reduce((n, g) => n + g.tools.length, 0);
// Stable anchor per category so "See all →" jumps to THAT section on /tools.
const groupId = (label: string) => `cat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

// Category nav data (label, colour, count) — 'all' first. Counts derive from the
// catalog so the nav never drifts.
const NAV_ITEMS = [
  { label: 'all', title: 'All', color: '', n: TOTAL_TOOLS },
  ...catalog.map((g) => ({ label: g.label, title: g.label, color: g.color, n: g.tools.length })),
];

// ⟳ INSTANT REVERT: set USE_LEGACY_NAV = true to restore the previous plain
// text-tab rail (kept verbatim in LegacyTabRail below). Nothing else to change.
const USE_LEGACY_NAV = false;

function LegacyTabRail({ cat, setCat }: { cat: string; setCat: (c: string) => void }) {
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-7 border-b bg-background/90 px-4 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6">
      <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[{ label: 'all', color: '' }, ...catalog].map((g) => {
          const isAll = g.label === 'all';
          const active = cat === g.label;
          return (
            <button key={g.label} onClick={() => setCat(g.label)}
              className={`relative flex-none px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {isAll ? 'All' : g.label}
              {active && (isAll
                ? <span className="absolute inset-x-2.5 bottom-0 h-[2.5px] rounded-full bg-primary" />
                : <span className="absolute inset-x-2.5 bottom-0 h-[2.5px] rounded-full" style={{ backgroundColor: (g as { color: string }).color }} />)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact desktop-only toggle between the horizontal Tab view and the Left Rail.
function ViewToggle({ view, setView }: { view: 'tabs' | 'rail'; setView: (v: 'tabs' | 'rail') => void }) {
  return (
    <div className="hidden shrink-0 items-center rounded-lg border bg-card p-0.5 md:inline-flex">
      <button onClick={() => setView('tabs')} aria-label="Tab view" aria-pressed={view === 'tabs'}
        className={`rounded-md p-1.5 transition ${view === 'tabs' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        <Rows3 className="size-4" />
      </button>
      <button onClick={() => setView('rail')} aria-label="Sidebar view" aria-pressed={view === 'rail'}
        className={`rounded-md p-1.5 transition ${view === 'rail' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        <PanelLeft className="size-4" />
      </button>
    </div>
  );
}

// Tab view — mix of B (count pill + colour bar) and C (tinted chip). One line,
// never wraps, scrolls sideways on phones.
function TabNav({ cat, setCat }: { cat: string; setCat: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {NAV_ITEMS.map((g) => {
        const active = cat === g.label;
        const c = g.color;
        return (
          <button
            key={g.label}
            onClick={() => setCat(g.label)}
            style={active && c ? ({ backgroundColor: `${c}14` } as CSSProperties) : undefined}
            className={`relative flex-none inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
              active ? `text-foreground ${!c ? 'bg-primary/10' : ''}` : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {g.title}
            <span
              style={active && c ? ({ backgroundColor: c } as CSSProperties) : undefined}
              className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                active ? (c ? 'text-white' : 'bg-primary text-primary-foreground') : 'bg-muted text-muted-foreground'
              }`}
            >
              {g.n}
            </span>
            {active && (
              <span
                style={c ? ({ backgroundColor: c } as CSSProperties) : undefined}
                className={`absolute inset-x-2 bottom-0.5 h-[2.5px] rounded-full ${c ? '' : 'bg-primary'}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Left Rail view (desktop) — vertical category list with colour dots + counts.
function RailNav({ cat, setCat, className = '' }: { cat: string; setCat: (c: string) => void; className?: string }) {
  return (
    <nav className={`flex-col gap-0.5 ${className}`}>
      {NAV_ITEMS.map((g) => {
        const active = cat === g.label;
        const c = g.color;
        return (
          <button
            key={g.label}
            onClick={() => setCat(g.label)}
            style={active && c ? ({ backgroundColor: `${c}14` } as CSSProperties) : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors ${
              active ? `text-foreground ${!c ? 'bg-primary/10' : ''}` : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <span className={`size-2 shrink-0 rounded-full ${!c ? 'bg-primary' : ''}`} style={c ? ({ backgroundColor: c } as CSSProperties) : undefined} />
            <span className="flex-1 truncate">{g.title}</span>
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{g.n}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function AllToolsDirectory({ full = false, asPage = false }: { full?: boolean; asPage?: boolean } = {}) {
  const [q, setQ] = useState('');
  // One quiet tab rail instead of a wall of jump-chips: 'all' = the capped
  // preview; picking a category swaps the grid IN PLACE to that one group,
  // fully expanded. One focused view at a time — nothing to scroll past.
  const [cat, setCat] = useState<string>('all');
  // Tab vs Left-Rail view for the category nav (home preview only, desktop toggle).
  const [view, setView] = useState<'tabs' | 'rail'>('tabs');
  useEffect(() => {
    try { const v = localStorage.getItem('dd-tools-view'); if (v === 'rail' || v === 'tabs') setView(v); } catch { /* ignore */ }
  }, []);
  const changeView = (v: 'tabs' | 'rail') => { setView(v); try { localStorage.setItem('dd-tools-view', v); } catch { /* ignore */ } };
  const query = q.trim().toLowerCase();
  const matches = (t: CatTool) =>
    !query || t.name.toLowerCase().includes(query) || (META[t.name]?.desc?.toLowerCase().includes(query) ?? false);
  const empty = catalog.every((g) => !g.tools.some(matches));
  const showAll = full || query.length > 0;
  const activeGroups = query || full || cat === 'all' ? catalog : catalog.filter((g) => g.label === cat);
  const expanded = !full && !query && cat !== 'all'; // a chosen category shows ALL its tools

  const Heading = asPage ? 'h1' : 'h2';
  const showRail = !full && !query && !USE_LEGACY_NAV && view === 'rail';

  return (
    <section id="tools" className="scroll-mt-20 bg-muted/20">
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-9 sm:px-6">
        {/* Heading. The live filter input renders ONLY on /tools (65+ tools need
            narrowing there); on home it duplicated the header's ⌘K search that
            sits inches above — one search box per viewport. */}
        <div className="mb-7 flex items-center justify-between gap-3">
          <div>
            <Heading className="text-2xl font-bold tracking-tight">All tools</Heading>
            <p className="mt-1 text-sm text-muted-foreground">
              {full ? 'Every DiemDesk tool — most run right in your browser, nothing uploaded.' : 'Pick a tool — most run right in your browser, nothing uploaded.'}
            </p>
          </div>
          {full && (
            <div className="relative w-40 shrink-0 sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter tools…"
                aria-label="Filter tools"
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          )}
        </div>

        {/* Category nav — Tab view (count-pill + colour) or a Left Rail, switchable
            via the compact desktop toggle. Mobile always uses tabs (single line,
            never wraps). Set USE_LEGACY_NAV = true to restore the old plain rail. */}
        {!full && !query && (USE_LEGACY_NAV ? (
          <LegacyTabRail cat={cat} setCat={setCat} />
        ) : (
          <>
            <div className="mb-3 hidden justify-end md:flex">
              <ViewToggle view={view} setView={changeView} />
            </div>
            <div className={`sticky top-14 z-20 -mx-4 mb-7 border-b bg-background/90 px-4 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6 ${view === 'rail' ? 'md:hidden' : ''}`}>
              <TabNav cat={cat} setCat={setCat} />
            </div>
          </>
        ))}

        {/* Grouped tile grids (filtered live). Rail view adds a left category
            sidebar on desktop; the tile grids themselves are unchanged. */}
        <div className={showRail ? 'md:grid md:grid-cols-[200px_1fr] md:gap-7' : ''}>
          {showRail && <RailNav cat={cat} setCat={setCat} className="sticky top-16 hidden self-start md:flex" />}
          <div className="space-y-8">
          {activeGroups.map((g) => {
            const tools = g.tools.filter(matches);
            if (tools.length === 0) return null;
            // The AI family renders as its own violet block on the home preview;
            // on its own tab the block appears with the family's non-suite tools
            // (OCR, Clean scanned) below it — never duplicated as flat tiles.
            if (!showAll && g.label === 'AI & scan') {
              const extras = tools.filter((t) => !['Chat with PDF', 'Summarize', 'Translate', 'Question generator'].includes(t.name));
              return (
                <div key={g.label} id={groupId(g.label)} className="scroll-mt-24 space-y-4">
                  <AiSuiteBlock id={`${groupId(g.label)}-suite`} />
                  {expanded && extras.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                      {extras.map((t) => <Tile key={t.name} t={t} groupColor={g.color} />)}
                    </div>
                  )}
                </div>
              );
            }
            const shown = showAll || expanded ? tools : tools.slice(0, HOME_LIMIT);
            const hidden = tools.length - shown.length;
            return (
              <div key={g.label} id={groupId(g.label)} className="scroll-mt-24">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} /> {g.label}
                    <span className="font-medium normal-case tracking-normal text-muted-foreground/60">· {tools.length}</span>
                  </p>
                  {hidden > 0 && (
                    <Link href={`/tools#${groupId(g.label)}`} className="shrink-0 text-xs font-semibold text-primary hover:underline">See all {tools.length} &rarr;</Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {shown.map((t) => <Tile key={t.name} t={t} groupColor={g.color} />)}
                  {hidden > 0 && (
                    <button onClick={() => setCat(g.label)}
                      className="flex min-h-[96px] items-center justify-center gap-1.5 rounded-2xl border border-dashed bg-card/50 p-3.5 text-sm font-semibold text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary">
                      + {hidden} more <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {empty && (
            <p className="py-10 text-center text-sm text-muted-foreground">No tools match &ldquo;{q}&rdquo;.</p>
          )}
          </div>
        </div>

        {/* Browse-all — only on the home preview (not on /tools, not while searching) */}
        {!full && !query && (
          <div className="mt-9 text-center">
            <Link href="/tools" className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-2.5 text-sm font-semibold shadow-soft transition hover:-translate-y-0.5 hover:border-primary/50">
              Browse all {TOTAL_TOOLS} tools &rarr;
            </Link>
          </div>
        )}

        {/* Legend — "where each tool runs" (single subtle divider, no boxed band) */}
        <div className="mt-10 border-t border-border/60 pt-6">
          <p className="mb-4 text-center text-xs text-muted-foreground">Where each tool runs — your files stay on your device for everything that can run there.</p>
          <div className="mx-auto grid w-fit grid-cols-[auto_auto] justify-items-start gap-x-8 gap-y-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-center sm:gap-x-5 sm:gap-y-2">
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
      </div>
    </section>
  );
}
