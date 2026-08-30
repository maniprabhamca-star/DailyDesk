'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LayoutGrid, Plus, History, User, X, Pin, PinOff } from 'lucide-react';
import { catalog } from '@/components/app/catalog';
import { getRecent } from '@/lib/recent';
import { useAuth } from '@/lib/auth';
import { routeForFile } from '@/lib/route-for-file';
import { stashFile } from '@/lib/pending-file';
import { getPinned, togglePin, PINS_CHANGED } from '@/lib/pinned-tools';

// The mobile app bar — option B from docs/designs/mobile-app-bar.html.
//
// Four of the five slots are places you go. The fifth is the thing you came to
// do, and it gets the raised centre position: on a tool page today there is no
// way to start a different job without scrolling back up to the hamburger in
// the far top corner, which is the one spot a thumb cannot reach.
//
// Two details decide whether this feels native or broken, and both are easy to
// miss on a desktop:
//   • env(safe-area-inset-bottom) — without it the bar sits under the iPhone
//     home indicator and the bottom row of taps does nothing.
//   • the page needs matching bottom padding, or the last thing on every page
//     hides behind the bar. That is done once in globals.css, not here.
//
// Phones only. The desktop header already carries all of these, and two
// navigations on screen at once is how an app shell starts looking like a
// website wearing a costume.

const ALL = catalog.flatMap((g) => g.tools.filter((t) => t.href && !t.soon).map((t) => ({ ...t, color: g.color })));

