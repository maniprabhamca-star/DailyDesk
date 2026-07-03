import { Info } from 'lucide-react';

// A gentle, HONEST heads-up shown only for genuinely large files: because every
// tool runs on the user's device (nothing uploaded), the real limit is their
// computer's memory, not our servers. We deliberately avoid a scary hard number
// (a phone and a 32GB desktop are worlds apart) — just set expectations so a
// crash on a huge file is never a surprise. Below the threshold it renders nothing.
export function BigFileHint({ bytes, threshold = 300 * 1024 * 1024 }: { bytes: number; threshold?: number }) {
  if (bytes < threshold) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      <span>That’s a large file. Everything here runs on your device — nothing is uploaded — so very large files lean on your computer’s memory. It may take a while, and the biggest files do best on a desktop with plenty of RAM.</span>
    </p>
  );
}
