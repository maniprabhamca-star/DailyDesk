'use client';

import { useEffect } from 'react';

// Recover from a deployment landing under an open tab.
//
// A tab that has been sitting on the site is running the JavaScript from
// whichever build it loaded. Deploy, and the Server Action ids baked into that
// bundle no longer exist on the server, so the next interaction throws:
//
//   Failed to find Server Action "…". This request might be from an older or
//   newer deployment.
//
// To the person at the keyboard the page has simply stopped working, and the
// fix — a hard refresh — is not something they can be expected to guess. This
// happened to the owner on 2026-08-24 after a run of deploys, and the frontend
// error log was full of nothing else.
//
// So: catch that specific error and reload once. The bundle is stale by
// definition, so a reload is the correct repair rather than a workaround.
//
// Guard rails, because an auto-reload is exactly the sort of thing that turns
// into an infinite loop:
//   - only for THIS error, matched on its message
//   - at most once per RELOAD_GAP, remembered per tab in sessionStorage
//   - never on the very first paint (a skew error cannot happen before the
//     page has had a chance to talk to the server)
const KEY = 'dd_skew_reload_at';
const RELOAD_GAP = 30_000;

function isSkewError(message: string): boolean {
  return /Failed to find Server Action/i.test(message)
    // Next also surfaces a stale RSC payload this way after a deploy.
    || /Failed to fetch RSC payload/i.test(message);
}

export function DeploySkewGuard() {
  useEffect(() => {
    const mountedAt = Date.now();

    const recover = (message: string) => {
      if (!message || !isSkewError(message)) return;
      if (Date.now() - mountedAt < 1000) return; // not during first paint
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(KEY) || 0);
      } catch {
        return; // private mode — do not risk looping without a memory
      }
      if (Date.now() - last < RELOAD_GAP) return; // already tried; do not loop
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch { return; }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => recover(e?.message || '');
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason as unknown;
      recover(typeof r === 'string' ? r : (r instanceof Error ? r.message : ''));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
