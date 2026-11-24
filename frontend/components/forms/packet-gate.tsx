'use client';

import Link from 'next/link';
import { EyeOff, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { isAtLeast, usePlan, useIsOwner } from '@/lib/plan';
import { WAITLIST_MODE } from '@/lib/flags';
import { PacketRunner } from '@/components/forms/packet-runner';

// Who may run a packet.
//
// The order of these checks matters. `useAuth` starts with `loading: true` and
// no user, so deciding on the first render would show a paying subscriber an
// upgrade wall for a moment before their session resolved — which is how a
// paid feature feels broken. Nothing is decided until auth settles.
//
// While WAITLIST_MODE is on, Pro is not on sale, so nobody can hold the plan
// this needs. The owner still gets the real thing behind a ribbon, which is how
// everything else here is built and tested in production before launch.

export function PacketGate({
  taskSlug,
  taskTitle,
  forms,
}: {
  taskSlug: string;
  taskTitle: string;
  forms: { slug: string; short: string; name: string; role: string }[];
}) {
  const { loading } = useAuth();
  const plan = usePlan();
  const isOwner = useIsOwner();

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center rounded-xl border bg-card py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking your plan…</span>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="mt-8">
        <div className="mb-4 flex w-fit max-w-full items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <EyeOff className="size-4 shrink-0" aria-hidden />
          Hidden from the public until Pro opens — only you can see this.
        </div>
        <PacketRunner taskSlug={taskSlug} forms={forms} />
      </div>
    );
  }

  if (WAITLIST_MODE || !isAtLeast(plan, 'pro')) {
    return (
      <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-bold">The whole set at once is a Pro feature</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {WAITLIST_MODE
            ? 'Pro is not open yet. Every one of these forms is free to fetch and fill one at a time, today, on the page behind this one.'
            : 'Pro fetches all of them in one go and carries the details that repeat from one form to the next. One at a time stays free.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href={`/forms/${taskSlug}`}>Get these forms one at a time</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">{WAITLIST_MODE ? 'Hear when Pro opens' : 'See what Pro adds'}</Link>
          </Button>
        </div>
        <p className="sr-only">{taskTitle}</p>
      </div>
    );
  }

  return <PacketRunner taskSlug={taskSlug} forms={forms} />;
}
