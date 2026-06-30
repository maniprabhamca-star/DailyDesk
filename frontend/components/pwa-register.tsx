'use client';

import { useEffect } from 'react';

// Registers the service worker (production only) so the app is installable and
// works offline. Dev is skipped to avoid SW caching interfering with hot reload.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is best-effort */ }); };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
