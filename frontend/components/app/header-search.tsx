'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, History, ArrowRight } from 'lucide-react';
import { catalog, type CatTool } from '@/components/app/catalog';
import { getRecent, pushRecent } from '@/lib/recent';
import { cn } from '@/lib/utils';

// Premium inline search: type in the header pill and results drop down right
// underneath (no dialog hop). ↑↓ + Enter to open a tool, Esc to close; ⌘K still
// opens the full palette (actions, workflows). Everything is local — the tool
// list is in the bundle, so results are instant and nothing is sent anywhere.

type Tool = CatTool & { color: string; group: string };

const ALL: Tool[] = catalog.flatMap((g) => g.tools.map((t) => ({ ...t, color: g.color, group: g.label })));
const MAX_RESULTS = 7;

function openCommand() {
  window.dispatchEvent(new Event('dd-command-open'));
}

export function HeaderSearch({ visible }: { visible: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<Tool[]>([]);

  // Recent tools (local-only) — shown when the box is focused with no query yet.
  useEffect(() => {
    if (!open) return;
    setRecent(getRecent().map((h) => ALL.find((t) => t.href === h)).filter((t): t is Tool => !!t).slice(0, 3));
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query: recents first, then the live tools as a starting point.
      const rest = ALL.filter((t) => t.href && !recent.some((r) => r.href === t.href));
      return { label: recent.length ? 'Recent & popular' : 'Popular tools', items: [...recent, ...rest].slice(0, MAX_RESULTS) };
    }
    const match = (t: Tool) => t.name.toLowerCase().includes(q) || t.group.toLowerCase().includes(q);
    // Live tools first, "soon" ones after (visible but not navigable).
    const live = ALL.filter((t) => t.href && match(t));
    const soon = ALL.filter((t) => !t.href && match(t));
    return { label: 'Tools', items: [...live, ...soon].slice(0, MAX_RESULTS) };
  }, [query, recent]);

  const navigable = results.items.filter((t) => !!t.href);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function go(tool: Tool) {
    if (!tool.href) return;
    pushRecent(tool.href);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    router.push(tool.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, navigable.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const t = navigable[active]; if (t) go(t); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(false); openCommand(); }
  }

  return (
    <div ref={rootRef} className={cn('relative hidden w-full max-w-md sm:block', visible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      {/* The pill (now a real input — results appear right below as you type) */}
      <div className={cn(
        'flex items-center gap-2.5 rounded-full border border-primary/40 bg-card px-4 py-2 text-sm shadow-sm ring-[3px] ring-primary/[0.08] transition',
        open ? 'border-primary/70 ring-primary/20' : 'hover:border-primary/60 hover:ring-primary/15',
      )}>
        <Search className="size-4 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => { setOpen(true); setActive(0); }}
          onKeyDown={onKey}
          placeholder="Search or jump to any tool…"
          aria-label="Search or jump to any tool"
          aria-expanded={open}
          className="w-full bg-transparent outline-none placeholder:text-foreground/60"
        />
        <button onClick={openCommand} aria-label="Open command palette" className="ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent">⌘K</button>
      </div>

      {/* Results dropdown — animate-fade-in (plain rise), NOT dialog-in: that
          keyframe carries a translateX(-50%) for centered dialogs and would
          slide this in from the left. */}
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border bg-popover shadow-lift animate-fade-in">
          <p className="px-4 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {results.label}
            {!query && recent.length > 0 && <History className="ml-1.5 inline size-3 -translate-y-px" />}
          </p>
          <div className="p-1.5 pt-0.5">
            {results.items.length === 0 && (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">No tools match “{query}”.</p>
            )}
            {results.items.map((t) => {
              const Icon = t.icon;
              const idx = navigable.indexOf(t);
              const isActive = idx >= 0 && idx === active;
              const soon = !t.href;
              return (
                <button
                  key={`${t.group}-${t.name}`}
                  disabled={soon}
                  onMouseEnter={() => { if (idx >= 0) setActive(idx); }}
                  onClick={() => go(t)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                    isActive && 'bg-accent',
                    soon && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${t.color}1A`, color: t.color }}>
                    <Icon className="size-4" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t.group}</span>
                  </span>
                  {soon ? <span className="shrink-0 text-[10px] font-medium text-muted-foreground">soon</span>
                    : isActive && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
          {/* Clearly a button (was reading as plain text): primary color, hover fill,
              arrow affordance. */}
          <button
            onClick={() => { setOpen(false); openCommand(); }}
            className="group flex w-full items-center gap-2.5 border-t bg-muted/40 px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.07]"
          >
            <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">⌘K</kbd>
            Open the full palette
            <span className="font-normal text-muted-foreground">· actions &amp; workflows</span>
            <ArrowRight className="ml-auto size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}
