'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Crown, User as UserIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/plan';
import { Button } from '@/components/ui/button';

export function HeaderUser() {
  const { user, logout, loading } = useAuth();
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu on any outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Avoid a flash of the logged-out buttons before the session restores.
  if (loading) return null;

  if (!user) {
    return (
      <>
        <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/register">Get started</Link>
        </Button>
      </>
    );
  }

  const initial = user.name?.trim()?.[0]?.toUpperCase() || 'U';
  const isPro = plan === 'pro';

  const Avatar = ({ size = 'size-9', text = 'text-sm' }: { size?: string; text?: string }) => (
    <span className={`relative flex ${size} items-center justify-center rounded-full bg-primary ${text} font-medium text-primary-foreground`}>
      {initial}
      {isPro && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background bg-amber-400 px-1 text-[8px] font-bold uppercase leading-tight text-amber-950">
          Pro
        </span>
      )}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span title={`${user.name} · ${isPro ? 'pro' : 'free'}`}><Avatar /></span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border bg-popover p-1.5 shadow-lift">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="px-3 pb-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isPro ? 'bg-amber-400/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
              {isPro ? <><Crown className="size-3" /> Pro plan</> : 'Free plan'}
            </span>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
            <UserIcon className="size-4 text-muted-foreground" /> Account
          </Link>
          {!isPro && (
            <Link href="/pricing" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent">
              <Crown className="size-4" /> Upgrade to Pro
            </Link>
          )}
          <button onClick={() => { setOpen(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent">
            <LogOut className="size-4 text-muted-foreground" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
