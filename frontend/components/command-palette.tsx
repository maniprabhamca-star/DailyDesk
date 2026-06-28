'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, CornerDownLeft } from 'lucide-react';
import { allTools } from '@/components/app/tools-config';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Open via Ctrl/Cmd+K or a window event (the hero search button dispatches it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dd-command-open', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dd-command-open', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTools;
    return allTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [query]);

  const go = useCallback(
    (i: number) => {
      const t = results[i];
      if (!t || !t.available) return;
      setOpen(false);
      router.push(t.href);
    },
    [results, router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-lift focus:outline-none data-[state=open]:animate-fade-in"
          aria-label="Search tools"
        >
          <Dialog.Title className="sr-only">Search tools</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onInputKey}
              placeholder="Search tools, or type what you need…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tools match “{query}”.</p>
            )}
            {results.map((t, i) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(i)}
                  disabled={!t.available}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    active === i ? 'bg-accent' : '',
                    !t.available && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${t.color}1A`, color: t.color }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.description}</span>
                  </span>
                  {t.available ? (
                    active === i && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
