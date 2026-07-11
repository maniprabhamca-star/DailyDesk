'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

// Shown when a free user hits the daily server-conversion cap. This is the
// highest-intent upsell moment — they clearly need the tool right now — so make
// Pro the obvious next step while reaffirming that the on-device tools stay free.
export function ConversionLimitUpsell({ message }: { message?: string }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.10] to-orange-500/[0.06] p-4 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"><Sparkles className="size-5" /></span>
      <p className="mt-2.5 text-sm font-semibold text-foreground">{message || 'You’ve used your free conversions for today.'}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Every on-device tool stays free &amp; unlimited. For <span className="font-medium text-foreground">unlimited</span> Office conversions, OCR &amp; batch, go Pro.</p>
      <Link href="/pricing" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md">
        <Sparkles className="size-4" /> Go Pro — unlimited
      </Link>
      <p className="mt-2 text-[11px] text-muted-foreground">Or come back tomorrow — your free conversions reset daily.</p>
    </div>
  );
}
