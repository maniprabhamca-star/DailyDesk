'use client';

import { useEffect, useRef, useState } from 'react';
import { PenTool, Type as TypeIcon, ImagePlus, Eraser, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Reusable signature builder (draw / type / upload) — the same approach as the
// Sign PDF tool, packaged as a modal so Annotate can drop a signature onto the
// page. Returns a trimmed PNG data URL + its aspect ratio (h/w). 100% on-device.

type Source = 'draw' | 'type' | 'upload';
type Ink = 'black' | 'blue';
const INKS: Record<Ink, string> = { black: '#111827', blue: '#1d4ed8' };
const TYPE_FONTS = [
  { id: 'script', label: 'Script', css: "'Pacifico', cursive" },
  { id: 'signature', label: 'Signature', css: "'Dancing Script', cursive" },
  { id: 'elegant', label: 'Elegant', css: "italic 'Playfair Display', serif" },
  { id: 'plain', label: 'Plain', css: "'Helvetica', Arial, sans-serif" },
] as const;

// Crop a canvas to its inked bounding box (+pad) so the signature hugs the ink.
function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext('2d');
  if (!ctx) return null;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 10) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null;
  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export function SignatureMaker({ onClose, onCreate }: { onClose: () => void; onCreate: (dataUrl: string, aspect: number) => void }) {
  const [source, setSource] = useState<Source>('draw');
  const [ink, setInk] = useState<Ink>('black');
  const [typed, setTyped] = useState('');
  const [typeFont, setTypeFont] = useState<(typeof TYPE_FONTS)[number]['id']>('signature');
  const [err, setErr] = useState<string | null>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  function initDraw() {
    const c = drawRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(200 * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INKS[ink];
    hasInk.current = false;
  }
  useEffect(() => { if (source === 'draw') initDraw(); /* eslint-disable-next-line */ }, [source]);
  useEffect(() => { const ctx = drawRef.current?.getContext('2d'); if (ctx) ctx.strokeStyle = INKS[ink]; }, [ink]);

  function dpos(e: React.PointerEvent<HTMLCanvasElement>) { const r = drawRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function down(e: React.PointerEvent<HTMLCanvasElement>) { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; hasInk.current = true; const { x, y } = dpos(e); const ctx = e.currentTarget.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); }
  function move(e: React.PointerEvent<HTMLCanvasElement>) { if (!drawing.current) return; const { x, y } = dpos(e); const ctx = e.currentTarget.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); }
  function up() { drawing.current = false; }

  function adopt(c: HTMLCanvasElement) { onCreate(c.toDataURL('image/png'), c.height / c.width); onClose(); }

  function useDrawn() { const c = drawRef.current; if (!c || !hasInk.current) { setErr('Draw your signature first.'); return; } const t = trimCanvas(c); if (!t) { setErr('Draw your signature first.'); return; } adopt(t); }
  async function useTyped() {
    const text = typed.trim(); if (!text) { setErr('Type your name first.'); return; }
    const font = TYPE_FONTS.find((f) => f.id === typeFont)!;
    const spec = `${font.css.startsWith('italic') ? 'italic ' : ''}72px ${font.css.replace(/^italic /, '')}`;
    try { await document.fonts.load(spec, text); } catch { /* fallback renders */ }
    const c = document.createElement('canvas'); const m = c.getContext('2d')!; m.font = spec;
    c.width = Math.ceil(m.measureText(text).width + 40); c.height = 120;
    const ctx = c.getContext('2d')!; ctx.font = spec; ctx.fillStyle = INKS[ink]; ctx.textBaseline = 'middle'; ctx.fillText(text, 20, 64);
    adopt(trimCanvas(c) || c);
  }
  function useUpload(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    if (!/^image\/(png|jpe?g)$/i.test(f.type) && !/\.(png|jpe?g)$/i.test(f.name)) { setErr('Use a PNG (transparent works best) or JPG.'); return; }
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); const img = new Image(); img.onload = () => onCreate(url, img.naturalHeight / img.naturalWidth); img.onerror = () => setErr('Could not read that image.'); img.src = url; onClose(); };
    reader.readAsDataURL(f);
  }

  const tab = (id: Source, icon: React.ReactNode, label: string) => (
    <button onClick={() => { setSource(id); setErr(null); }} aria-pressed={source === id}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium transition-all ${source === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onPointerDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-lift" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Add a signature</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <input ref={uploadRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { useUpload(e.target.files); e.currentTarget.value = ''; }} />
        <div className="grid grid-cols-3 gap-2">
          {tab('draw', <PenTool className="size-4" />, 'Draw')}
          {tab('type', <TypeIcon className="size-4" />, 'Type')}
          {tab('upload', <ImagePlus className="size-4" />, 'Upload')}
        </div>

        {source === 'draw' && (
          <div className="mt-3">
            <canvas ref={drawRef} className="h-[200px] w-full cursor-crosshair touch-none rounded-xl border bg-white" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
            <div className="mt-2 flex items-center gap-2">
              {(Object.keys(INKS) as Ink[]).map((i) => (
                <button key={i} onClick={() => setInk(i)} aria-label={`${i} ink`} aria-pressed={ink === i} className={`size-7 rounded-full border-2 ${ink === i ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`} style={{ backgroundColor: INKS[i] }} />
              ))}
              <Button size="sm" variant="outline" onClick={initDraw}><Eraser className="size-4" /> Clear</Button>
              <Button size="sm" className="ml-auto" onClick={useDrawn}><Check className="size-4" /> Add</Button>
            </div>
          </div>
        )}

        {source === 'type' && (
          <div className="mt-3 space-y-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={40} placeholder="Type your full name" className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
            <div className="grid grid-cols-2 gap-2">
              {TYPE_FONTS.map((f) => (
                <button key={f.id} onClick={() => setTypeFont(f.id)} aria-pressed={typeFont === f.id}
                  className={`truncate rounded-lg border px-2 py-2 text-[17px] transition-all ${typeFont === f.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}
                  style={{ fontFamily: f.css.replace(/^italic /, ''), fontStyle: f.css.startsWith('italic') ? 'italic' : 'normal' }}>
                  {typed.trim() || 'Your name'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {(Object.keys(INKS) as Ink[]).map((i) => (
                <button key={i} onClick={() => setInk(i)} aria-label={`${i} ink`} aria-pressed={ink === i} className={`size-7 rounded-full border-2 ${ink === i ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`} style={{ backgroundColor: INKS[i] }} />
              ))}
              <Button size="sm" className="ml-auto" onClick={() => void useTyped()}><Check className="size-4" /> Add</Button>
            </div>
          </div>
        )}

        {source === 'upload' && (
          <div className="mt-3">
            <Button variant="outline" onClick={() => uploadRef.current?.click()}><ImagePlus className="size-4" /> Choose signature image</Button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">A PNG with a transparent background works best — a photo of your signature on white paper works too.</p>
          </div>
        )}

        {err && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}
