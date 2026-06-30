'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, FileWarning } from 'lucide-react';
import { renderPage, dprTarget, type PdfHandle } from '@/lib/pdf-render';

// Horizontal strip of lazily-rendered page thumbnails. Only thumbnails near the
// viewport are rendered (IntersectionObserver), and renders are serialised through
// a global queue so a big document never floods pdf.js — typical files stay snappy.
// Click a thumb to select that page (drives the big preview / before-after viewer).

const THUMB_CSS = 60; // displayed long edge (px)

// Serialise thumbnail renders so we never run many heavy pdf.js renders at once.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function Thumb({ handle, index, active, onSelect }: { handle: PdfHandle; index: number; active: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          enqueue(() => renderPage(handle, index, dprTarget(THUMB_CSS, 2.2, 240)))
            .then((p) => { if (!cancelled) setUrl(p.url); })
            .catch(() => { if (!cancelled) setFailed(true); });
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [handle, index]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-label={`Page ${index + 1}`}
      aria-current={active}
      className={`relative flex h-[84px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white transition-all ${active ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50'}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      ) : failed ? (
        <FileWarning className="size-4 text-muted-foreground" />
      ) : (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      <span className={`absolute bottom-0.5 right-0.5 rounded px-1 text-[10px] font-medium leading-tight ${active ? 'bg-primary text-primary-foreground' : 'bg-black/55 text-white'}`}>{index + 1}</span>
    </button>
  );
}

export function PageStrip({ handle, count, selected, onSelect, className = '' }: { handle: PdfHandle | null; count: number; selected: number; onSelect: (i: number) => void; className?: string }) {
  if (!handle || count <= 1) return null;
  const pages = [];
  for (let i = 0; i < count; i++) pages.push(i);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Pages</span>
        <span className="text-xs text-muted-foreground">Page {selected + 1} of {count}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1.5">
        {pages.map((i) => (
          <Thumb key={i} handle={handle} index={i} active={i === selected} onSelect={() => onSelect(i)} />
        ))}
      </div>
    </div>
  );
}
