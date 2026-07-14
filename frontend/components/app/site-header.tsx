'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown, Search, Menu, X, ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '@/components/app/brand-mark';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { catalog, type CatGroup } from '@/components/app/catalog';
import { HeaderSearch } from '@/components/app/header-search';
import { HeaderUser } from '@/components/app/header-user';
import { useAuth } from '@/lib/auth';

function openCommand() {
  window.dispatchEvent(new Event('dd-command-open'));
}

// Distribute catalog groups into N balanced columns for the Tools mega-menu.
// Using a real grid of pre-filled columns (not CSS `columns`) means the panel
// grows DOWNWARD only — it can never spill into extra columns sideways, which
// was the horizontal-scroll bug. Greedy: each group joins the shortest column,
// so heights stay even and everything fits on one screen without scrolling.
// Recomputed once at module load (catalog is static).
function buildMenuColumns(cols: number): CatGroup[][] {
  const columns: CatGroup[][] = Array.from({ length: cols }, () => []);
  const weight = new Array(cols).fill(0);
  for (const g of catalog) {
    let shortest = 0;
    for (let i = 1; i < cols; i++) if (weight[i] < weight[shortest]) shortest = i;
    columns[shortest].push(g);
    weight[shortest] += g.tools.length + 1.6; // +header row
  }
  return columns;
}
const MENU_COLUMNS = buildMenuColumns(4);

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
  const { user, logout } = useAuth();

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
    <header className="sticky top-0 z-40 border-b-2 border-border bg-background/85 shadow-[0_1px_8px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="size-9" animate />
          <span className="text-xl font-semibold tracking-tight">DiemDesk</span>
        </Link>
        <div ref={toolsRef} className="relative hidden sm:block">
          <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground">
            Tools <ChevronDown className={`size-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-8 z-40 w-[min(920px,calc(100vw-2rem))] max-h-[calc(100vh-5.5rem)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border bg-popover p-4 shadow-lift">
              <div className="grid grid-cols-2 gap-x-5 lg:grid-cols-4">
                {MENU_COLUMNS.map((col, i) => (
                  <div key={i} className="min-w-0">
                    {col.map((g) => (
                      <div key={g.label} className="mb-3">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                        <div className="space-y-px">
                          {g.tools.map((t) => {
                            const Icon = t.icon;
                            const row = (
                              <div className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                                <Icon className="size-4 shrink-0" style={{ color: g.color }} strokeWidth={2.25} />
                                <span className="truncate text-[13px] font-medium">{t.name}</span>
                                {t.soon && <span className="ml-auto text-[10px] text-muted-foreground">soon</span>}
                              </div>
                            );
                            // "soon" tools (incl. owner-only-until-Pro: Annotate/Redact/Edit)
                            // show but are NOT clickable for the public — only the owner reaches
                            // them by URL, where the gate serves the real tool.
                            return t.href && !t.soon ? <Link key={t.name} href={t.href} onClick={() => setMenuOpen(false)}>{row}</Link> : <div key={t.name} className="cursor-default opacity-70">{row}</div>;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Link href="/pricing" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Pricing</Link>
        <Link href="/feedback" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Feedback</Link>

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
          <HeaderUser />
          <button onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen} className="flex size-9 items-center justify-center rounded-lg border text-foreground/80 sm:hidden">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t sm:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-0.5 px-4 py-3">
            {[
              { label: 'All tools', href: '/#tools' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Feedback', href: '/feedback' },
              ...(user ? [] : [{ label: 'Log in', href: '/login' }]),
            ].map((l) => (
              <Link key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-accent">{l.label}</Link>
            ))}
            {user ? (
              <>
                <div className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">{user.name?.trim()?.[0]?.toUpperCase() || 'U'}</span>
                  <span className="truncate font-medium">{user.name}</span>
                  {user.plan === 'pro' && <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 text-[10px] font-bold uppercase text-white shadow-sm">Pro</span>}
                </div>
                <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => { logout(); setMobileOpen(false); }}>Log out</Button>
              </>
            ) : (
              <Button asChild size="sm" className="mt-1.5 w-full"><Link href="/register" onClick={() => setMobileOpen(false)}>Get started</Link></Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
