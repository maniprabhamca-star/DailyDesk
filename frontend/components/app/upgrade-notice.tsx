'use client';

import Link from 'next/link';
import { FileWarning, Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRICING } from '@/lib/pricing';
import { PRO_UPSELL_ENABLED } from '@/lib/flags';

// Shown when a free/logged-out user picks a file over the free size cap.
// Two faces, one component:
//  • Launch (PRO_UPSELL_ENABLED = false): a neutral "file too large" note — no
//    Pro pitch, because Pro isn't for sale yet.
//  • Pro launched (true): the amber Pro upsell with a price + "See Pro" CTA.
// Either way the privacy reassurance stays (big files are still processed
// in-browser, never uploaded).
export function UpgradeNotice({ fileName, sizeText, limitText, onReset }: { fileName: string; sizeText: string; limitText: string; onReset: () => void }) {
  if (!PRO_UPSELL_ENABLED) {
    return (
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><FileWarning className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">This file is over the current {limitText} limit</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{fileName} · {sizeText}</span> — for now, files up to{' '}
              <span className="font-medium text-foreground">{limitText}</span> are supported. Try a smaller file, or split it first.
            </p>
            <div className="mt-3.5">
              <Button size="sm" variant="outline" onClick={onReset}>Choose a smaller file</Button>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="size-3.5" /> Still 100% private — large files are processed in your browser too, never uploaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-300"><Crown className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-amber-800 dark:text-amber-300">Files over {limitText} are a Pro feature</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{fileName} · {sizeText}</span> is ready the moment you upgrade — or trim it under{' '}
            <span className="font-medium text-foreground">{limitText}</span> to keep going free. Nothing was uploaded.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/pricing"><Crown className="size-4" /> See Pro — ${PRICING.pro.monthly}/mo</Link></Button>
            <Button size="sm" variant="outline" onClick={onReset}>Choose a smaller file</Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="size-3.5" /> Still 100% private — Pro processes large files in your browser too, never uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
