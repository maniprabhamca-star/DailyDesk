'use client';

import { useEffect } from 'react';

// Registers a MINIMAL, no-cache service worker whose ONLY job is to receive a PDF
// shared to the site (Android "Share to DiemDesk" → manifest share_target). It
// caches nothing about the app shell, so it can't reintroduce the stale-shell bug
// that made us disable the old caching SW — every request except the share POST
// goes straight to the network. See public/sw.js. (Registering it also lets the
// SW's activate purge any leftover caches from the old caching SW.)
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // updateViaCache: 'none' keeps the HTTP cache out from between the origin and
    // the worker script, so a broken worker can always be replaced by a deploy.
    // Safe to set now while the worker is a no-op; it must be in place BEFORE any
    // caching worker ships, or a bad one could pin itself.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => { /* ignore */ });
  }, []);
  return null;
}
