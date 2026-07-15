'use client';

import { useEffect } from 'react';

// Scroll behaviour:
//  • Back / forward  → return you to where you were (e.g. the SAME tool section
//    on the home page). We must NOT set history.scrollRestoration = 'manual'
//    globally — that disables the browser/Next restore and drops you at the top
//    (the bug this used to cause on mobile).
//  • Hard reload     → jump to the top, so refreshing a tool page shows the tool,
//    not wherever you happened to be scrolled. We only override THIS case, by
//    detecting a 'reload' navigation and scrolling to the top after paint.
export function ScrollRestoration() {
  useEffect(() => {
    try {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (entry?.type === 'reload') {
        // Beat the browser's own reload-restore to the top; leave scrollRestoration
        // at its default so back/forward still restore normally.
        requestAnimationFrame(() => window.scrollTo(0, 0));
      }
    } catch { /* older browsers: leave native restoration alone */ }
  }, []);
  return null;
}
