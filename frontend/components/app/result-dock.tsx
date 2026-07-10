'use client';
import type { ReactNode } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shared "result dock" — the action-first result pattern. Puts the outcome +
// primary Download at the TOP of a tool's result (never below the fold), with the
// savings ring and room for the "Keep moving" chain. Pair with <MobileDownloadBar>
// for a thumb-reachable pinned action on phones. Reused across every tool's result
// so the whole app feels cohesive — our take on it, not a competitor's app-shell.
export function ResultDock({
  savedPct, before, after, title, note, onDownload, downloadLabel = 'Download', secondary, children,
}: {
  savedPct?: number;
  before?: string;
  after?: string;
  title: string;
  note?: string;
  onDownload: () => void;
  downloadLabel?: string;
  secondary?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-4">
        {typeof savedPct === 'number' && savedPct > 0 && (
          <div className="relative size-[78px] shrink-0">
            <svg viewBox="0 0 120 120" className="size-full">
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="11" className="text-emerald-500/20" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round" className="text-emerald-500" transform="rotate(-90 60 60)" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(1, Math.max(0, savedPct) / 100))} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold leading-none text-emerald-600">{savedPct}%</span>
              <span className="text-[10px] font-medium text-emerald-700/80">saved</span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {(before || after) && (
            <p className="mt-1 text-sm"><span className="text-muted-foreground">{before}</span> <span className="text-muted-foreground">→</span> <span className="font-medium text-emerald-600">{after}</span></p>
          )}
          {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button size="lg" onClick={onDownload}><Download className="size-4" /> {downloadLabel}</Button>
          {secondary}
        </div>
      </div>
      {children && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-500/20 pt-3">
          {children}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600"><ShieldCheck className="size-3.5" /> On your device</span>
        </div>
      )}
    </div>
  );
}

// Mobile-only sticky action bar so Download is always thumb-reachable without
// scrolling. Render it near the END of the result block so it pins to the bottom.
export function MobileDownloadBar({ onDownload, label = 'Download', hint }: { onDownload: () => void; label?: string; hint?: string }) {
  return (
    <div className="sticky bottom-2 z-20 mt-3 flex items-center gap-2 rounded-xl border bg-card/95 p-2 shadow-lg backdrop-blur sm:hidden">
      {hint && <span className="flex-1 pl-1 text-xs font-medium text-emerald-600">{hint}</span>}
      <Button className={hint ? '' : 'flex-1'} onClick={onDownload}><Download className="size-4" /> {label}</Button>
    </div>
  );
}
