'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { catalog } from '@/components/app/catalog';

// Real tool routes only (same source the "recent tools" feature uses).
const TOOL_HREFS = new Set(
  catalog.flatMap((g) => g.tools.map((t) => t.href).filter((h): h is string => !!h)),
);

const API = process.env.NEXT_PUBLIC_API_URL || '';

// Coarse, privacy-safe size buckets — we never send the filename or exact bytes,
// only which band the largest selected file falls in. Kept in sync with the
// backend SIZE_BUCKET_ORDER (events.js).
const MB = 1024 * 1024;
const GB = 1024 * MB;
function sizeBucket(bytes: number): string {
  if (bytes < 50 * MB) return '<50MB';
  if (bytes < 100 * MB) return '50-100MB';
  if (bytes < GB) return '100MB-1GB';
  if (bytes < 2 * GB) return '1-2GB';
  return '>2GB';
}
function maxSize(files: FileList | null | undefined): number {
  let m = 0;
  if (files) for (let i = 0; i < files.length; i++) { const s = files[i]?.size || 0; if (s > m) m = s; }
  return m;
}

// Don't count automated traffic — our own headless health-canary (Playwright),
// dev/test runs, and most bots. It would inflate unique-visitor and tool-use
// numbers so the dashboard no longer reflects real people. navigator.webdriver
// is set by WebDriver/Playwright/Selenium; we also skip obvious headless UAs.
function isAutomated(): boolean {
  try {
    if (navigator.webdriver) return true;
    return /headless|playwright|puppeteer|phantom|electron|\bbot\b|crawler|spider/i.test(navigator.userAgent || '');
  } catch { return false; }
}

// Stable, anonymous, first-party visitor id (random UUID in localStorage — no
// personal data, no third-party tracker). Lets us count unique + returning
// visitors accurately without requiring signup.
function getVisitorId(): string | null {
  try {
    let v = localStorage.getItem('dd_vid');
    if (!v) {
      v = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('dd_vid', v);
    }
    return v;
  } catch {
    return null;
  }
}

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
    if (isAutomated()) return;             // don't count bots / our own canary
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
        body: JSON.stringify({ module: moduleName, visitorId: getVisitorId(), ref: document.referrer || '' }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [pathname]);

  // Size-distribution beacon: one document-level listener catches ANY file the
  // user selects or drops (across every tool, no per-tool wiring) and reports its
  // bucket for the current tool route. Bucket only — no filename, no bytes.
  useEffect(() => {
    const report = (files: FileList | null | undefined) => {
      const bytes = maxSize(files);
      if (bytes <= 0) return;
      if (isAutomated()) return;          // don't count bots / our own canary
      const route = window.location.pathname;
      if (!TOOL_HREFS.has(route)) return; // real tool routes only
      try {
        const token = localStorage.getItem('dd_token');
        fetch(`${API}/api/events/track`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ module: route.replace(/^\//, ''), sizeBucket: sizeBucket(bytes), visitorId: getVisitorId(), ref: document.referrer || '' }),
        }).catch(() => {});
      } catch { /* ignore */ }
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.tagName === 'INPUT' && t.type === 'file') report(t.files);
    };
    const onDrop = (e: DragEvent) => report(e.dataTransfer?.files);
    document.addEventListener('change', onChange, true);
    document.addEventListener('drop', onDrop, true);
    return () => {
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('drop', onDrop, true);
    };
  }, []);

  return null;
}
