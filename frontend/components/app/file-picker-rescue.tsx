'use client';

import { useEffect } from 'react';

// Hands control back to React once hydration finishes, and reports whether the
// early script actually had to step in. See lib/file-picker-rescue.ts for the
// bug this exists for.
const API = process.env.NEXT_PUBLIC_API_URL || '';

declare global {
  // eslint-disable-next-line no-var
  var __ddHydrated: boolean | undefined;
  // eslint-disable-next-line no-var
  var __ddEarlyPick: number | undefined;
}

export function FilePickerRescue() {
  useEffect(() => {
    window.__ddHydrated = true;

    // If the early script opened a picker, the user beat hydration on this
    // page — the exact condition we could not see before. Report it once, with
    // no file data and no identifiers beyond the usual visitor id.
    const early = window.__ddEarlyPick || 0;
    if (!early) return;
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      fetch(`${API}/api/events/track`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: location.pathname.slice(0, 60),
          action: 'picker_before_ready',
          visitorId: (() => { try { return localStorage.getItem('dd_vid'); } catch { return null; } })(),
          metadata: {
            clicks: early,
            hydrateMs: Math.round(performance.now()),
            domInteractiveMs: Math.round(nav?.domInteractive || 0),
          },
        }),
      }).catch(() => {});
    } catch { /* never disrupt the app */ }
  }, []);

  return null;
}
