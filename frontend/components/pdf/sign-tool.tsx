'use client';
import { useFileSession } from '@/lib/editor-session';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { useFileHandoff } from '@/lib/file-handoff';
import { Upload, FileText, X, Loader2, PenTool, Type as TypeIcon, ImagePlus, Eraser, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

// Sign PDF — draw, type, or upload a signature, then DRAG it exactly where it
// belongs on a live page preview. The placement math is shared with the
// rewrite worker (screen-style top-left fractions), so what you position is
// exactly what lands in the file. 100% on-device: the document and your
// signature never leave the browser — which is the whole point for contracts.

type Source = 'draw' | 'type' | 'upload';
type Ink = 'black' | 'blue';
const INKS: Record<Ink, string> = { black: '#111827', blue: '#1d4ed8' };

// Typed-signature styles — rendered with fonts we already bundle (@font-face
// in globals.css, OFL): Pacifico gives the classic script look.
const TYPE_FONTS = [
  { id: 'script', label: 'Signature script', css: "'Pacifico', cursive" },
  { id: 'elegant', label: 'Elegant italic', css: "italic 'Playfair Display', serif" },
  { id: 'plain', label: 'Plain', css: "'Helvetica', Arial, sans-serif" },
] as const;

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Crop a drawn canvas to its inked bounding box (plus padding) so the placed
// signature hugs the strokes instead of carrying invisible margins.
function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext('2d');
  if (!ctx) return null;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn
  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export function SignTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0); // 0-based selected page
  const [pagePreview, setPagePreview] = useState<RenderedPage | null>(null);
  const [source, setSource] = useState<Source>('draw');
  const [ink, setInk] = useState<Ink>('black');
  const [typed, setTyped] = useState('');
  const [typeFont, setTypeFont] = useState<(typeof TYPE_FONTS)[number]['id']>('script');
  const [sig, setSig] = useState<{ bytes: Uint8Array; isPng: boolean; url: string; aspect: number } | null>(null);
  const [pos, setPos] = useState({ x: 0.55, y: 0.75, w: 0.3 }); // top-left + width, fractions
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sigUploadRef = useRef<HTMLInputElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const previewBox = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  // ---- load PDF ------------------------------------------------------------
  useFileHandoff(loadOne);
  // Survive a background-tab discard: silently reload the last file.
  useFileSession('sign', file, loadOne);
  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null);
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const h = await openPdf(f);
      if (handle) void handle.destroy();
      setHandle(h);
      setPageCount(h.numPages);
      setSel(0);
      setFile(f);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
    } finally {
      setBusy(false);
    }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      void loadOne(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (handle) void handle.destroy(); }, [handle]);

  // Render the selected page for the placement preview.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setPagePreview(null);
    void renderPage(handle, sel, dprTarget(520, 2.2, 1500)).then((p) => { if (!cancelled) setPagePreview(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [handle, sel]);

  // ---- signature sources ----------------------------------------------------
  function initDrawCanvas() {
    const c = drawRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth;
    const cssH = 180;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INKS[ink];
    hasInk.current = false;
  }
  useEffect(() => {
    if (source === 'draw' && file) initDrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, file]);
  useEffect(() => {
    const ctx = drawRef.current?.getContext('2d');
    if (ctx) ctx.strokeStyle = INKS[ink];
  }, [ink]);

  function drawPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = drawRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDrawDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    hasInk.current = true;
    const { x, y } = drawPos(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function onDrawMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const { x, y } = drawPos(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function onDrawUp() { drawing.current = false; }

  function useDrawn() {
    const c = drawRef.current;
    if (!c || !hasInk.current) { setError('Draw your signature first.'); return; }
    const trimmed = trimCanvas(c);
    if (!trimmed) { setError('Draw your signature first.'); return; }
    adoptCanvas(trimmed);
  }

  async function useTyped() {
    const text = typed.trim();
    if (!text) { setError('Type your name first.'); return; }
    const font = TYPE_FONTS.find((f) => f.id === typeFont)!;
    const spec = `${font.css.startsWith('italic') ? 'italic ' : ''}72px ${font.css.replace(/^italic /, '')}`;
    try { await document.fonts.load(spec, text); } catch { /* fallback font renders instead */ }
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = spec;
    const m = ctx.measureText(text);
    c.width = Math.ceil(m.width + 40);
    c.height = 120;
    const ctx2 = c.getContext('2d')!;
    ctx2.font = spec;
    ctx2.fillStyle = INKS[ink];
    ctx2.textBaseline = 'middle';
    ctx2.fillText(text, 20, 64);
    const trimmed = trimCanvas(c) || c;
    adoptCanvas(trimmed);
  }

  function adoptCanvas(c: HTMLCanvasElement) {
    setError(null);
    c.toBlob((blob) => {
      if (!blob) return;
      void blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf);
        if (sig) URL.revokeObjectURL(sig.url);
        setSig({ bytes, isPng: true, url: URL.createObjectURL(blob), aspect: c.height / c.width });
      });
    }, 'image/png');
  }

  function pickSigImage(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
    const isJpg = /jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name);
    if (!isPng && !isJpg) { setError('Signature image must be PNG (transparent background works best) or JPG.'); return; }
    setError(null);
    void f.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      const url = URL.createObjectURL(new Blob([buf], { type: f.type }));
      const img = new Image();
      img.onload = () => {
        if (sig) URL.revokeObjectURL(sig.url);
        setSig({ bytes, isPng, url, aspect: img.naturalHeight / img.naturalWidth });
      };
      img.src = url;
    });
  }

  // ---- drag placement --------------------------------------------------------
  function onSigDown(e: React.PointerEvent<HTMLDivElement>) {
    const box = previewBox.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - r.left - pos.x * r.width, dy: e.clientY - r.top - pos.y * r.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onSigMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragOffset.current || !previewBox.current || !sig) return;
    const r = previewBox.current.getBoundingClientRect();
    const hFrac = pos.w * sig.aspect * (r.width / r.height);
    const x = Math.min(Math.max((e.clientX - r.left - dragOffset.current.dx) / r.width, 0), 1 - pos.w);
    const y = Math.min(Math.max((e.clientY - r.top - dragOffset.current.dy) / r.height, 0), Math.max(0, 1 - hFrac));
    setPos((p) => ({ ...p, x, y }));
  }
  function onSigUp() { dragOffset.current = null; }

  // ---- apply -----------------------------------------------------------------
  async function apply() {
    if (!file || !sig) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      const out = await rewritePdf(file, {
        type: 'place-image',
        opts: { pageNo: sel + 1, xFrac: pos.x, yFrac: pos.y, wFrac: pos.w, imageBytes: sig.bytes.slice().buffer, isPng: sig.isPng },
      });
      const name = `${file.name.replace(/\.pdf$/i, '')}-signed.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign the PDF.');
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (id: Source, icon: React.ReactNode, label: string) => (
    <button key={id} onClick={() => setSource(id)} aria-pressed={source === id}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium transition-all ${source === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
      {icon} {label}
    </button>
  );

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        <input ref={sigUploadRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { pickSigImage(e.target.files); e.currentTarget.value = ''; }} />
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}

        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Draw, type, or upload your signature — the document never leaves your device</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setSig(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            {/* Signature builder */}
            <div>
              <div className="grid grid-cols-3 gap-2">
                {tabBtn('draw', <PenTool className="size-4" />, 'Draw')}
                {tabBtn('type', <TypeIcon className="size-4" />, 'Type')}
                {tabBtn('upload', <ImagePlus className="size-4" />, 'Upload')}
              </div>

              {source === 'draw' && (
                <div className="mt-3">
                  <canvas
                    ref={drawRef}
                    className="h-[180px] w-full cursor-crosshair touch-none rounded-xl border bg-white"
                    onPointerDown={onDrawDown}
                    onPointerMove={onDrawMove}
                    onPointerUp={onDrawUp}
                    onPointerLeave={onDrawUp}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    {(Object.keys(INKS) as Ink[]).map((i2) => (
                      <button key={i2} onClick={() => setInk(i2)} aria-label={`${i2} ink`} aria-pressed={ink === i2}
                        className={`size-7 rounded-full border-2 ${ink === i2 ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                        style={{ backgroundColor: INKS[i2] }} />
                    ))}
                    <Button size="sm" variant="outline" onClick={initDrawCanvas}><Eraser className="size-4" /> Clear</Button>
                    <Button size="sm" className="ml-auto" onClick={useDrawn}><Check className="size-4" /> Use signature</Button>
                  </div>
                </div>
              )}

              {source === 'type' && (
                <div className="mt-3 space-y-2">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={40} placeholder="Type your full name"
                    className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
                  <div className="grid grid-cols-3 gap-2">
                    {TYPE_FONTS.map((f2) => (
                      <button key={f2.id} onClick={() => setTypeFont(f2.id)} aria-pressed={typeFont === f2.id}
                        className={`truncate rounded-lg border px-2 py-2 text-[15px] transition-all ${typeFont === f2.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}
                        style={{ fontFamily: f2.css.replace(/^italic /, ''), fontStyle: f2.css.startsWith('italic') ? 'italic' : 'normal' }}>
                        {typed.trim() || 'Your name'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {(Object.keys(INKS) as Ink[]).map((i2) => (
                      <button key={i2} onClick={() => setInk(i2)} aria-label={`${i2} ink`} aria-pressed={ink === i2}
                        className={`size-7 rounded-full border-2 ${ink === i2 ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                        style={{ backgroundColor: INKS[i2] }} />
                    ))}
                    <Button size="sm" className="ml-auto" onClick={() => void useTyped()}><Check className="size-4" /> Use signature</Button>
                  </div>
                </div>
              )}

              {source === 'upload' && (
                <div className="mt-3">
                  <Button variant="outline" onClick={() => sigUploadRef.current?.click()}><ImagePlus className="size-4" /> Choose signature image</Button>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">A PNG with a transparent background works best — a photo of your signature on white paper works too.</p>
                </div>
              )}

              {sig && (
                <div className="mt-3 rounded-xl border bg-muted/30 p-3">
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Current signature — drag it into place on the page</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sig.url} alt="Your signature" className="max-h-16" />
                  <label className="mt-2 block text-xs font-medium">
                    Size · {Math.round(pos.w * 100)}% of page width
                    <input type="range" min={8} max={60} value={Math.round(pos.w * 100)}
                      onChange={(e) => setPos((p) => ({ ...p, w: Number(e.target.value) / 100 }))} className="dd-range mt-1 w-full" />
                  </label>
                </div>
              )}
            </div>

            {/* Page preview + placement */}
            <div>
              <div className="relative flex items-start justify-center rounded-xl border bg-muted/30 p-3">
                {pagePreview ? (
                  <div ref={previewBox} className="relative inline-block" onPointerMove={onSigMove} onPointerUp={onSigUp}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pagePreview.url} alt={`Page ${sel + 1} preview`} className="max-h-[32rem] rounded border bg-white shadow-md" draggable={false} />
                    {sig && (
                      <div
                        onPointerDown={onSigDown}
                        className="absolute cursor-move rounded border-2 border-dashed border-primary/70 bg-primary/5 hover:bg-primary/10"
                        style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${pos.w * 100}%` }}
                        role="button"
                        aria-label="Drag to position the signature"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sig.url} alt="" className="pointer-events-none w-full select-none" draggable={false} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                )}
              </div>
              {pageCount > 1 && (
                <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={setSel} className="mt-2" />
              )}
              {!sig && <p className="mt-2 text-center text-xs text-muted-foreground">Create a signature on the left, then drag it anywhere on the page.</p>}
            </div>
          </div>
        )}

        {error && <UploadError error={error} />}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={busy || !sig}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Signing…</> : <><PenTool className="size-4" /> Sign page {sel + 1} &amp; download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/sign-pdf" fromLabel="Sign PDF" />}
      </CardContent>
    </Card>
  );
}
