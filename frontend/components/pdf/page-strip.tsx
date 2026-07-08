'use client';

import { useEffect, useRef } from 'react';
import { Loader2, FileWarning, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useLazyPageThumb, type PdfHandle } from '@/lib/pdf-render';

// Horizontal strip of lazily-rendered page thumbnails. Only thumbnails near the
// viewport are rendered (IntersectionObserver via useLazyPageThumb), through the
// shared LIFO render queue — so a big document never floods pdf.js and what the
// user is looking at renders first. Click a thumb to select that page (drives
// the big preview / before-after viewer).

const THUMB_CSS = 60; // displayed long edge (px)

function Thumb({ handle, index, active, onSelect, onDelete }: { handle: PdfHandle; index: number; active: boolean; onSelect: () => void; onDelete?: () => void }) {
  const { ref, url, failed } = useLazyPageThumb<HTMLButtonElement>(handle, index, THUMB_CSS);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-label={`Page ${index + 1}`}
      aria-current={active}
      className={`group relative flex h-[84px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white transition-all ${active ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50'}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      ) : failed ? (
        <FileWarning className="size-4 text-muted-foreground" />
      ) : (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          title={`Delete page ${index + 1}`}
          aria-label={`Delete page ${index + 1}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }
          }}
          className="absolute right-0.5 top-0.5 hidden size-5 items-center justify-center rounded-full bg-destructive text-white shadow group-hover:flex group-focus-visible:flex"
        >
          <Trash2 className="size-3" />
        </span>
      )}
      <span className={`absolute bottom-0.5 right-0.5 rounded px-1 text-[10px] font-medium leading-tight ${active ? 'bg-primary text-primary-foreground' : 'bg-black/55 text-white'}`}>{index + 1}</span>
    </button>
  );
}

export function PageStrip({ handle, count, selected, onSelect, onDelete, className = '' }: { handle: PdfHandle | null; count: number; selected: number; onSelect: (i: number) => void; onDelete?: (i: number) => void; className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the selected thumb in view when navigating via the stepper / page input.
  useEffect(() => {
    stripRef.current?.querySelector(`[data-page="${selected}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selected]);

  if (!handle || count <= 1) return null;
  const pages = [];
  for (let i = 0; i < count; i++) pages.push(i);
  const clamp = (n: number) => Math.max(0, Math.min(count - 1, n));

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Pages</span>
        {/* Long-document navigation: prev/next + direct page entry (faster than
            scrolling a 100+ page strip; a dropdown that long would be worse UX). */}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => onSelect(clamp(selected - 1))}
            disabled={selected <= 0}
            aria-label="Previous page"
            className="flex size-6 items-center justify-center rounded-md border transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
          ><ChevronLeft className="size-3.5" /></button>
          <span className="flex items-center gap-1">
            Page
            <input
              type="number"
              min={1}
              max={count}
              value={selected + 1}
              onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) onSelect(clamp(n - 1)); }}
              aria-label="Go to page"
              className="h-6 w-12 rounded-md border bg-background px-1.5 text-center text-xs outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            of {count}
          </span>
          <button
            type="button"
            onClick={() => onSelect(clamp(selected + 1))}
            disabled={selected >= count - 1}
            aria-label="Next page"
            className="flex size-6 items-center justify-center rounded-md border transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
          ><ChevronRight className="size-3.5" /></button>
        </span>
      </div>
      <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-1.5">
        {pages.map((i) => (
          <span key={i} data-page={i} className="shrink-0">
            <Thumb handle={handle} index={i} active={i === selected} onSelect={() => onSelect(i)} onDelete={onDelete ? () => onDelete(i) : undefined} />
          </span>
        ))}
      </div>
    </div>
  );
}
