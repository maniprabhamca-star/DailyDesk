'use client';

import { useEffect } from 'react';

// Service worker is intentionally DISABLED: the old caching SW could pin browsers
// to a stale app shell after a deploy (old CSS hash -> unstyled page). This
// actively unregisters any existing SW and clears its caches so every visitor
// loads fresh from the network. (The updated /sw.js is a kill-switch too.) When
// we want offline support back, re-introduce a robust network-first SW.
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => { void r.unregister(); }))
      .catch(() => { /* ignore */ });
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => keys.forEach((k) => { void caches.delete(k); })).catch(() => { /* ignore */ });
    }
  }, []);
  return null;
}
