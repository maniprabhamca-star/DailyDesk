'use client';

import { useEffect } from 'react';

// Load every page at the TOP on a hard refresh, instead of the browser default
// ("auto") which restores wherever you were scrolled to. On a tool page, a
// refresh should bring the tool back into view — not drop you back at the footer.
// Client-side navigations still use Next's own scroll handling (top on forward,
// restore on back); this only changes the browser's native reload restore.
export function ScrollRestoration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);
  return null;
}
