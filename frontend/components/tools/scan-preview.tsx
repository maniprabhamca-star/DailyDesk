'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCw, Trash2, Crop, Check } from 'lucide-react';
import type { ScanPage } from '@/lib/scan-to-pdf';
import type { Quad } from '@/lib/doc-scan';

/**
 * Full-screen look at a captured page before the PDF is built.
 *
 * Asked for as "preview or see in the large window how the scan will look",
 * and the second half of that is the part worth getting right. A thumbnail
 * 44px wide tells you a page exists; it does not tell you whether the text is
 * readable, whether the shadow came out, or whether the edges were found — the
 * things you would actually want to check before saving.
 *
 * So this shows the PDF PAGE, not the image: the same A4 sheet buildScanPdf is
 * about to make, portrait or landscape chosen the same way, with the same
 * margin in the same proportion. What is on screen here is what comes out of
 * the file. Previewing the bare image instead would be a smaller lie but still
 * a lie — it would not show the white border, and someone checking whether
 * their page fits would be checking the wrong rectangle.
 */

// The same numbers buildScanPdf uses, in the same units, so the two cannot
// drift into showing different things.
const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const PDF_MARGIN = 18;

export function ScanPreview({
  pages,
  index,
  onIndex,
  onRotate,
  onDelete,
  onCrop,
  onClose,
}: {
  pages: ScanPage[];
  index: number;
  onIndex: (i: number) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onCrop: (id: string, corners: Quad) => Promise<void>;
  onClose: () => void;
}) {
  const page = pages[index];

  /* Hand-placed corners, as fractions of the page so they survive the picture
   * being shown at any size.
   *
   * This exists because automatic detection cannot find an edge that is not in
   * the photograph. Measured across the owner's own capture — a white envelope
   * on a white quilt — the paper and the bedspread differ by two or three grey
   * levels, which is under the sensor noise. Nothing can find that. Someone
   * looking at it can see exactly where the envelope is, so let them say.
   */
  const [cropping, setCropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [corners, setCorners] = useState<Quad>([
    { x: 0.08, y: 0.08 }, { x: 0.92, y: 0.08 }, { x: 0.92, y: 0.92 }, { x: 0.08, y: 0.92 },
  ]);
  const dragging = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Leaving crop mode whenever the page changes, so the handles never belong to
  // a page you are no longer looking at.
  useEffect(() => { setCropping(false); }, [index, page?.id]);

  const moveCorner = useCallback((clientX: number, clientY: number) => {
    const i = dragging.current;
    const box = sheetRef.current?.getBoundingClientRect();
    if (i === null || !box || !box.width || !box.height) return;
    const x = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    setCorners((c) => c.map((p, n) => (n === i ? { x, y } : p)) as Quad);
  }, []);

  useEffect(() => {
    if (!cropping) return;
    const onMove = (e: PointerEvent) => {
      if (dragging.current === null) return;
      e.preventDefault();
      moveCorner(e.clientX, e.clientY);
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [cropping, moveCorner]);

  const applyCrop = useCallback(async () => {
    if (!page || busy) return;
    setBusy(true);
    try {
      await onCrop(page.id, corners);
      setCropping(false);
    } finally {
      setBusy(false);
    }
  }, [page, corners, onCrop, busy]);
  const go = useCallback((delta: number) => {
    if (!pages.length) return;
    onIndex((index + delta + pages.length) % pages.length);
  }, [index, pages.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, go]);

  // An empty list closes rather than rendering a hole — deleting the last page
  // from in here is a normal thing to do.
  useEffect(() => { if (!pages.length) onClose(); }, [pages.length, onClose]);
  if (!page) return null;

  const landscape = page.w > page.h;
  const sheetW = landscape ? A4_LONG : A4_SHORT;
  const sheetH = landscape ? A4_SHORT : A4_LONG;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-neutral-900/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={`Page ${index + 1} of ${pages.length}, full size`}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
        <span className="text-sm font-semibold tabular-nums">
          Page {index + 1} of {pages.length}
        </span>
        <span className="hidden text-xs text-white/60 sm:block">
          This is the page as it will appear in the PDF
        </span>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3 pb-2">
        {pages.length > 1 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous page"
            className="absolute left-2 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        {/* The sheet. aspect-ratio keeps it A4 at any screen size, and the
            padding is the PDF's own margin expressed as a share of the width,
            so the white border you see is the white border you get. */}
        <div
          className="max-h-full max-w-full overflow-hidden bg-white shadow-2xl"
          style={{
            aspectRatio: `${sheetW} / ${sheetH}`,
            width: landscape ? 'min(100%, calc((100vh - 13rem) * ' + (sheetW / sheetH) + '))' : undefined,
            height: landscape ? undefined : 'min(100%, calc((100vw - 5rem) * ' + (sheetH / sheetW) + '))',
            padding: `${(PDF_MARGIN / sheetW) * 100}%`,
          }}
        >
          {/* The picture, and — in crop mode — four handles over it. The
              handles sit on THIS box, so their fractions map straight onto the
              page's own pixels however large it is drawn. */}
          <div ref={sheetRef} className="relative size-full touch-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.dataUrl}
              alt={`Page ${index + 1}`}
              className="size-full object-contain"
              draggable={false}
            />
            {cropping && (
              <>
                <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon
                    points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                    fill="rgba(109,94,246,0.16)"
                    stroke="rgb(109,94,246)"
                    strokeWidth="0.6"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {corners.map((p, i) => (
                  <button
                    key={i}
                    onPointerDown={(e) => { e.preventDefault(); dragging.current = i; }}
                    aria-label={`Corner ${i + 1}`}
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg"
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {pages.length > 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next page"
            className="absolute right-2 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* Fix it from here rather than closing, going back to the list and
          finding the row again. */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {cropping ? (
          <>
            <span className="w-full text-center text-xs text-white/70">
              Drag the four dots to the corners of your page
            </span>
            <button
              onClick={() => setCropping(false)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={() => void applyCrop()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 active:scale-95"
            >
              <Check className="size-4" /> {busy ? 'Cropping…' : 'Crop to this'}
            </button>
          </>
        ) : (
          <>
            {/* A crop button sitting there unexplained got "i dont know what is
                the use of crop doing here", which is fair — on a page whose
                edges WERE found there is nothing obvious for it to do. So the
                page says which it is. When the edges were not found the capture
                is the whole camera frame, desk and all, and cropping is the
                next step rather than an option: it says so, and it is the
                filled button. */}
            {!page.detected && (
              <span className="w-full text-center text-xs text-amber-300/90">
                Edges weren’t found, so this is the whole picture — crop it to your page
              </span>
            )}
            <button
              onClick={() => setCropping(true)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm active:scale-95 ${
                page.detected
                  ? 'bg-white/10 font-medium text-white hover:bg-white/20'
                  : 'bg-primary font-semibold text-primary-foreground'
              }`}
            >
              <Crop className="size-4" /> {page.detected ? 'Crop' : 'Crop to your page'}
            </button>
            <button
              onClick={() => onRotate(page.id)}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 active:scale-95"
            >
              <RotateCw className="size-4" /> Turn
            </button>
            <button
              onClick={() => onDelete(page.id)}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600/80 active:scale-95"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
