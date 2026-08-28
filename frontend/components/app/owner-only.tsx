'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useIsOwner } from '@/lib/plan';

/**
 * Wraps a page that only the owner may see. Anyone else is sent home.
 *
 * The subtlety worth getting right: `useAuth` starts with `loading: true` and no
 * user, so checking ownership on the first render would bounce the owner off
 * their own page a moment before their session resolved. Nothing renders and
 * nothing redirects until auth has actually settled.
 *
 * This is a courtesy gate, not a secret. The page is marked noindex and kept out
 * of the sitemap, and it contains no credentials — anything that genuinely must
 * not leak belongs on the server, not behind a client-side check.
 */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const isOwner = useIsOwner();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isOwner) router.replace('/');
  }, [loading, isOwner, router]);

  if (loading || !isOwner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking access…</span>
      </div>
    );
  }

  return <>{children}</>;
}
