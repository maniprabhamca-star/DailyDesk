'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown, Search, Menu, X, ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '@/components/app/brand-mark';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { catalog, isNewTool, NEW_CHIP_SM } from '@/components/app/catalog';
import { HeaderSearch } from '@/components/app/header-search';
import { HeaderUser } from '@/components/app/header-user';
import { useAuth } from '@/lib/auth';
import { useIsOwner } from '@/lib/plan';

function openCommand() {
  window.dispatchEvent(new Event('dd-command-open'));
}


// How many tools a visitor can actually use today. Derived, never typed — a
// hand-written count drifts the moment a tool ships (that was REG-111).
const liveToolCount = catalog.reduce((n, g) => n + g.tools.filter((t) => t.href && !t.soon).length, 0);

/** The whole catalogue, balanced across columns.
 *
 *  CSS multi-column rather than a JS-packed grid: it balances the heights
 *  itself and reflows at each breakpoint from ONE DOM tree, where packed
 *  columns are fixed at build time and would need a separate copy of the whole
 *  menu per breakpoint. The old warning about `columns` spilling sideways
 *  applies to `column-width` (which picks its own count); a fixed `column-count`
 *  plus break-inside:avoid grows downward only. */
function MenuGrid({ onPick }: { onPick: () => void }) {
  // Same rule as the home grid: the owner can open a gated tool from the menu.
  const owner = useIsOwner();
  // The rows are deliberately tight. The menu's point is that nothing scrolls,
  // and at 1280 the catalogue only just fits — five tools took it 14px over.
  //
  // Adding a sixth column does NOT help, which is worth recording so nobody
  // tries it again: the tallest group is a single break-inside-avoid block, so
  // it sets a floor no amount of columns lowers, and narrower columns truncated
  // 25 tool names while still overflowing. Height per row is the axis that
  // works. When this next runs out, split the largest group rather than
  // shaving further — the rows have no room left to give.
  return (
    <div className="columns-3 gap-x-6 lg:columns-5 xl:columns-6 2xl:columns-7">
      {catalog.map((g) => (
        <div key={g.label} className="mb-2.5 break-inside-avoid">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
          <div className="space-y-px">
            {g.tools.map((t) => {
              const Icon = t.icon;
              const row = (
                <div className="flex items-center gap-2 rounded-md px-2 py-[2px] hover:bg-accent">
                  <Icon className="size-4 shrink-0" style={{ color: g.color }} strokeWidth={2.25} />
                  <span className="truncate text-[13px] font-medium">{t.name}</span>
                  {isNewTool(t) && <span className={NEW_CHIP_SM}>New</span>}
                  {t.soon && <span className={`shrink-0 text-[10px] text-muted-foreground ${isNewTool(t) ? '' : 'ml-auto'}`}>soon</span>}
                </div>
              );
              // "soon" tools (incl. owner-only-until-Pro: Annotate/Redact/Edit)
              // show but are NOT clickable for the public — only the owner reaches
              // them by URL, where the gate serves the real tool.
              return t.href && (!t.soon || owner)
                ? <Link key={t.name} href={t.href} onClick={onPick}>{row}</Link>
                : <div key={t.name} className="cursor-default opacity-70">{row}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
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
  // The panel is no longer a child of the button’s wrapper — it spans the header —
  // so an outside-click check against the button alone would close it the instant
  // you clicked a tool inside it.
  const panelRef = useRef<HTMLDivElement>(null);
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
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inside = toolsRef.current?.contains(t) || panelRef.current?.contains(t);
      if (!inside) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // The mobile nav needs the same courtesy. It didn't have it: Escape closed the
  // mega-menu and left the mobile sheet open, so a keyboard user had to find the
  // X. Caught by XC-007.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-border bg-background/85 shadow-[0_1px_8px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-5 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="size-9" animate />
          {/* The wordmark goes below 400px. Signed IN, the right-hand cluster
              gains an avatar the signed-out header doesn't have, and at 375 that
              pushed the row 29px past the viewport — every page, but only for
              people with an account, which is why nothing caught it: the E2E
              suite browses signed out. The mark alone still reads as us. */}
          <span className="hidden text-xl font-semibold tracking-tight min-[400px]:inline">DiemDesk</span>
        </Link>
        <div ref={toolsRef} className="hidden sm:block">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="dd-tools-menu"
            className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground"
          >
            Tools <ChevronDown className={`size-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <Link href="/pricing" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Pricing</Link>
        <Link href="/feedback" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">Feedback</Link>

        {/* Center command search — the primary way to navigate (search-first workspace).
            A real input: results drop down inline as you type (HeaderSearch); ⌘K still
            opens the full palette. On home it fades in on scroll (see heroSearchRef);
            elsewhere it's always visible. */}
        <div className="flex min-w-0 flex-1 justify-center px-2 sm:px-4">
          <HeaderSearch visible={showHeaderSearch} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
      {/* Tools mega-menu — FULL WIDTH, deliberately.
          It used to be a 920px dropdown anchored to the button, which meant 67
          tools in four narrow columns with an inner scrollbar: you had to scroll
          a menu to find out what the product does. Spanning the header's whole
          width buys enough columns to show the entire catalogue at once, which
          is the only version of this that answers "what can I do here?".
          The inner container matches the header's own (max-w-[1400px], same
          padding), so the first column lines up under the logo instead of
          starting hard against the viewport edge. */}
      {menuOpen && (
        <div
          id="dd-tools-menu"
          ref={panelRef}
          className="absolute inset-x-0 top-full z-40 hidden max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain border-b-2 border-border bg-popover shadow-lift sm:block"
        >
          <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-10">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Every tool — {liveToolCount} ready now
              </p>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close the tools menu"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <MenuGrid onPick={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

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
