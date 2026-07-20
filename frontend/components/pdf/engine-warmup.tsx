'use client';

// Warm the pdf.js engine (chunk + worker file) the moment ANY PDF tool page
// opens, so the user's first file drop never pays the cold-load — the visible
// 5-10s "nothing happens" lag the owner reported. Idle-timed so it never
// competes with the page's own first paint.
import { useEffect } from 'react';
import { getPdfjs } from '@/lib/pdf-render';

export function EngineWarmup() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const idle = (cb: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(cb) : window.setTimeout(cb, 350));
    idle(() => {
      void getPdfjs().catch(() => {});
      // Prime the HTTP cache for the worker file too (it loads on first open).
      void fetch('/pdf.worker.min.mjs', { cache: 'force-cache' }).catch(() => {});
    });
  }, []);
  return null;
}
