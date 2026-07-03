'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, Repeat, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { decodeImage, encodeCanvas, canEncodeWebp, detectFormat, type OutFormat } from '@/lib/image-convert';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ConvertImageTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [srcFormat, setSrcFormat] = useState<string>('');
  const [dims, setDims] = useState('');
  const [format, setFormat] = useState<OutFormat>('png');
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; url: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const webpOk = typeof window !== 'undefined' && canEncodeWebp();

  useEffect(() => () => { if (done) URL.revokeObjectURL(done.url); }, [done]);

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
      setDims(`${bm.width}×${bm.height}`);
      bm.close();
      const df = detectFormat(f);
      setSrcFormat(df === 'other' ? (f.name.split('.').pop() || '').toLowerCase() : df);
      // sensible default target: the "opposite" of what came in
      setFormat(df === 'png' ? 'jpg' : 'png');
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

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
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF, BMP in — JPG, PNG, or WebP out</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-600 dark:bg-sky-950/40"><Repeat className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{srcFormat.toUpperCase()} · {dims} · {fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
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
                <p className="text-xs text-muted-foreground">{fmt(done.blob.size)} (was {fmt(file?.size || 0)}) · {done.secs.toFixed(1)}s</p>
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
