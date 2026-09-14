'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/* Registers the service worker, and — the part that matters — tells you when a
 * newer build is sitting there unused.
 *
 * public/sw.template.js deliberately does NOT call skipWaiting on install: an
 * automatic swap pulls the chunks out from under a live tab, which is the
 * stale-shell incident that worker was rewritten for. The cost of that choice
 * only became visible later. A phone with the tab left open keeps build N while
 * N+1 and N+2 queue up behind it, so a fix that is demonstrably live on the
 * server is invisible on the device — and the owner, testing on a phone with
 * dozens of tabs open, spent a day reporting bugs against code two deploys old
 * while being told the fixes were shipped. Nobody closes all their tabs.
 *
 * So: when a new worker reaches `installed` while an old one is still in
 * charge, say so and offer one tap. The tap posts DD_SKIP_WAITING, the new
 * worker takes over, `controllerchange` fires and the page reloads whole. The
 * live-tab objection does not apply to a reload someone asked for.
 *
 * Dismissible, because a banner you cannot get rid of is worse than a stale
 * tab; the next navigation picks the new build up anyway.
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [hidden, setHidden] = useState(false);
  // Only reload for a takeover WE asked for. controllerchange also fires the
  // first time a worker ever claims the page, and reloading then would bounce
  // every first-time visitor for no reason.
  const askedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    let reg: ServiceWorkerRegistration | null = null;

    const offer = (sw: ServiceWorker | null) => {
      if (!cancelled && sw && navigator.serviceWorker.controller) setWaiting(sw);
    };

    // updateViaCache: 'none' keeps the HTTP cache out from between the origin and
    // the worker script, so a broken worker can always be replaced by a deploy.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((r) => {
        if (cancelled) return;
        reg = r;
        offer(r.waiting);
        r.addEventListener('updatefound', () => {
          const sw = r.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') offer(sw);
          });
        });
      })
      .catch(() => { /* no worker is not an error worth showing anyone */ });

    // A tab can sit open for days. Ask the browser to re-check whenever it comes
    // back to the foreground, which is when someone is about to use it again.
    const recheck = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', recheck);
    const timer = window.setInterval(recheck, 30 * 60 * 1000);

    const onControllerChange = () => {
      if (!askedRef.current) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', recheck);
      window.clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const update = useCallback(() => {
    if (!waiting) return;
    askedRef.current = true;
    waiting.postMessage({ type: 'DD_SKIP_WAITING' });
    // If the worker never takes over — an old build with no message handler,
    // or a browser that ignores it — reload anyway rather than leaving a button
    // that visibly does nothing.
    window.setTimeout(() => window.location.reload(), 1500);
  }, [waiting]);

  if (!waiting || hidden) return null;

  return (
    // Top, not bottom: the bottom of a phone screen already holds the privacy
    // notice and the tool bars, and two things pinned there unaware of each
    // other is a bug we have shipped twice.
    <div className="fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        role="status"
        className="flex w-full max-w-md items-center gap-2 rounded-xl border bg-card/95 p-2 pl-3.5 text-sm shadow-lg backdrop-blur"
      >
        <span className="flex-1 font-medium">A newer version of DiemDesk is ready.</span>
        <button
          onClick={update}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"
        >
          <RefreshCw className="size-3.5" />
          Reload
        </button>
        <button
          onClick={() => setHidden(true)}
          aria-label="Dismiss the update notice"
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
