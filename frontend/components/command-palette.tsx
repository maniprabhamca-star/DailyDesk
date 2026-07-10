'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, CornerDownLeft, Sun, Moon, LayoutGrid, Tag, Wand2, ShieldCheck, Sparkles } from 'lucide-react';
import { catalog, type CatTool } from '@/components/app/catalog';
import { getRecent, pushRecent } from '@/lib/recent';
import { useIsOwner } from '@/lib/plan';
import { cn } from '@/lib/utils';

// The premium tier (owner-only until Pro launches): the deep editors, OCR and the
// AI tools. In the palette these wear a "Pro" badge; a free user who picks one is
// taken to pricing rather than a dead end, while the owner can open them to build.
// Everything else in the catalog is free at launch. Keep in sync with the
// pro-launch checklist.
const PRO_TOOLS = new Set(['Edit PDF', 'Annotate', 'Redact PDF', 'OCR', 'Chat with PDF', 'Summarize', 'Translate']);

type Tool = CatTool & { color: string; group: string };
type Action = { id: string; label: string; icon: typeof Sun; run: () => void };
type Row =
  | { type: 'header'; label: string; note?: string }
  | { type: 'tool'; tool: Tool; disabled: boolean }
  | { type: 'action'; action: Action }
  | { type: 'workflow'; label: string; sub: string };

const WORKFLOWS = [{ label: 'Merge → Compress → Sign', sub: 'Chain tools, no re-upload' }];

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isOwner = useIsOwner();
  const isProTool = useCallback((t: Tool) => PRO_TOOLS.has(t.name), []);
  // Selectable? Pro tools always are (they route to pricing/upgrade or, for the
  // owner, open). Free tools are selectable only when live (have an href, not soon).
  const toolDisabled = useCallback((t: Tool) => (isProTool(t) ? false : (!t.href || !!t.soon)), [isProTool]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dd-command-open', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('dd-command-open', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);

  // Every tool, flattened, carrying its group colour. Live = has an href.
  const tools = useMemo<Tool[]>(() => catalog.flatMap((g) => g.tools.map((t) => ({ ...t, color: g.color, group: g.label }))), []);

  const recent = useMemo<Tool[]>(() => {
    if (!open) return [];
    return getRecent().map((h) => tools.find((t) => t.href === h)).filter((t): t is Tool => !!t).slice(0, 4);
  }, [open, tools]);

  const isDark = theme === 'dark';
  const actions = useMemo<Action[]>(() => [
    { id: 'theme', label: isDark ? 'Switch to light mode' : 'Switch to dark mode', icon: isDark ? Sun : Moon, run: () => setTheme(isDark ? 'light' : 'dark') },
    { id: 'alltools', label: 'Browse all tools', icon: LayoutGrid, run: () => router.push('/#tools') },
    { id: 'pricing', label: 'See pricing', icon: Tag, run: () => router.push('/pricing') },
    { id: 'privacy', label: 'How your privacy works', icon: ShieldCheck, run: () => router.push('/security') },
  ], [isDark, setTheme, router]);

  // Build the visible rows (with section headers) and the flat list of selectable rows.
  const { rows, selectable } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Row[] = [];
    const matchTool = (t: Tool) => !q || t.name.toLowerCase().includes(q) || t.group.toLowerCase().includes(q);
    const matchAction = (a: Action) => !q || a.label.toLowerCase().includes(q);

    if (!q) {
      if (recent.length) { rows.push({ type: 'header', label: 'Recent' }); recent.forEach((t) => rows.push({ type: 'tool', tool: t, disabled: toolDisabled(t)})); }
      rows.push({ type: 'header', label: 'Workflows', note: '· one click, no re-upload' });
      WORKFLOWS.forEach((w) => rows.push({ type: 'workflow', label: w.label, sub: w.sub }));
      rows.push({ type: 'header', label: 'Actions' });
      actions.forEach((a) => rows.push({ type: 'action', action: a }));
      rows.push({ type: 'header', label: 'All tools' });
      tools.forEach((t) => rows.push({ type: 'tool', tool: t, disabled: toolDisabled(t)}));
    } else {
      const mt = tools.filter(matchTool);
      const ma = actions.filter(matchAction);
      if (mt.length) { rows.push({ type: 'header', label: 'Tools' }); mt.forEach((t) => rows.push({ type: 'tool', tool: t, disabled: toolDisabled(t)})); }
      if (ma.length) { rows.push({ type: 'header', label: 'Actions' }); ma.forEach((a) => rows.push({ type: 'action', action: a })); }
    }

    const selectable = rows.map((_, i) => i).filter((i) => {
      const r = rows[i];
      return (r.type === 'tool' && !r.disabled) || r.type === 'action';
    });
    return { rows, selectable };
  }, [query, recent, actions, tools, toolDisabled]);

  const activate = useCallback((rowIndex: number) => {
    const r = rows[rowIndex];
    if (!r) return;
    if (r.type === 'tool') {
      const t = r.tool;
      if (isProTool(t)) {
        // Pro tool: the owner opens it (to build/test); everyone else lands on
        // pricing rather than a dead end.
        setOpen(false);
        if (isOwner && t.href) { pushRecent(t.href); router.push(t.href); } else router.push('/pricing');
      } else if (t.href) { pushRecent(t.href); setOpen(false); router.push(t.href); }
    } else if (r.type === 'action') { setOpen(false); r.action.run(); }
  }, [rows, router, isProTool, isOwner]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, selectable.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (selectable[active] != null) activate(selectable[active]); }
  }

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const activeRowIndex = selectable[active];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-[16%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-lift focus:outline-none data-[state=open]:animate-dialog-in" aria-label="Search tools and actions">
          <Dialog.Title className="sr-only">Search tools and actions</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onInputKey}
              placeholder="Search tools & actions…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>

          <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-2">
            {selectable.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for “{query}”.</p>
            )}
            {rows.map((r, i) => {
              if (r.type === 'header') {
                return (
                  <p key={`h${i}`} className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {r.label}{r.note && <span className="ml-1.5 font-medium normal-case tracking-normal text-primary">{r.note}</span>}
                  </p>
                );
              }
              if (r.type === 'workflow') {
                return (
                  <div key={`w${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-60">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300"><Wand2 className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.label}</span><span className="block truncate text-xs text-muted-foreground">{r.sub}</span></span>
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">soon</span>
                  </div>
                );
              }
              const isActive = i === activeRowIndex;
              if (r.type === 'action') {
                const Icon = r.action.icon;
                return (
                  <button key={r.action.id} data-active={isActive} onMouseEnter={() => setActive(selectable.indexOf(i))} onClick={() => activate(i)}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', isActive && 'bg-accent')}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.action.label}</span>
                    {isActive && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />}
                  </button>
                );
              }
              // tool
              const t = r.tool; const Icon = t.icon;
              return (
                <button key={`${t.name}${i}`} data-active={isActive} disabled={r.disabled}
                  onMouseEnter={() => { if (!r.disabled) setActive(selectable.indexOf(i)); }} onClick={() => activate(i)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', isActive && 'bg-accent', r.disabled && 'cursor-not-allowed opacity-55')}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${t.color}1A`, color: t.color }}><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.group}</span></span>
                  {isProTool(t)
                    ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"><Sparkles className="size-2.5" /> Pro</span>
                    : r.disabled ? <span className="shrink-0 text-[10px] font-medium text-muted-foreground">soon</span>
                    : isActive && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span><b className="font-medium">↑↓</b> navigate</span><span><b className="font-medium">↵</b> open</span><span><b className="font-medium">esc</b> close</span>
            <span className="ml-auto flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-600" /> Runs in your browser</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
