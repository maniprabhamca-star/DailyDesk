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

// Belt-and-suspenders PII scrub: error text is code-level (stack frames, messages)
// so it rarely holds user data, but redact anything email/URL/token-shaped just in
// case, before it ever leaves the browser.
function scrub(s: string): string {
  return s
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/blob:https?:\/\/[^\s"')]+/gi, '[blob]')
    .replace(/\bfile:\/\/[^\s"')]+/gi, '[file]')
    .replace(/\b(?:eyJ[\w-]{6,}|sk-[\w-]{6,}|Bearer\s+[\w.-]{6,})/gi, '[token]');
}

// Errors thrown by BROWSER EXTENSIONS and other injected third-party scripts
// aren't our bugs and can't be acted on — they'd just bury real errors in the
// dashboard. Drop anything whose source/stack points at an extension scheme, a
// known injected-global wrapper (e.g. a WebSocket/XHR shim), or the opaque
// cross-origin "Script error." with no location.
const THIRD_PARTY =
  /chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\/|safari-extension:\/\/|ms-browser-extension:\/\/|webkit-masked-url:\/\/|\bOriginal(WebSocket|XMLHttpRequest|Fetch|EventSource)\b/i;
function isNoise(message: string, source: string, stack?: string): boolean {
  if (THIRD_PARTY.test(`${message}\n${source}\n${stack || ''}`)) return true;
  // opaque cross-origin error with no usable location = third-party script
  if (!/:\d+:\d+$/.test(source) && /^script error\.?$/i.test(message.trim())) return true;
  return false;
}

export function ErrorBeacon() {
  useEffect(() => {
    const seen = new Set<string>();
    let sent = 0;

    const report = (message: string, source: string, stack?: string) => {
      if (!message) return;
      if (isNoise(message, source, stack)) return; // skip extension / third-party noise
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
            message: scrub(message).slice(0, 500),
            source: scrub(source).slice(0, 300),
            stack: scrub(stack || '').slice(0, 2000),
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
