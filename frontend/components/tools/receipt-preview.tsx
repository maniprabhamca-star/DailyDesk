'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCw, RotateCcw, ScanLine, X, AlertTriangle, CreditCard, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { initialRotation, looksSideways as readsSideways } from '@/lib/receipt-orientation';

// Look at the photograph before it is read.
//
// This exists because of a specific, bad failure. A receipt photographed
// sideways — which is how a long till roll gets photographed — was sent to the
// reader as-is, and a model given a receipt it cannot read does not return
// nothing. It returns a plausible receipt. A real scan came back with five
// identical apple juices and a beef roast that were never on the slip, and the
// invented totals were self-consistent, so the arithmetic check passed and put a
// green tick on fabricated data.
//
// Straightening is now done on the server too, but the honest fix is to let the
// person see what is about to be read. Ten seconds of looking prevents a class
// of error no amount of prompting reliably removes.

type Props = {
  file: File;
  onScan: (blob: Blob, wantCard: boolean) => void;
  onCancel: () => void;
};

export function ReceiptPreview({ file, onScan, onCancel }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [wantCard, setWantCard] = useState(false);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);

  // A CSS transform does not change the layout box, so a tall receipt turned on
  // its side still occupies its upright footprint and gets clipped by the frame.
  // Measure the frame and cap the image against the SWAPPED axis while it is
  // quarter-turned, which is the whole of the fix.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const img = new Image();
    img.onload = () => {
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
      // A receipt is taller than it is wide. If this one is not, it is almost
      // certainly lying on its side — start it rotated so the common case needs
      // no interaction at all.
      setRotation(initialRotation(img.naturalWidth, img.naturalHeight));
      imgRef.current = img;
    };
    img.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const rotate = (delta: number) => setRotation((r) => (r + delta + 360) % 360);

  /** Bake the rotation into the bytes, so what is read is what you saw. */
  const scan = async () => {
    setBusy(true);
    const img = imgRef.current;
    if (!img) { onScan(file, wantCard); return; }
    try {
      const c = document.createElement('canvas');
      c.width = quarter ? img.naturalHeight : img.naturalWidth;
      c.height = quarter ? img.naturalWidth : img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob: Blob | null = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
      c.width = c.height = 0;
      onScan(blob || file, wantCard);
    } catch {
      onScan(file, wantCard);
    }
  };

  const quarter = rotation === 90 || rotation === 270;
  // True when it still reads sideways on screen, which is what the warning is about.
  const looksSideways = dims ? readsSideways(dims.w, dims.h, rotation) : false;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="truncate text-sm font-semibold">Check the photo before scanning</p>
        <button onClick={onCancel} aria-label="Choose a different photo" className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="bg-muted/40 p-3">
        <div ref={frameRef} className="flex h-[46vh] w-full items-center justify-center overflow-hidden">
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="The receipt you are about to scan"
              className="object-contain transition-transform duration-200"
              style={{
                transform: `rotate(${rotation}deg)`,
                maxWidth: frame ? (quarter ? frame.h : frame.w) : '100%',
                maxHeight: frame ? (quarter ? frame.w : frame.h) : '100%',
              }}
            />
          )}
        </div>
      </div>

      {looksSideways && (
        <p className="flex items-start gap-2 border-t bg-amber-500/[0.07] px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          This looks like it is on its side. Turn it upright before scanning — a sideways receipt is the single most
          common cause of a wrong reading.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t p-3">
        <Button size="sm" variant="outline" onClick={() => rotate(-90)}>
          <RotateCcw className="mr-1 size-4" /> Left
        </Button>
        <Button size="sm" variant="outline" onClick={() => rotate(90)}>
          <RotateCw className="mr-1 size-4" /> Right
        </Button>
        <Button size="sm" onClick={() => void scan()} disabled={busy} className="ml-auto bg-primary text-primary-foreground">
          <ScanLine className="mr-1.5 size-4" /> {busy ? 'Starting…' : 'Start scanning'}
        </Button>
      </div>

      {/* Card capture. Off by default, and the explanation sits with the choice
          rather than in a policy page nobody opens. */}
      <div className="border-t p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={wantCard}
            onChange={(e) => setWantCard(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[color:var(--primary)]"
          />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <CreditCard className="size-3.5" /> Also read how it was paid
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Reads the payment method and <b className="text-foreground">only the last four digits</b> of the card, so
              you can match this to a line on your statement.
            </span>
          </span>
        </label>

        <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            The full card number is never read, never sent to us and never stored — the four digits are all that leaves
            the image, and we drop anything longer even if the receipt prints it. Nothing at all is saved until you tap
            Save to Budget, and the photo itself is deleted the moment the scan finishes.
          </span>
        </div>
      </div>
    </div>
  );
}
