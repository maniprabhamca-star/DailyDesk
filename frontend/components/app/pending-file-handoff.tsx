'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import {
  takeFile, deliverTo, onStatus, getStatus, markDelivered, markFailed, clearStatus,
  type HandoffStatus,
} from '@/lib/pending-file';

// Delivers the file the app bar picked to whatever tool the route landed on,
// AND says so while it is happening.
//
// Mounted once in the layout rather than in each tool, because the alternative
// is editing a hundred tools to accept an injected file — and every one of them
// already listens for `change` on its own input, which is the same contract.
//
// The visible part is not decoration. Without it the sequence was: tap, the
// route changes, and the tool lands below the fold because a client navigation
// keeps the previous scroll position. Nothing appeared to happen, and the
// natural response is to refresh — which discards the file and makes it worse.

export function PendingFileHandoff() {
  const pathname = usePathname();
  const [status, setStatus] = useState<HandoffStatus>({ phase: 'idle' });

  useEffect(() => onStatus(setStatus), []);
  useEffect(() => setStatus(getStatus()), []);

  useEffect(() => {
    const f = takeFile();
    if (!f) return;

    // Put the tool where the reader is looking. A client navigation keeps the
    // scroll offset, so arriving from halfway down the home page lands you
    // halfway down the tool page, with the thing you came for off-screen.
    window.scrollTo({ top: 0, behavior: 'auto' });

    void deliverTo(f).then((ok) => {
      if (ok) markDelivered();
      else markFailed(f.name);
    });
  }, [pathname]);

  if (status.phase === 'idle') return null;

  const failed = status.phase === 'failed';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 z-[60] mx-auto max-w-md sm:inset-x-auto sm:right-4"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lift ${
          failed ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/40' : 'border-border bg-popover'
        }`}
      >
        {failed ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        ) : (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          {failed ? (
            <>
              <p className="font-medium text-foreground">Couldn&rsquo;t open that file automatically</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose <span className="font-medium text-foreground">{status.filename}</span> again using the button on
                this page — the tool is ready for it.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">
                Opening <span className="font-mono text-[13px]">{status.filename}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Taking you to {status.toolLabel}…</p>
            </>
          )}
        </div>
        <button
          onClick={clearStatus}
          aria-label="Dismiss"
          className="-mr-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
