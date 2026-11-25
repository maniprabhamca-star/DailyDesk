'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { CHECKED_ON as US_CHECKED_ON, checkFreshness, checkedAgoPhrase } from '@/lib/us-forms';
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
 * ── ⚠⚠ Why it takes a date instead of reading one ────────────────────────────
 * It used to import CHECKED_ON from lib/us-forms directly. That shipped a real
 * defect: once the India task pages reused this component, they printed the
 * date the IRS library was last checked — a verification of Indian forms that
 * had never happened and could not. A borrowed verification date is a false
 * provenance claim, and this page's whole argument is provenance.
 *
 * So the date is a prop. It still defaults to the federal library, because
 * that is what most callers mean, but a caller with its own clock passes it
 * and cannot silently inherit somebody else's.
 *
 * ── Why a stale state is allowed to look bad ────────────────────────────────
 * These pages argue that stating a verification date beats wearing an "official"
 * badge. That argument is only worth making if we are willing to show the date
 * going off. The weekly job bumps CHECKED_ON on a clean run, so amber means a
 * run was missed and red means several were — which is information, not a
 * blemish to hide.
 */
export function CheckedAgo({
  className,
  prefix = 'Checked',
  /** The day THIS page's data was verified, as YYYY-MM-DD. Defaults to the
   *  federal forms library. Pass your own rather than inheriting it. */
  checkedOn = US_CHECKED_ON,
}: { className?: string; prefix?: string; checkedOn?: string }) {
  const [days, setDays] = useState<number | null>(null);

  // Both derived from the prop, and both built from the parts rather than
  // `new Date(checkedOn)`: a bare YYYY-MM-DD parses as UTC midnight and then
  // formats in the viewer's zone, which renders the date a day early west of
  // UTC and differences an hour either side of a day boundary.
  const [cy, cm, cd] = checkedOn.split('-').map(Number);
  const label = new Date(cy, cm - 1, cd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const since = (now: Date = new Date()) => {
    const then = new Date(cy, cm - 1, cd).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.round((today - then) / 86_400_000));
  };

  useEffect(() => {
    setDays(since());
    // Re-read at midnight-ish so a tab left open overnight does not keep
    // claiming yesterday's answer. Cheap, and a forms page is exactly the kind
    // of tab that sits open for hours.
    const t = setInterval(() => setDays(since()), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [checkedOn]);

  if (days === null) {
    return (
      <span className={cn('tabular-nums', className)}>
        {prefix} on <time dateTime={checkedOn}>{label}</time>
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
    <span className={cn('tabular-nums', tone, className)} title={`Verified at the agency on ${label}`}>
      {state === 'fresh' ? (
        <CheckCircle2 className="mr-1 inline size-3.5 align-[-0.15em] text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <AlertTriangle className="mr-1 inline size-3.5 align-[-0.15em]" aria-hidden />
      )}
      {prefix} <time dateTime={checkedOn}>{checkedAgoPhrase(days)}</time>
      {state !== 'fresh' && <span className="font-medium"> — due a re-check</span>}
    </span>
  );
}
