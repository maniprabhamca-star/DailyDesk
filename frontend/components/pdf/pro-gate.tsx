'use client';

import type { ReactNode } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { usePlan } from '@/lib/plan';

// Presentation-only Pro-gate primitives shared by the editors. They render the
// free/Pro split the way premium competitors do (Adobe/Smallpdf): free users get
// the full "add on top" toolkit; the deep, cost/scale features (edit existing
// text, true redaction, OCR, batch) wear a Pro lock. NONE of this changes editing
// logic — it only decorates and, for a locked action, swaps the click for an upsell.

// Small amber "PRO" pill to sit on a locked tool button.
export function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white shadow-sm ${className}`}>
      <Sparkles className="size-2.5" /> Pro
    </span>
  );
}

// Inline upsell card shown in the properties panel when a locked tool is picked.
export function ProUpsell({ feature, blurb }: { feature: string; blurb: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
      <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
        <Lock className="size-4" />
      </span>
      <p className="mt-2 text-sm font-semibold text-foreground">{feature} is a Pro feature</p>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      <a href="/pricing" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md">
        <Sparkles className="size-3.5" /> Unlock with Pro
      </a>
    </div>
  );
}

// Hook: is this a paying (or owner) user? Thin wrapper over usePlan so the
// editors don't each re-derive it.
export function useIsPro(): boolean {
  return usePlan() === 'pro';
}

// Wrap a toolbar button: free users see it locked (shows the Pro badge + routes
// clicks to `onLocked` instead of the real action). Pro users get the real button.
export function ProLock({ locked, onLocked, children }: { locked: boolean; onLocked: () => void; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <button type="button" onClick={onLocked} className="relative opacity-70 transition-opacity hover:opacity-100" title="Pro feature">
      <span className="pointer-events-none">{children}</span>
      <span className="absolute -right-1 -top-1"><ProBadge /></span>
    </button>
  );
}
