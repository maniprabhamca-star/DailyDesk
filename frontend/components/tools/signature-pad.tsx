'use client';

// The signature capture used by the Saved Workflows "Sign" step. Draw it once,
// it's kept on this device (localStorage) and every later run of the workflow
// stamps it without asking again. Deliberately small: the full Sign PDF tool
// stays the place for one-off, drag-it-anywhere signing.

import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, ImagePlus, Trash2 } from 'lucide-react';
import { trimCanvas } from '@/lib/signature-canvas';
import { loadSignature, saveSignature, clearSignature, type SavedSignature } from '@/lib/workflows/signature';

export function SignaturePad() {
  const [sig, setSig] = useState<SavedSignature | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const penDown = useRef(false);
  const hasInk = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSig(loadSignature()); }, []);

  function initCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(120 * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    hasInk.current = false;
  }
  useEffect(() => { if (drawing) initCanvas(); }, [drawing]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    penDown.current = true;
    hasInk.current = true;
    const { x, y } = pos(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!penDown.current) return;
    const { x, y } = pos(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function adopt(c: HTMLCanvasElement) {
    const dataUrl = c.toDataURL('image/png');
    const next: SavedSignature = { dataUrl, isPng: true, w: c.width, h: c.height };
    saveSignature(next);
    setSig(next);
    setDrawing(false);
    setError(null);
  }

  function useDrawn() {
    const c = canvasRef.current;
    const trimmed = c && hasInk.current ? trimCanvas(c) : null;
    if (!trimmed) { setError('Draw your signature first.'); return; }
    adopt(trimmed);
  }

  function pickImage(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Choose a PNG or JPG image.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        // A transparent PNG trims to its strokes; a photo on white has no
        // transparency to measure, so it's kept whole.
        adopt(trimCanvas(c) ?? c);
      };
      img.onerror = () => setError('Could not read that image.');
      img.src = String(reader.result);
    };
    reader.onerror = () => setError('Could not read that image.');
    reader.readAsDataURL(f);
  }

  function forget() { clearSignature(); setSig(null); }

  return (
    <div className="w-full">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files)} />
      {sig && !drawing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Signature</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig.dataUrl} alt="Your saved signature" className="max-h-9 rounded border bg-white px-2 py-1" />
          <button onClick={() => setDrawing(true)} className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent">Redraw</button>
          <button onClick={forget} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-3" /> Forget
          </button>
        </div>
      ) : drawing ? (
        <div>
          <canvas
            ref={canvasRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => { penDown.current = false; }}
            onPointerLeave={() => { penDown.current = false; }}
            className="h-[120px] w-full touch-none rounded-lg border bg-white"
            aria-label="Draw your signature"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button onClick={initCanvas} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"><Eraser className="size-3" /> Clear</button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"><ImagePlus className="size-3" /> Upload instead</button>
            <button onClick={useDrawn} className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"><Check className="size-3" /> Save signature</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setDrawing(true)} className="rounded-md border px-2.5 py-1 text-xs font-semibold hover:bg-accent">Draw signature</button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"><ImagePlus className="size-3" /> Upload</button>
          <span className="text-[11px] text-muted-foreground">Stays on this device — never uploaded, never synced.</span>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
