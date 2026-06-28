'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function HeaderUser() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/login">Log in</Link>
      </Button>
    );
  }

  const initial = user.name?.trim()?.[0]?.toUpperCase() || 'U';
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={`${user.name} · ${user.plan}`}
        className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
      >
        {initial}
      </span>
      <Button size="icon" variant="ghost" aria-label="Log out" onClick={logout}>
        <LogOut />
      </Button>
    </div>
  );
}
