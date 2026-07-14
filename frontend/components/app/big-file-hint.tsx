'use client';

import { Info, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browserSafeMaxBytes, exceedsBrowserCapacity, fmtBytes, type OpWeight } from '@/lib/plan';

// An HONEST heads-up for large files: because every tool runs on the user's device
// (nothing uploaded), the real limit is their computer's memory, not our servers.
// Two tiers:
//   • CAUTION (amber)  — big enough to be slow / lean on RAM, but should work.
//   • OVER CAPACITY (red) — bigger than a browser tab can reliably hold on THIS
//     device, so it will very likely crash. We say so plainly, explain why, and
//     point to a way forward — instead of letting the tab die with no explanation.
// The capacity number is device-specific (a phone and a 32 GB desktop differ), so
// it's computed on the client after mount to avoid a hydration mismatch.
export function BigFileHint({
  bytes,
  threshold = 300 * 1024 * 1024,
  weight = 'heavy',
}: {
  bytes: number;
  threshold?: number;
  weight?: OpWeight;
}) {
  const [cap, setCap] = useState<number | null>(null);
  useEffect(() => {
    setCap(exceedsBrowserCapacity(bytes, weight) ? browserSafeMaxBytes(weight) : 0);
  }, [bytes, weight]);

  // Over the device's physical capacity → warn clearly before the tab crashes.
  if (cap) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/[0.07] px-3 py-2 text-xs text-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
        <span>
          <b className="font-semibold">This file is probably too large for your browser to process.</b> Everything
          here runs on your device — nothing is uploaded — and a browser tab can only hold roughly{' '}
          <b className="font-semibold">{fmtBytes(cap)}</b> in memory on this computer. A {fmtBytes(bytes)} file
          will likely freeze or crash the tab. Try splitting it into smaller parts first, or run it on a
          desktop with more RAM.
        </span>
      </p>
    );
  }

  if (cap === null || bytes < threshold) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      <span>That’s a large file. Everything here runs on your device — nothing is uploaded — so very large files lean on your computer’s memory. It may take a while, and the biggest files do best on a desktop with plenty of RAM.</span>
    </p>
  );
}
