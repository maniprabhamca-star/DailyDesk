'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, Search, Info, RotateCcw, ImagePlus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { BigFileHint } from '@/components/app/big-file-hint';
import { KeepGoing } from '@/components/app/keep-going';
import { PASSPORT_SPECS, SPEC_GROUPS, isVerified, type PassportSpec } from '@/lib/passport-specs';
import { renderPassport, prepareCutout, buildPrintSheet, type Crop } from '@/lib/passport-photo';

const FRAME_W = 232;

const BG_SWATCHES: { id: string; name: string; color: string | null }[] = [
  { id: 'keep', name: 'Keep', color: null },
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'offwhite', name: 'Off-white', color: '#f3f3f0' },
  { id: 'lightblue', name: 'Light blue', color: '#dbe7f5' },
  { id: 'grey', name: 'Grey', color: '#e9e9e7' },
];

function fmtKB(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Progressive enhancement: where the browser exposes the Shape Detection API
// (Chrome/Edge), auto-place the head between the guides at the spec's head size.
// Any failure / unsupported browser → returns null and we keep manual placement.
async function autoPlaceFace(bmp: ImageBitmap, spec: PassportSpec, frameH: number): Promise<{ zoom: number; off: { x: number; y: number } } | null> {
  try {
    const FD = (window as unknown as { FaceDetector?: new (o?: object) => { detect: (i: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
    if (!FD) return null;
    const faces = await new FD({ fastMode: true, maxDetectedFaces: 1 }).detect(bmp);
    if (!faces || !faces.length) return null;
    const b = faces[0].boundingBox;
    const headH = b.height * 1.45;               // crown→chin ≈ 1.45× the face box
    const headTop = b.y - b.height * 0.35;
    const headCx = b.x + b.width / 2;
    const hf = (spec.headMin + spec.headMax) / 2; // desired head fraction of output
    const sh = headH / hf;
    const sw = sh * (FRAME_W / frameH);
    const sy = headTop - 0.08 * sh;               // crown ~8% from the top
    const sx = headCx - sw / 2;
    const cover = Math.max(FRAME_W / bmp.width, frameH / bmp.height);
    const zoom = Math.min(4, Math.max(1, (FRAME_W / sw) / cover));
    const scale = cover * zoom;
    return { zoom, off: { x: -sx * scale, y: -sy * scale } };
  } catch { return null; }
}

export function PassportPhotoTool() {
  const [spec, setSpec] = useState<PassportSpec>(PASSPORT_SPECS[0]);
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [srcBmp, setSrcBmp] = useState<ImageBitmap | null>(null);
  const [cutout, setCutout] = useState<ImageBitmap | null>(null);
  const [bgId, setBgId] = useState<string>('keep');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [bgBusy, setBgBusy] = useState(false);
  const [bgMsg, setBgMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const [autoPlaced, setAutoPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; size: number; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const frameH = Math.round((FRAME_W * spec.hPx) / spec.wPx);
  const bg = BG_SWATCHES.find((s) => s.id === bgId) || BG_SWATCHES[0];
  const swap = bgId !== 'keep' && !!cutout;
  const source = swap ? cutout : srcBmp;

  // cover-fit scale then zoom
  const geom = useMemo(() => {
    if (!srcBmp) return null;
    const cover = Math.max(FRAME_W / srcBmp.width, frameH / srcBmp.height);
    const scale = cover * zoom;
    return { scale, dispW: srcBmp.width * scale, dispH: srcBmp.height * scale };
  }, [srcBmp, zoom, frameH]);

  const clampOffset = useCallback((o: { x: number; y: number }, dispW: number, dispH: number) => ({
    x: Math.min(0, Math.max(FRAME_W - dispW, o.x)),
    y: Math.min(0, Math.max(frameH - dispH, o.y)),
  }), [frameH]);

  const cropOf = useCallback((): Crop | null => {
    if (!geom) return null;
    return { sx: -offset.x / geom.scale, sy: -offset.y / geom.scale, sw: FRAME_W / geom.scale, sh: frameH / geom.scale };
  }, [geom, offset, frameH]);

  // redraw preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geom || !source) return;
    canvas.width = FRAME_W * 2; canvas.height = frameH * 2;
    const cx = canvas.getContext('2d');
    if (!cx) return;
    cx.setTransform(2, 0, 0, 2, 0, 0);
    cx.fillStyle = swap ? (bg.color || '#fff') : '#e5e7eb';
    cx.fillRect(0, 0, FRAME_W, frameH);
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(source, offset.x, offset.y, geom.dispW, geom.dispH);
  }, [source, geom, offset, frameH, swap, bg.color]);

  async function loadFile(f?: File) {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) {
      setError('Please choose a photo (JPG, PNG, or WebP).');
      return;
    }
    setError(null); setResult(null); setCutout(null); setBgId('keep'); setZoom(1); setAutoPlaced(false);
    try {
      const bmp = await createImageBitmap(f);
      setSrcBmp(bmp);
      setFile(f);
      const cover = Math.max(FRAME_W / bmp.width, frameH / bmp.height);
      let off = { x: (FRAME_W - bmp.width * cover) / 2, y: (frameH - bmp.height * cover) / 2 };
      let z = 1;
      const auto = await autoPlaceFace(bmp, spec, frameH);
      if (auto) { z = auto.zoom; off = clampOffset(auto.off, bmp.width * cover * z, bmp.height * cover * z); setAutoPlaced(true); }
      setZoom(z); setOffset(off);
    } catch {
      setError('Could not read that photo. Try a JPG or PNG.');
    }
  }

  function pickSpec(s: PassportSpec) {
    setSpec(s); setResult(null); setZoom(1);
    if (srcBmp) {
      const fh = Math.round((FRAME_W * s.hPx) / s.wPx);
      const cover = Math.max(FRAME_W / srcBmp.width, fh / srcBmp.height);
      setOffset({ x: (FRAME_W - srcBmp.width * cover) / 2, y: (fh - srcBmp.height * cover) / 2 });
    }
  }

  async function pickBg(id: string) {
    setResult(null);
    if (id === 'keep') { setBgId('keep'); return; }
    if (!cutout && file) {
      setBgBusy(true); setBgMsg('Removing background…');
      try {
        const co = await prepareCutout(file, (p) => setBgMsg(`Removing background… ${Math.round(p.pct)}%`));
        setCutout(co);
      } catch {
        setError('Background removal failed — you can still use “Keep”.');
        setBgBusy(false); return;
      }
      setBgBusy(false); setBgMsg('');
    }
    setBgId(id);
  }

  function onZoom(v: number) {
    if (!srcBmp) return;
    const cover = Math.max(FRAME_W / srcBmp.width, frameH / srcBmp.height);
    const scale = cover * v;
    setZoom(v);
    setOffset((o) => clampOffset(o, srcBmp.width * scale, srcBmp.height * scale));
  }

  function onDown(e: React.PointerEvent) {
    if (!geom) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !geom) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOffset(clampOffset({ x: nx, y: ny }, geom.dispW, geom.dispH));
  }
  function onUp() { drag.current = null; }

  async function exportPhoto() {
    const crop = cropOf();
    if (!source || !crop) return;
    setExporting(true); setError(null);
    try {
      const blob = await renderPassport({ source, spec, crop, bg: bg.color || '#ffffff' });
      const url = URL.createObjectURL(blob);
      setResult((r) => { if (r) URL.revokeObjectURL(r.url); return { url, blob, size: blob.size, name: `${spec.id}-photo.jpg` }; });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the photo.');
    } finally { setExporting(false); }
  }

  async function exportSheet() {
    const crop = cropOf();
    if (!source || !crop) return;
    setExporting(true); setError(null);
    try {
      const photo = await renderPassport({ source, spec, crop, bg: bg.color || '#ffffff' });
      const { blob, copies } = await buildPrintSheet(photo, spec);
      download(blob, `${spec.id}-print-sheet-${copies}up.jpg`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the print sheet.');
    } finally { setExporting(false); }
  }

  function reset() {
    setFile(null); setSrcBmp(null); setCutout(null); setResult(null); setError(null); setBgId('keep'); setZoom(1);
    if (inputRef.current) inputRef.current.value = '';
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PASSPORT_SPECS.filter((s) => !q || s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q));
  }, [query]);
  const popular = PASSPORT_SPECS.filter((s) => s.group === 'Popular');

  return (
    <div className="mx-auto max-w-2xl">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />

      {/* Country / document */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Country &amp; document</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {popular.map((s) => (
          <button key={s.id} type="button" onClick={() => pickSpec(s)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${spec.id === s.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search 45+ countries…"
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm" />
      </div>
      {query.trim() && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border bg-card">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No match. Try a country name.</p>
          ) : filtered.map((s) => (
            <button key={s.id} type="button" onClick={() => { pickSpec(s); setQuery(''); }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60 ${spec.id === s.id ? 'bg-primary/10' : ''}`}>
              <span className="font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.wMM}×{s.hMM} mm · {s.bgName}</span>
            </button>
          ))}
        </div>
      )}

      {!file ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="mt-4 flex w-full flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-12 text-center transition hover:border-primary/50 hover:bg-muted/30">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><ImagePlus className="size-6 text-muted-foreground" /></span>
          <span className="mt-4 text-sm font-medium">Drop your photo here, or click to choose</span>
          <span className="mt-1 text-xs text-muted-foreground">Face the camera on a plain wall · your photo never leaves your device</span>
        </button>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-[232px_1fr]">
          {/* preview */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative touch-none select-none rounded-md border shadow-sm" style={{ width: FRAME_W, height: frameH }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
              <canvas ref={canvasRef} style={{ width: FRAME_W, height: frameH, cursor: 'grab', borderRadius: 5 }} />
              {/* head guides */}
              <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-primary/70" style={{ top: frameH * 0.08 }}>
                <span className="absolute right-1 -top-4 rounded bg-background/90 px-1 text-[10px] font-bold text-primary">crown</span>
              </div>
              <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-primary/70" style={{ top: frameH * (0.08 + (spec.headMin + spec.headMax) / 2) }}>
                <span className="absolute right-1 -top-4 rounded bg-background/90 px-1 text-[10px] font-bold text-primary">chin</span>
              </div>
              {bgBusy && <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70 text-xs font-medium"><Loader2 className="mr-1.5 size-4 animate-spin" /> {bgMsg}</div>}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">{autoPlaced ? '✓ Auto-positioned — drag or zoom to fine-tune' : 'Drag to move · line your head up with the guides'}</p>
            <input type="range" min={1} max={4} step={0.02} value={zoom} onChange={(e) => onZoom(parseFloat(e.target.value))} className="w-full" aria-label="Zoom" />
          </div>

          {/* controls */}
          <div>
            <p className="text-sm font-semibold">{spec.label}</p>
            <p className="text-xs text-muted-foreground">{spec.wPx}×{spec.hPx} px · {spec.wMM}×{spec.hMM} mm{spec.maxKB ? ` · ≤${spec.maxKB >= 1024 ? `${spec.maxKB / 1024} MB` : `${spec.maxKB} KB`}` : ''} · {spec.bgName} background</p>
            <p className="mt-0.5 text-[11px]">{isVerified(spec.id) ? <span className="text-emerald-600 dark:text-emerald-400">✓ Spec checked against an official source</span> : <span className="text-muted-foreground">Standard ICAO spec — double-check your portal’s exact rules</span>}</p>

            <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background</p>
            <div className="flex flex-wrap gap-2.5">
              {BG_SWATCHES.map((s) => (
                <button key={s.id} type="button" onClick={() => pickBg(s.id)} title={s.name} disabled={bgBusy}
                  className={`relative size-9 rounded-lg border ${bgId === s.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  style={{ background: s.color || 'repeating-conic-gradient(#e5e7eb 0% 25%, #f7f7f5 0% 50%) 50% / 12px 12px' }}>
                  {!s.color && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-muted-foreground">Keep</span>}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Recommended: <b className="text-foreground">{spec.bgName}</b>. Swapping runs our background remover on your device.</p>

            {file && <BigFileHint bytes={file.size} weight="light" />}
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            {result ? (
              <div className="mt-4 rounded-xl border bg-card p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="flex items-center gap-3">
                  <img src={result.url} alt="Your passport photo" className="h-24 rounded border" />
                  <div>
                    <p className="text-sm font-semibold">Ready — {fmtKB(result.size)}</p>
                    <p className="text-xs text-muted-foreground">{spec.wPx}×{spec.hPx} px · meets {spec.label}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="flex-1" onClick={() => download(result.blob, result.name)}><Download className="size-4" /> Download photo</Button>
                  <Button variant="outline" onClick={exportSheet} disabled={exporting}>{exporting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} Print sheet (4×6)</Button>
                  <Button variant="ghost" onClick={() => setResult(null)}><RotateCcw className="size-4" /> Adjust</Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button className="flex-1" size="lg" onClick={exportPhoto} disabled={exporting || bgBusy}>
                  {exporting ? <><Loader2 className="size-4 animate-spin" /> Building…</> : <><Download className="size-4" /> Make photo</>}
                </Button>
                <Button variant="ghost" onClick={reset}><X className="size-4" /> New photo</Button>
              </div>
            )}

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span><b className="text-foreground">On your device:</b> we crop to the exact size {spec.label} needs, swap the background if you choose, and hit the file-size limit — all in your browser. Your photo is never uploaded. Always double-check your portal’s exact rules.</span>
            </p>
          </div>
        </div>
      )}

      <KeepGoing />
    </div>
  );
}
