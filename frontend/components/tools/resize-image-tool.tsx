'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, ImageIcon, CheckCircle2, RotateCcw, Link2, Unlink2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { decodeImage, resample, encodeCanvas, canEncodeWebp, detectFormat, type OutFormat } from '@/lib/image-convert';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

const MAX_DIM = 12000; // sanity cap either side

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls = 'h-10 w-full rounded-lg border bg-background px-3 text-sm tabular-nums outline-none focus:border-primary';
const PRESETS = [1920, 1280, 800, 640];

export function ResizeImageTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [locked, setLocked] = useState(true);
  const [format, setFormat] = useState<OutFormat>('jpg');
  const [quality, setQuality] = useState(85);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; url: string; w: number; h: number; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    setBusy(true);
    try {
      const bm = await decodeImage(f);
      if (bitmap) bitmap.close();
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      setBitmap(bm);
      setSrcUrl(URL.createObjectURL(f));
      setW(bm.width);
      setH(bm.height);
      const df = detectFormat(f);
      setFormat(df === 'other' ? 'jpg' : df === 'webp' && !webpOk ? 'jpg' : df);
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

  function setWidth(v: number) {
    const nw = Math.min(Math.max(1, Math.round(v) || 1), MAX_DIM);
    setW(nw);
    if (locked && bitmap) setH(Math.min(MAX_DIM, Math.max(1, Math.round((bitmap.height / bitmap.width) * nw))));
  }
  function setHeight(v: number) {
    const nh = Math.min(Math.max(1, Math.round(v) || 1), MAX_DIM);
    setH(nh);
    if (locked && bitmap) setW(Math.min(MAX_DIM, Math.max(1, Math.round((bitmap.width / bitmap.height) * nh))));
  }
  function applyPercent(pct: number) {
    if (!bitmap) return;
    setW(Math.max(1, Math.round((bitmap.width * pct) / 100)));
    setH(Math.max(1, Math.round((bitmap.height * pct) / 100)));
  }

  async function run() {
    if (!file || !bitmap) return;
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      const canvas = resample(bitmap, w, h);
      const blob = await encodeCanvas(canvas, format, quality);
      canvas.width = 0; canvas.height = 0;
      const name = `${file.name.replace(/\.[^.]+$/, '')}-${w}x${h}.${format}`;
      download(blob, name);
      if (done) URL.revokeObjectURL(done.url);
      setDone({ blob, name, url: URL.createObjectURL(blob), w, h, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resize the image.');
    } finally {
      setBusy(false);
    }
  }

  const upscaling = bitmap ? w > bitmap.width || h > bitmap.height : false;

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
            <p className="text-xs text-muted-foreground">Exact pixels, percentages, or presets — resized on your device</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose image</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            {srcUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={srcUrl} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{bitmap ? `${bitmap.width}×${bitmap.height} · ` : ''}{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (bitmap) bitmap.close(); setBitmap(null); setFile(null); setDone(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && bitmap && !done && (
          <div className="mt-4 space-y-4">
            <div className="flex items-end gap-2">
              <label className="flex-1 text-sm">
                <span className="mb-1.5 block font-medium">Width (px)</span>
                <input className={inputCls} type="number" min={1} max={MAX_DIM} value={w} onChange={(e) => setWidth(Number(e.target.value))} inputMode="numeric" />
              </label>
              <button
                type="button"
                onClick={() => setLocked(!locked)}
                aria-pressed={locked}
                title={locked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                className={`mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all ${locked ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                {locked ? <Link2 className="size-4" /> : <Unlink2 className="size-4" />}
              </button>
              <label className="flex-1 text-sm">
                <span className="mb-1.5 block font-medium">Height (px)</span>
                <input className={inputCls} type="number" min={1} max={MAX_DIM} value={h} onChange={(e) => setHeight(Number(e.target.value))} inputMode="numeric" />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setWidth(p)} className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary/40">{p}px wide</button>
              ))}
              {[75, 50, 25].map((p) => (
                <button key={p} onClick={() => applyPercent(p)} className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary/40">{p}%</button>
              ))}
              <button onClick={() => { setW(bitmap.width); setH(bitmap.height); }} className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary/40">Original</button>
            </div>
            {upscaling && <p className="text-xs text-amber-600">Heads up: that’s larger than the original ({bitmap.width}×{bitmap.height}) — upscaling can’t add real detail.</p>}

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

        {file && bitmap && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Resizing…</> : <><ImageIcon className="size-4" /> Resize to {w}×{h} &amp; download</>}
          </Button>
        )}

        {done && (
          <>
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Resized — {done.name} saved</p>
                <p className="text-xs text-muted-foreground">{done.w}×{done.h} · {fmt(done.blob.size)} (was {fmt(file?.size || 0)}) · {formatDuration(done.secs)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDone(null)}><RotateCcw className="size-4" /> Again</Button>
                <Button size="sm" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download</Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center rounded-xl border bg-muted/30 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={done.url} alt="Resized result" className="max-h-64 rounded border bg-white shadow-sm" />
            </div>
            <KeepGoing exclude="/resize-image" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
