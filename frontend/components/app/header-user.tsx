'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function HeaderUser() {
  const { user, logout, loading } = useAuth();

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
  const isPro = user.plan === 'pro';
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={`${user.name} · ${user.plan}`}
        className="relative flex size-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
      >
        {initial}
        {isPro && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background bg-amber-400 px-1 text-[8px] font-bold uppercase leading-tight text-amber-950">
            Pro
          </span>
        )}
      </span>
      <Button size="icon" variant="ghost" aria-label="Log out" onClick={logout}>
        <LogOut />
      </Button>
    </div>
  );
}
