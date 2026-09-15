'use client';

import { useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCw, Trash2 } from 'lucide-react';
import type { ScanPage } from '@/lib/scan-to-pdf';

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
  onClose,
}: {
  pages: ScanPage[];
  index: number;
  onIndex: (i: number) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const page = pages[index];
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.dataUrl}
            alt={`Page ${index + 1}`}
            className="size-full object-contain"
          />
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
      <div className="flex items-center justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
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
      </div>
    </div>
  );
}
