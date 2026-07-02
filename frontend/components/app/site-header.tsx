'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutGrid, ChevronDown, Search, Menu, X, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { catalog } from '@/components/app/catalog';
import { HeaderSearch } from '@/components/app/header-search';

function openCommand() {
  window.dispatchEvent(new Event('dd-command-open'));
}

/**
 * Shared site header (home + tool pages + pricing + legal pages).
 * - `heroSearchRef`: pass the home hero-search element to hand off the search on scroll
 *   (search stays hidden until the hero search scrolls behind the header). When omitted,
 *   the header search is always visible (every non-home page).
 */
export function SiteHeader({ heroSearchRef }: { heroSearchRef?: React.RefObject<HTMLElement | null> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState(!heroSearchRef);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Home only: reveal the header search once the hero search scrolls up behind the sticky
  // header, so there's never two searches on screen. The page scroller is `window`, which
  // only holds because the root wrapper uses `overflow-x-clip` (overflow-x-hidden would
  // force overflow-y:auto and hijack the scroller — that was the old "search never appears"
  // bug). `capture: true` catches scroll from any descendant scroll container too.
  useEffect(() => {
    if (!heroSearchRef) return; // non-home pages: search is always visible
    const onScroll = () => {
      const el = heroSearchRef.current;
      setShowHeaderSearch(!!el && el.getBoundingClientRect().bottom < 60);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll, { capture: true }); window.removeEventListener('resize', onScroll); };
  }, [heroSearchRef]);

  // Close the Tools mega-menu on any outside click or Escape. (A fixed backdrop doesn't work
  // here: the header's backdrop-blur creates a containing block, so a position:fixed overlay
  // is trapped inside the header instead of the viewport.)
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><LayoutGrid className="size-[18px]" /></span>
          <span className="text-lg font-semibold tracking-tight">DailyDesk</span>
        </Link>
        <div ref={toolsRef} className="relative hidden sm:block">
          <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground">
            Tools <ChevronDown className={`size-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-8 z-40 w-[720px] columns-3 gap-x-5 rounded-xl border bg-popover p-5 shadow-lift">
              {catalog.map((g) => (
                <div key={g.label} className="mb-4 break-inside-avoid">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                  <div className="space-y-0.5">
                    {g.tools.map((t) => {
                      const Icon = t.icon;
                      const row = (
                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                          <Icon className="size-4 shrink-0" style={{ color: g.color }} strokeWidth={2.25} />
                          <span className="truncate text-[13px] font-medium">{t.name}</span>
                          {t.soon && <span className="ml-auto text-[10px] text-muted-foreground">soon</span>}
                        </div>
                      );
                      return t.href ? <Link key={t.name} href={t.href} onClick={() => setMenuOpen(false)}>{row}</Link> : <div key={t.name} className="cursor-default opacity-70">{row}</div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Link href="/pricing" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Pricing</Link>

        {/* Center command search — the primary way to navigate (search-first workspace).
            A real input: results drop down inline as you type (HeaderSearch); ⌘K still
            opens the full palette. On home it fades in on scroll (see heroSearchRef);
            elsewhere it's always visible. */}
        <div className="flex flex-1 justify-center px-2 sm:px-4">
          <HeaderSearch visible={showHeaderSearch} />
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile: a search icon that opens the ⌘K palette (the pill is desktop-only). */}
          <button onClick={openCommand} aria-label="Search" className="flex size-9 items-center justify-center rounded-lg border text-foreground/80 sm:hidden">
            <Search className="size-5" />
          </button>
          {/* Privacy signal — our identity; something competitors can't honestly claim. */}
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 lg:inline-flex dark:text-emerald-400">
            <ShieldCheck className="size-3.5" /> On your device
          </span>
          <ThemeToggle />
          <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Log in</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/register">Get started</Link></Button>
          <button onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen} className="flex size-9 items-center justify-center rounded-lg border text-foreground/80 sm:hidden">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3">
            {[
              { label: 'All tools', href: '/#tools' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Log in', href: '/login' },
            ].map((l) => (
              <Link key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-accent">{l.label}</Link>
            ))}
            <Button asChild size="sm" className="mt-1.5 w-full"><Link href="/register" onClick={() => setMobileOpen(false)}>Get started</Link></Button>
          </div>
        </div>
      )}
    </header>
  );
}
