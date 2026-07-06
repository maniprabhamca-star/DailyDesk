'use client';

import { useEffect } from 'react';

// First-party error beacon — catches uncaught JS errors and unhandled promise
// rejections and reports them to our OWN backend (no third-party like Sentry;
// privacy-first, same spirit as the usage beacon). This is how we learn a tool
// broke in a real browser without tracking users. Fire-and-forget, deduped,
// capped per session so a loop can never spam the server or the user.
const API = process.env.NEXT_PUBLIC_API_URL || '';
const MAX_PER_SESSION = 20;

function visitorId(): string | null {
  try { return localStorage.getItem('dd_vid'); } catch { return null; }
}

export function ErrorBeacon() {
  useEffect(() => {
    const seen = new Set<string>();
    let sent = 0;

    const report = (message: string, source: string, stack?: string) => {
      if (!message) return;
      const sig = `${message}@${source}`.slice(0, 300);
      if (seen.has(sig)) return;            // dedupe identical errors
      seen.add(sig);
      if (sent >= MAX_PER_SESSION) return;  // hard cap
      sent += 1;
      try {
        fetch(`${API}/api/events/error`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.slice(0, 500),
            source: source.slice(0, 300),
            stack: (stack || '').slice(0, 2000),
            path: location.pathname.slice(0, 200),
            visitorId: visitorId(),
          }),
        }).catch(() => {});
      } catch { /* never disrupt the app */ }
    };

    const onError = (e: ErrorEvent) => {
      const where = e.filename ? `${e.filename}:${e.lineno || 0}:${e.colno || 0}` : location.pathname;
      report(e.message || 'Error', where, e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? r.message : typeof r === 'string' ? r : 'Unhandled rejection';
      report(msg || 'Unhandled rejection', location.pathname, r instanceof Error ? r.stack : undefined);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);

  return null;
}
