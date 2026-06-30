'use client';

import Link from 'next/link';
import { FileWarning, Zap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shown when a free/logged-out user picks a file over the free size cap. Keeps the
// privacy reassurance (large files are still processed in-browser, never uploaded).
export function UpgradeNotice({ fileName, sizeText, limitText, onReset }: { fileName: string; sizeText: string; limitText: string; onReset: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><FileWarning className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">This file is a bit big for the free plan</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{fileName} · {sizeText}</span> — the free plan covers files up to{' '}
            <span className="font-medium text-foreground">{limitText}</span>. Upgrade to Pro for large files and batch processing.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/pricing"><Zap className="size-4" /> Upgrade to Pro</Link></Button>
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
