'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, Repeat, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { decodeImage, encodeCanvas, canEncodeWebp, detectFormat, buildPreviewCanvas, canvasToPngBlob, convertImageFile, type OutFormat } from '@/lib/image-convert';
import { BatchRunner } from '@/components/app/batch-runner';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { BeforeAfter } from '@/components/pdf/before-after';
import { useQualityPreview } from '@/lib/use-quality-preview';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ConvertImageTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]); // several images dropped → Pro on-device batch
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [srcFormat, setSrcFormat] = useState<string>('');
  const [dims, setDims] = useState('');
  const [format, setFormat] = useState<OutFormat>('png');
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; url: string; secs: number } | null>(null);
  // Live pre-run quality preview (lossy targets only): a capped source canvas
  // re-encoded at the selected format/quality, next to the original.
  const [beforePrev, setBeforePrev] = useState<{ url: string; w: number; h: number } | null>(null);
  const prevCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const webpOk = typeof window !== 'undefined' && canEncodeWebp();

  useEffect(() => () => { if (done) URL.revokeObjectURL(done.url); }, [done]);
  useEffect(() => () => { setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; }); }, []);

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
    setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    prevCanvasRef.current = null;
    try {
      const bm = await decodeImage(f);
      setDims(`${bm.width}×${bm.height}`);
      // Build the capped preview source + its lossless "before" snapshot.
      const { canvas, w, h } = buildPreviewCanvas(bm);
      bm.close();
      prevCanvasRef.current = canvas;
      const pngUrl = URL.createObjectURL(await canvasToPngBlob(canvas));
      setBeforePrev({ url: pngUrl, w, h });
      const df = detectFormat(f);
      setSrcFormat(df === 'other' ? (f.name.split('.').pop() || '').toLowerCase() : df);
      // sensible default target: the "opposite" of what came in
      setFormat(df === 'png' ? 'jpg' : 'png');
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  }
  function pick(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length > 1) { reset(); setBatchFiles(list); return; } // several images → on-device batch
    void loadOne(list[0]);
  }

  function reset() {
    setFile(null);
    setBatchFiles([]);
    setDone(null);
    setError(null);
    setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    prevCanvasRef.current = null;
  }

  // Debounced preview render — only meaningful for lossy targets (PNG is exact).
  const showPreview = !!file && !done && format !== 'png';
  const { preview, busy: previewBusy } = useQualityPreview({
    active: showPreview,
    signature: file ? `${file.name}:${file.size}:${file.lastModified}|${format}|${quality}` : '',
    render: async () => {
      const c = prevCanvasRef.current;
      if (!c) return null;
      const blob = await encodeCanvas(c, format, quality);
      return { blob, w: c.width, h: c.height };
    },
  });

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      const bm = await decodeImage(file);
      const canvas = document.createElement('canvas');
      canvas.width = bm.width;
      canvas.height = bm.height;
      canvas.getContext('2d')!.drawImage(bm, 0, 0);
      bm.close();
      const blob = await encodeCanvas(canvas, format, quality);
      canvas.width = 0; canvas.height = 0;
      const name = `${file.name.replace(/\.[^.]+$/, '')}.${format}`;
      download(blob, name);
      if (done) URL.revokeObjectURL(done.url);
      setDone({ blob, name, url: URL.createObjectURL(blob), secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert the image.');
    } finally {
      setBusy(false);
    }
  }

  // Format + quality controls — shared by the single-file view and the batch runner.
  const formatControls = (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1.5 block font-medium">Convert to</span>
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
  );

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : batchFiles.length > 0 ? (
          <BatchRunner
            files={batchFiles}
            controls={formatControls}
            actionLabel="Convert all"
            zipName="diemdesk-converted.zip"
            process={async (f) => convertImageFile(f, { format, quality })}
            onReset={reset}
          />
        ) : !file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop an image here, or click to choose</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF, BMP in — JPG, PNG, or WebP out</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose image</span>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="size-3 text-amber-500" /> Drop <b className="font-semibold text-foreground">several at once</b> to convert them together — on your device <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">Pro</span></p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-600 dark:bg-sky-950/40"><Repeat className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{srcFormat.toUpperCase()} · {dims} · {fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; }); prevCanvasRef.current = null; }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && formatControls}

        {/* PNG is lossless — the output is a pixel-exact copy, so there's no
            quality tradeoff to preview. Say so instead of showing nothing. */}
        {!!file && !done && format === 'png' && (
          <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            PNG is lossless — your image is copied pixel-for-pixel, so there’s no quality to preview. (Switch to JPG or WebP to compare quality.)
          </p>
        )}

        {/* Live quality preview — see the exact detail you'll get before saving.
            PNG is lossless, so there's nothing to preview there. */}
        {showPreview && (beforePrev || preview || previewBusy) && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              Preview — {format.toUpperCase()} at quality {quality}
              {previewBusy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </p>
            <BeforeAfter
              before={beforePrev}
              after={preview}
              beforeCaption="Original"
              afterCaption={`${format.toUpperCase()} · Q${quality}`}
              beforeLabel={srcFormat.toUpperCase()}
              afterLabel={`Quality ${quality}`}
              loading={!preview}
              zoomHint="Hover to zoom in and check the detail before you save"
            />
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Converting…</> : <><Repeat className="size-4" /> Convert to {format.toUpperCase()} &amp; download</>}
          </Button>
        )}

        {done && (
          <>
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Converted — {done.name} saved</p>
                <p className="text-xs text-muted-foreground">{fmt(done.blob.size)} (was {fmt(file?.size || 0)}) · {formatDuration(done.secs)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDone(null)}><RotateCcw className="size-4" /> Again</Button>
                <Button size="sm" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download</Button>
              </div>
            </div>
            <KeepGoing exclude="/convert-image" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