export function MobileAppBar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<typeof ALL>([]);
  const [pinned, setPinned] = useState<typeof ALL>([]);
  // Long-press to pin. A tap opens the tool; holding it for a moment pins it,
  // which is the gesture people already expect from a phone home screen.
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  // Read history after mount — it lives in localStorage, and reading it during
  // render would make the server and client disagree.
  const load = () => {
    const byHref = (h: string) => ALL.find((t) => t.href === h);
    const pins = getPinned().map(byHref).filter(Boolean) as typeof ALL;
    setPinned(pins);
    const pinnedHrefs = new Set(pins.map((t) => t.href));
    // A pinned tool does not need to appear twice.
    setRecent(getRecent().map(byHref).filter((t): t is (typeof ALL)[number] => !!t && !pinnedHrefs.has(t.href)));
  };

  useEffect(() => {
    if (!recentOpen) return;
    load();
    window.addEventListener(PINS_CHANGED, load);
    return () => window.removeEventListener(PINS_CHANGED, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentOpen]);

  // Close the sheet whenever the route changes, including a back gesture.
  useEffect(() => { setRecentOpen(false); }, [pathname]);

  const isHome = pathname === '/';
  const isTools = pathname === '/tools' || pathname.startsWith('/tools/');
  const isYou = pathname.startsWith('/account') || pathname.startsWith('/dashboard') || pathname.startsWith('/login');

  // Picking a file from the bar sends you to the tool that suits it, rather
  // than to a generic uploader that then asks what you wanted.
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    // Hand the file across the navigation. Routing without this opened the tool
    // with an empty picker, so the tap looked like it worked and did nothing.
    const href = routeForFile(f.name);
    // Name the destination, so the status line can say where you are going
    // rather than just spinning.
    const label = ALL.find((t) => t.href === href)?.name || 'the tools';
    stashFile(f, label);
    router.push(href);
  };

  // Long-press handling, shared by the pinned and recent grids.
  const holdHandlers = (href: string) => ({
    onPointerDown: () => {
      heldRef.current = false;
      holdRef.current = setTimeout(() => {
        heldRef.current = true;
        togglePin(href);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
      }, 450);
    },
    onPointerUp: () => { if (holdRef.current) clearTimeout(holdRef.current); },
    onPointerLeave: () => { if (holdRef.current) clearTimeout(holdRef.current); },
    // A long press must not also follow the link.
    onClick: (ev: React.MouseEvent) => { if (heldRef.current) { ev.preventDefault(); heldRef.current = false; } },
    onContextMenu: (ev: React.MouseEvent) => ev.preventDefault(),
  });

  const tabClass = (on: boolean) =>
    `flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors ${
      on ? 'text-primary' : 'text-muted-foreground'
    }`;

  return (
    <>
      {recentOpen && (
        <>
          <button
            aria-label="Close recent tools"
            onClick={() => setRecentOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-foreground/25 sm:hidden"
          />
          <div
            className="fixed inset-x-0 z-50 rounded-t-2xl border-t bg-popover px-4 pt-3 shadow-lift sm:hidden"
            style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your tools</p>
              <button onClick={() => setRecentOpen(false)} aria-label="Close" className="rounded p-1 text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>

            {/* Pinned first. Recents answer "take me back to what I was just
                doing"; pins answer "these are the reason I come here" — and
                without them the weekly job gets buried under yesterday's. */}
            {pinned.length > 0 && (
              <>
                <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Pin className="size-3" /> Pinned
                </p>
                <div className="mb-4 grid grid-cols-4 gap-3">
                  {pinned.map((t) => {
                    const Icon = t.icon;
                    return (
                      <Link key={t.href} href={t.href!} {...holdHandlers(t.href!)} className="relative flex select-none flex-col items-center gap-1.5">
                        <span
                          className="flex size-11 items-center justify-center rounded-xl ring-2 ring-primary/40"
                          style={{ backgroundColor: `${t.color}1A`, color: t.color }}
                        >
                          <Icon className="size-5" strokeWidth={2.25} />
                        </span>
                        <span className="text-center text-[10px] leading-tight text-foreground">{t.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            {recent.length > 0 && (
              <>
                {pinned.length > 0 && (
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
                )}
                <div className="grid grid-cols-4 gap-3">
                  {recent.slice(0, 8 - pinned.length > 0 ? 8 - pinned.length : 4).map((t) => {
                    const Icon = t.icon;
                    return (
                      <Link key={t.href} href={t.href!} {...holdHandlers(t.href!)} className="flex select-none flex-col items-center gap-1.5">
                        <span
                          className="flex size-11 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${t.color}1A`, color: t.color }}
                        >
                          <Icon className="size-5" strokeWidth={2.25} />
                        </span>
                        <span className="text-center text-[10px] leading-tight text-muted-foreground">{t.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            {pinned.length === 0 && recent.length === 0 && (
              <p className="pb-2 text-sm text-muted-foreground">
                Nothing yet. Open a tool and it will show up here so you can get back to it in one tap.
              </p>
            )}

            <p className="flex items-center gap-1.5 py-3 text-[11px] text-muted-foreground">
              {pinned.length > 0 ? <PinOff className="size-3 shrink-0" /> : <Pin className="size-3 shrink-0" />}
              {pinned.length > 0
                ? 'Press and hold to pin or unpin.'
                : 'Press and hold a tool to pin it here.'}
            </p>
          </div>
        </>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t bg-background/95 px-1 pt-1.5 backdrop-blur-xl sm:hidden"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Link href="/" className={tabClass(isHome)} aria-current={isHome ? 'page' : undefined}>
          <Home className="size-[21px]" strokeWidth={isHome ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <Link href="/tools" className={tabClass(isTools)} aria-current={isTools ? 'page' : undefined}>
          <LayoutGrid className="size-[21px]" strokeWidth={isTools ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Tools</span>
        </Link>

        {/* The verb, not a destination. */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Open a file"
            className="-mt-6 flex size-[46px] items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
          <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">Open file</span>
          <input
            ref={fileRef}
            type="file"
            onChange={onPick}
            aria-label="Choose a file to work on"
            className="dd-file-input"
          />
        </div>

        <button onClick={() => setRecentOpen((o) => !o)} className={tabClass(recentOpen)} aria-expanded={recentOpen}>
          <History className="size-[21px]" strokeWidth={recentOpen ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Recent</span>
        </button>

        <Link href={user ? '/account' : '/login'} className={tabClass(isYou)} aria-current={isYou ? 'page' : undefined}>
          <User className="size-[21px]" strokeWidth={isYou ? 2.5 : 2} />
          <span className="text-[10px] font-medium">{user ? 'You' : 'Sign in'}</span>
        </Link>
      </nav>
    </>
  );
}
