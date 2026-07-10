'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, Crop, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { decodeImage, encodeCanvas, canEncodeWebp, detectFormat, type OutFormat } from '@/lib/image-convert';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

// Crop image — a real draggable/resizable crop box on the photo itself, with
// aspect presets. All fractions of the displayed image, applied to the
// natural resolution on export, so what you frame is exactly what you get.
// 100% on-device.

type Box = { x: number; y: number; w: number; h: number }; // fractions of the image
type Aspect = 'free' | '1:1' | '4:3' | '16:9' | '3:2';
const ASPECTS: Record<Exclude<Aspect, 'free'>, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '3:2': 3 / 2 };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CropImageTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [aspect, setAspect] = useState<Aspect>('free');
  const [format, setFormat] = useState<OutFormat>('jpg');
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; url: string; w: number; h: number; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ mode: 'move' | 'resize'; dx: number; dy: number } | null>(null);
  const webpOk = typeof window !== 'undefined' && canEncodeWebp();

  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); if (done) URL.revokeObjectURL(done.url); }, [srcUrl, done]);

  async function loadOne(f?: File) {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)) {
      setError('Please choose an image (JPG, PNG, WebP, GIF, or BMP).');
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null);
    setError(null);
    setDone(null);
    try {
      const bm = await decodeImage(f);
      setNat({ w: bm.width, h: bm.height });
      bm.close();
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      setSrcUrl(URL.createObjectURL(f));
      setBox({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
      const df = detectFormat(f);
      setFormat(df === 'other' ? 'jpg' : df === 'webp' && !webpOk ? 'jpg' : df);
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

  // Aspect (in image-fraction space): hFrac = wFrac * (natW / natH) / ratio.
  function heightFor(wFrac: number, ratio: number): number {
    return (wFrac * nat.w) / ratio / nat.h;
  }
  function applyAspect(a: Aspect) {
    setAspect(a);
    if (a === 'free' || !nat.w) return;
    setBox((b) => {
      let w = b.w;
      let h = heightFor(w, ASPECTS[a]);
      if (b.y + h > 1) { h = 1 - b.y; w = (h * nat.h * ASPECTS[a]) / nat.w; }
      return { ...b, w, h };
    });
  }

  function framePos(e: React.PointerEvent): { x: number; y: number } | null {
    const r = frameRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function onBoxDown(e: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    e.stopPropagation();
    const p = framePos(e);
    if (!p) return;
    gesture.current = mode === 'move' ? { mode, dx: p.x - box.x, dy: p.y - box.y } : { mode, dx: 0, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onFrameMove(e: React.PointerEvent) {
    const g = gesture.current;
    const p = framePos(e);
    if (!g || !p) return;
    setBox((b) => {
      if (g.mode === 'move') {
        return {
          ...b,
          x: Math.min(Math.max(p.x - g.dx, 0), 1 - b.w),
          y: Math.min(Math.max(p.y - g.dy, 0), 1 - b.h),
        };
      }
      // resize from the SE corner
      let w = Math.min(Math.max(p.x - b.x, 0.05), 1 - b.x);
      let h = Math.min(Math.max(p.y - b.y, 0.05), 1 - b.y);
      if (aspect !== 'free' && nat.w) {
        h = heightFor(w, ASPECTS[aspect]);
        if (b.y + h > 1) { h = 1 - b.y; w = (h * nat.h * ASPECTS[aspect]) / nat.w; }
      }
      return { ...b, w, h };
    });
  }
  function onFrameUp() { gesture.current = null; }

  const outW = Math.max(1, Math.round(box.w * nat.w));
  const outH = Math.max(1, Math.round(box.h * nat.h));

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      const bm = await decodeImage(file);
      const sx = Math.round(box.x * bm.width);
      const sy = Math.round(box.y * bm.height);
      const sw = Math.max(1, Math.round(box.w * bm.width));
      const sh = Math.max(1, Math.round(box.h * bm.height));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d')!.drawImage(bm, sx, sy, sw, sh, 0, 0, sw, sh);
      bm.close();
      const blob = await encodeCanvas(canvas, format, quality);
      canvas.width = 0; canvas.height = 0;
      const name = `${file.name.replace(/\.[^.]+$/, '')}-cropped.${format}`;
      download(blob, name);
      if (done) URL.revokeObjectURL(done.url);
      setDone({ blob, name, url: URL.createObjectURL(blob), w: sw, h: sh, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not crop the image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
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
            <p className="mt-2 text-sm font-medium">Drop an image here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Drag the crop box exactly where you want it — cropped on your device</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose image</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{nat.w}×{nat.h} · {fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && srcUrl && !done && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['free', '1:1', '4:3', '16:9', '3:2'] as Aspect[]).map((a) => (
                <button key={a} onClick={() => applyAspect(a)} aria-pressed={aspect === a}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${aspect === a ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                  {a === 'free' ? 'Free' : a}
                </button>
              ))}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">Output: {outW}×{outH}px</span>
            </div>

            <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-3">
              <div ref={frameRef} className="relative inline-block touch-none select-none" onPointerMove={onFrameMove} onPointerUp={onFrameUp}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={srcUrl} alt="Image to crop" className="max-h-[28rem] rounded" draggable={false} />
                {/* dimmed outside area via huge box-shadow on the crop box */}
                <div
                  onPointerDown={(e) => onBoxDown(e, 'move')}
                  className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] outline outline-1 outline-black/30"
                  style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
                  role="button"
                  aria-label="Drag to move the crop area"
                >
                  <span
                    onPointerDown={(e) => onBoxDown(e, 'resize')}
                    className="absolute -bottom-2 -right-2 size-4 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow"
                    role="button"
                    aria-label="Drag to resize the crop area"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Output format</span>
                <select className="h-10 w-full rounded-lg border bg-card px-2 text-sm font-medium outline-none focus:border-primary" value={format} onChange={(e) => setFormat(e.target.value as OutFormat)}>
                  <option value="jpg">JPG — small, opens everywhere</option>
                  <option value="png">PNG — lossless, keeps transparency</option>
                  {webpOk && <option value="webp">WebP — smallest, modern</option>}
                </select>
              </label>
              {format !== 'png' && (
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Quality · {quality}</span>
                  <input type="range" min={50} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="dd-range mt-3 w-full" />
                </label>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Cropping…</> : <><Crop className="size-4" /> Crop to {outW}×{outH} &amp; download</>}
          </Button>
        )}

        {done && (
          <>
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Cropped — {done.name} saved</p>
                <p className="text-xs text-muted-foreground">{done.w}×{done.h} · {fmt(done.blob.size)} · {formatDuration(done.secs)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDone(null)}><RotateCcw className="size-4" /> Adjust again</Button>
                <Button size="sm" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download</Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center rounded-xl border bg-muted/30 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={done.url} alt="Cropped result" className="max-h-64 rounded border bg-white shadow-sm" />
            </div>
            <KeepGoing exclude="/crop-image" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
