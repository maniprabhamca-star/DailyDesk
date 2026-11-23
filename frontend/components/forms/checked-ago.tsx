'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { CHECKED_ON, CHECKED_ON_LABEL, daysSinceChecked, checkFreshness, checkedAgoPhrase } from '@/lib/us-forms';
import { cn } from '@/lib/utils';

/**
 * "Checked 3 days ago" instead of "checked on November 23, 2026".
 *
 * ── Why this is a client component ──────────────────────────────────────────
 * Every forms page is statically prerendered. A relative phrase computed on the
 * server freezes at build time, so a page built in November would still read
 * "checked 2 days ago" in March. The date has to be turned into a phrase on the
 * device that is reading it.
 *
 * ── Why it renders the absolute date FIRST ──────────────────────────────────
 * The server output, which is what a crawler and a reader with no JavaScript
 * get, is the plain date inside a <time> element. That is always true and never
 * goes stale. Only after hydration does it become the relative phrase, with the
 * exact date kept in the tooltip and in `dateTime`. So we lose nothing to search
 * and gain the thing a human actually wants to know — is this current?
 *
 * It also means no hydration mismatch: the first client render is identical to
 * the server's, and the swap happens in an effect.
 *
 * ── Why a stale state is allowed to look bad ────────────────────────────────
 * These pages argue that stating a verification date beats wearing an "official"
 * badge. That argument is only worth making if we are willing to show the date
 * going off. The weekly job bumps CHECKED_ON on a clean run, so amber means a
 * run was missed and red means several were — which is information, not a
 * blemish to hide.
 */
export function CheckedAgo({ className, prefix = 'Checked' }: { className?: string; prefix?: string }) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    setDays(daysSinceChecked());
    // Re-read at midnight-ish so a tab left open overnight does not keep
    // claiming yesterday's answer. Cheap, and a forms page is exactly the kind
    // of tab that sits open for hours.
    const t = setInterval(() => setDays(daysSinceChecked()), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (days === null) {
    return (
      <span className={cn('tabular-nums', className)}>
        {prefix} on <time dateTime={CHECKED_ON}>{CHECKED_ON_LABEL}</time>
      </span>
    );
  }

  const state = checkFreshness(days);
  const tone =
    state === 'fresh'
      ? 'text-muted-foreground'
      : state === 'ageing'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-700 dark:text-red-400';

  return (
    // `inline`, not `inline-flex`: this sits mid-sentence and the sentence ends
    // with a full stop supplied by the page. An inline-flex wrapper makes that
    // stop its own line box, so the copy rendered as "Checked today" followed
    // by a lone "." on the next line.
    <span className={cn('tabular-nums', tone, className)} title={`Verified at the agency on ${CHECKED_ON_LABEL}`}>
      {state === 'fresh' ? (
        <CheckCircle2 className="mr-1 inline size-3.5 align-[-0.15em] text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <AlertTriangle className="mr-1 inline size-3.5 align-[-0.15em]" aria-hidden />
      )}
      {prefix} <time dateTime={CHECKED_ON}>{checkedAgoPhrase(days)}</time>
      {state !== 'fresh' && <span className="font-medium"> — due a re-check</span>}
    </span>
  );
}
