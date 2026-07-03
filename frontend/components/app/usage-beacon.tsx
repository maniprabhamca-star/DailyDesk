'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { catalog } from '@/components/app/catalog';

// Real tool routes only (same source the "recent tools" feature uses).
const TOOL_HREFS = new Set(
  catalog.flatMap((g) => g.tools.map((t) => t.href).filter((h): h is string => !!h)),
);

const API = process.env.NEXT_PUBLIC_API_URL || '';

// Fire-and-forget usage beacon. When a tool page opens, tell the backend which
// tool it was so the admin portal's Module Usage / activity reflect real use.
// Sends the auth token when logged in (so it attributes to the user); otherwise
// records anonymous usage. Never blocks or surfaces errors.
export function UsageBeacon() {
  const pathname = usePathname();
  const last = useRef('');

  useEffect(() => {
    if (!pathname || !TOOL_HREFS.has(pathname)) return;
    if (last.current === pathname) return; // de-dupe re-renders
    last.current = pathname;

    const moduleName = pathname.replace(/^\//, '');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      fetch(`${API}/api/events/track`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ module: moduleName }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return null;
}
