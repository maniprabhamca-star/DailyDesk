'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, LogIn, ArrowRight, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';

// The signed-out confirmation. Previously logging out silently dumped you on the
// LOGIN page with no message — you couldn't tell whether it had worked, or whether
// you'd been kicked out. Saying plainly "you're signed out" and offering the way
// back in is the whole job of this page.
export function LoggedOut() {
  // Clear the flag that tells the /account guard not to bounce a sign-out to /login.
  useEffect(() => {
    try { sessionStorage.removeItem('dd_signed_out'); } catch { /* ignore */ }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" />
        </span>

        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">You’re signed out</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your session on this device has ended and your saved sign-in was removed from this browser.
        </p>

        <div className="mt-7 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login"><LogIn className="size-4" /> Log back in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Keep using the free tools <ArrowRight className="size-4" /></Link>
          </Button>
        </div>

        {/* The reassuring bit that's actually true here — no account needed for most of the site. */}
        <p className="mt-8 flex max-w-md items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 text-left text-[12.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <b className="text-foreground">You don’t need an account for most of DiemDesk.</b> Every in-browser tool —
            compress, merge, convert, sign — works signed out, with no limits. Your files never left this device anyway.
          </span>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
