'use client';

import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';

// Premium animated savings summary for the Compress result: a circular ring that
// fills to the % saved with a count-up, plus before → after sizes. Honours
// prefers-reduced-motion (snaps to the final value, no animation).

const R = 52;
const CIRC = 2 * Math.PI * R;

export function SavingsRing({ savedPct, beforeLabel, afterLabel, note }: { savedPct: number; beforeLabel: string; afterLabel: string; note?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? savedPct : 0);

  useEffect(() => {
    if (reduce) { setShown(savedPct); return; }
    const controls = animate(0, savedPct, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [savedPct, reduce]);

  const frac = Math.max(0, Math.min(1, shown / 100));

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full">
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-emerald-500/15" />
          <circle
            cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            className="text-emerald-500" transform="rotate(-90 60 60)"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none text-emerald-600">&minus;{Math.round(shown)}%</span>
          <span className="mt-0.5 text-[11px] font-medium text-emerald-700/80">smaller</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="flex items-center justify-center gap-1.5 text-base font-semibold sm:justify-start">
          <CheckCircle2 className="size-4 text-emerald-500" /> Compressed — quality preserved
        </p>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm sm:justify-start">
          <span className="font-medium text-muted-foreground">{beforeLabel}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">{afterLabel}</span>
        </p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
