'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { RenderedPage } from '@/lib/pdf-render';

// Before/after quality proof for Compress. Responsive: side-by-side panes on
// desktop, a flip toggle on mobile (each page gets full width). A loupe magnifier
// is available in BOTH modes — hover (mouse) or press-drag (touch) over a pane to
// pixel-peep and verify text stays razor-sharp. The loupe magnifies the already-
// rendered hi-res bitmap via CSS background zoom — no second render pass.

const ZOOM = 2.4;
const LOUPE = 128; // px diameter

type LoupeState = { x: number; y: number; cw: number; ch: number };

function Pane({ page, caption, value, success, loading }: { page: RenderedPage | null; caption: string; value: string; success?: boolean; loading?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);
  const [loupe, setLoupe] = useState<LoupeState | null>(null);

  function update(e: ReactPointerEvent) {
    const el = wrapRef.current;
    if (!el || !page) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { setLoupe(null); return; }
    setLoupe({ x, y, cw: r.width, ch: r.height });
  }
  function onEnter(e: ReactPointerEvent) { if (e.pointerType === 'mouse') update(e); }
  function onDown(e: ReactPointerEvent) { pressing.current = true; update(e); }
  function onMove(e: ReactPointerEvent) { if (e.pointerType === 'mouse' || pressing.current) update(e); }
  function onUp(e: ReactPointerEvent) { pressing.current = false; if (e.pointerType !== 'mouse') setLoupe(null); }
  function onLeave(e: ReactPointerEvent) { if (e.pointerType === 'mouse') setLoupe(null); }

  const aspect = page ? `${page.w} / ${page.h}` : '3 / 4';

  return (
    <div className="min-w-0">
      <div
        ref={wrapRef}
        onPointerEnter={onEnter}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onLeave}
        className={`relative mx-auto overflow-hidden rounded-lg border bg-white ${success ? 'border-emerald-500/40' : 'border-border'} ${page ? 'cursor-zoom-in touch-none' : ''}`}
        style={{ aspectRatio: aspect, maxHeight: 360 }}
      >
        {page ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.url} alt={`${caption} preview`} className="h-full w-full object-contain" draggable={false} />
        ) : (
          <div className="flex h-full min-h-[200px] w-full items-center justify-center">
            {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Search className="size-5 text-muted-foreground" />}
          </div>
        )}

        <span className="pointer-events-none absolute left-2 top-2 rounded-full border bg-white/95 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm">{caption}</span>

        {loupe && page && (
          <div
            className="pointer-events-none absolute z-10 rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/15"
            style={{
              left: Math.max(0, Math.min(loupe.cw - LOUPE, loupe.x - LOUPE / 2)),
              top: Math.max(0, Math.min(loupe.ch - LOUPE, loupe.y - LOUPE / 2)),
              width: LOUPE,
              height: LOUPE,
              backgroundImage: `url(${page.url})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${loupe.cw * ZOOM}px ${loupe.ch * ZOOM}px`,
              backgroundPosition: `${-(loupe.x * ZOOM - LOUPE / 2)}px ${-(loupe.y * ZOOM - LOUPE / 2)}px`,
            }}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-0.5">
        <span className="text-xs text-muted-foreground">{caption}</span>
        <span className={`text-xs font-medium ${success ? 'text-emerald-600' : 'text-foreground'}`}>{value}</span>
      </div>
    </div>
  );
}

export function BeforeAfter({ before, after, beforeLabel, afterLabel, loading }: { before: RenderedPage | null; after: RenderedPage | null; beforeLabel: string; afterLabel: string; loading?: boolean }) {
  const [mobileSide, setMobileSide] = useState<'before' | 'after'>('after');

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="size-3.5 shrink-0 text-primary" />
        <span className="sm:hidden">Tap a version, then press and drag the image to zoom in</span>
        <span className="hidden sm:inline">Hover the image to zoom in — your text stays razor-sharp</span>
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2">
        <Pane page={before} caption="Original" value={beforeLabel} loading={loading} />
        <Pane page={after} caption="Compressed" value={afterLabel} success loading={loading} />
      </div>

      {/* Mobile: flip toggle */}
      <div className="sm:hidden">
        <Pane
          page={mobileSide === 'before' ? before : after}
          caption={mobileSide === 'before' ? 'Original' : 'Compressed'}
          value={mobileSide === 'before' ? beforeLabel : afterLabel}
          success={mobileSide === 'after'}
          loading={loading}
        />
        <div className="mt-3 flex justify-center">
          <div className="inline-flex overflow-hidden rounded-full border">
            <button
              type="button"
              onClick={() => setMobileSide('before')}
              aria-pressed={mobileSide === 'before'}
              className={`px-4 py-1.5 text-sm transition-colors ${mobileSide === 'before' ? 'bg-card font-medium text-foreground' : 'bg-transparent text-muted-foreground'}`}
            >Original</button>
            <button
              type="button"
              onClick={() => setMobileSide('after')}
              aria-pressed={mobileSide === 'after'}
              className={`px-4 py-1.5 text-sm transition-colors ${mobileSide === 'after' ? 'bg-card font-medium text-emerald-600' : 'bg-transparent text-muted-foreground'}`}
            >Compressed</button>
          </div>
        </div>
      </div>
    </div>
  );
}
