'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Loader2, Search, Sparkles } from 'lucide-react';
import type { RenderedPage } from '@/lib/pdf-render';
import { diffPages, describeMatch, type DiffResult } from '@/lib/image-diff';

// What a compression level did to the page being previewed. Measured by the
// caller from the same numbers the compressor uses — not inferred from pixels.
export type TouchedInfo = {
  fromPx: number;   // stored long edge of the source page image
  toPx: number;     // long edge this level will produce
  dpi: number;      // the level's raster DPI target
  quality: number;  // JPEG quality, 0-100
  atFloor: boolean; // the readability floor bound, so every level lands here
};

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

// Captions default to the Compress wording ("Original" / "Compressed") so the
// compression tools stay untouched; the quality-preview pass on the conversion
// tools passes its own ("Original" / "At this quality", etc.). zoomHint lets a
// caller replace the desktop "your text stays razor-sharp" line (images aren't
// text) — the mobile hint is generic enough to reuse everywhere.
export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  loading,
  beforeCaption = 'Original',
  afterCaption = 'Compressed',
  zoomHint = 'Hover the image to zoom in — your text stays razor-sharp',
  measure = false,
  touched = null,
}: {
  before: RenderedPage | null;
  after: RenderedPage | null;
  beforeLabel: string;
  afterLabel: string;
  loading?: boolean;
  beforeCaption?: string;
  afterCaption?: string;
  zoomHint?: string;
  /** Measure the two pages and offer a difference map + match score. */
  measure?: boolean;
  /** What the chosen level actually did to this page, stated plainly. */
  touched?: TouchedInfo | null;
}) {
  const [mobileSide, setMobileSide] = useState<'before' | 'after'>('after');
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  // Measure whenever either side changes. The blob URLs behind these pages are
  // revoked when the PDF handle is destroyed, so a failure here is expected
  // during teardown and must stay silent rather than throwing into the tree.
  useEffect(() => {
    if (!measure || !before || !after) { setDiff(null); return; }
    let dead = false;
    let made: string | null = null;
    setMeasuring(true);
    diffPages(before.url, after.url)
      .then((res) => {
        if (dead) { URL.revokeObjectURL(res.heatmapUrl); return; }
        made = res.heatmapUrl;
        setDiff(res);
      })
      .catch(() => { if (!dead) setDiff(null); })
      .finally(() => { if (!dead) setMeasuring(false); });
    return () => { dead = true; if (made) URL.revokeObjectURL(made); };
  }, [measure, before, after]);

  const heat: RenderedPage | null = diff && after ? { url: diff.heatmapUrl, w: after.w, h: after.h } : null;
  const showingHeat = showDiff && !!heat;

  return (
    <div>
      {measure && (
        <div className="mb-2.5 rounded-lg border bg-muted/30 p-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* The sentence leads. The percentage sits inside the panel below,
                where it has context — shown on its own it reads as a grade and
                invites "why isn't it 100?" about a page nothing happened to. */}
            <span className="flex min-w-0 items-start gap-1.5 text-xs">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="font-medium">
                {measuring || !diff ? 'Measuring this page…' : describeMatch(diff.match)}
              </span>
            </span>
            {diff && (
              <button
                type="button"
                onClick={() => setShowDiff((v) => !v)}
                aria-pressed={showDiff}
                className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${showDiff ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-accent'}`}
              >
                {showDiff ? 'Hide what changed' : 'Show what changed'}
              </button>
            )}
          </div>

          {/* What actually happened — stated, not inferred from two pictures. */}
          {touched && (
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Text:</dt>
                <dd className="font-medium text-emerald-600 dark:text-emerald-400">untouched, still selectable</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Page image:</dt>
                <dd className="font-medium">
                  {touched.fromPx > touched.toPx
                    ? `${touched.fromPx} → ${touched.toPx} px (${touched.dpi} DPI, quality ${touched.quality})`
                    : `kept at ${touched.toPx} px (quality ${touched.quality})`}
                </dd>
              </div>
            </dl>
          )}

          {touched?.atFloor && (
            <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              This page is already close to the smallest size that stays readable, so it stops at {touched.toPx} px — <b>every level produces this same page</b>, differing only in JPEG quality. Levels will separate on pages that hold larger images.
            </p>
          )}

          {diff && showDiff && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Bright areas are where <b>detail was lost</b>; black is untouched. Resizing is not counted — the two pages are compared at the same size, so this shows compression damage only. Amplified ten times so it can be seen at all. Measured match: {diff.match.toFixed(1)}% (structural similarity, grain ignored).
            </p>
          )}
        </div>
      )}

      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="size-3.5 shrink-0 text-primary" />
        <span className="sm:hidden">Tap a version, then press and drag the image to zoom in</span>
        <span className="hidden sm:inline">{zoomHint}</span>
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2">
        <Pane page={before} caption={beforeCaption} value={beforeLabel} loading={loading} />
        <Pane
          page={showingHeat ? heat : after}
          caption={showingHeat ? 'What changed' : afterCaption}
          value={afterLabel}
          success={!showingHeat}
          loading={loading}
        />
      </div>

      {/* Mobile: flip toggle */}
      <div className="sm:hidden">
        <Pane
          page={mobileSide === 'before' ? before : (showingHeat ? heat : after)}
          caption={mobileSide === 'before' ? beforeCaption : (showingHeat ? 'What changed' : afterCaption)}
          value={mobileSide === 'before' ? beforeLabel : afterLabel}
          success={mobileSide === 'after' && !showingHeat}
          loading={loading}
        />
        <div className="mt-3 flex justify-center">
          <div className="inline-flex overflow-hidden rounded-full border">
            <button
              type="button"
              onClick={() => setMobileSide('before')}
              aria-pressed={mobileSide === 'before'}
              className={`px-4 py-1.5 text-sm transition-colors ${mobileSide === 'before' ? 'bg-card font-medium text-foreground' : 'bg-transparent text-muted-foreground'}`}
            >{beforeCaption}</button>
            <button
              type="button"
              onClick={() => setMobileSide('after')}
              aria-pressed={mobileSide === 'after'}
              className={`px-4 py-1.5 text-sm transition-colors ${mobileSide === 'after' ? 'bg-card font-medium text-emerald-600' : 'bg-transparent text-muted-foreground'}`}
            >{afterCaption}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
