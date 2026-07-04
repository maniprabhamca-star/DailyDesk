'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { Upload, Film, X, Loader2, Download, Clapperboard, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { BigFileHint } from '@/components/app/big-file-hint';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { loadVideoMeta, frameCount, type VideoMeta, type VideoGifOptions } from '@/lib/video-to-gif';

const FPS = [8, 10, 12, 15, 20];
const WIDTHS = [240, 320, 480, 640];

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function clock(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoToGifTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [opts, setOpts] = useState<VideoGifOptions>({ fps: 12, start: 0, end: 5, width: 480, maxColors: 256, loop: true });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number; blob: Blob; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped on new file / reset so a slow or stuck render can't revive its old
  // spinner or drop a stale GIF onto a different video.
  const jobRef = useRef(0);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function loadOne(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|avi|mkv|ogg)$/i.test(f.name)) {
      setError('Please choose a video file (MP4, WebM, MOV…).');
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    jobRef.current++; setBusy(false); setProgress(null);
    setTooBig(null); setError(null); setResult(null);
    try {
      const { video, meta: m, url } = await loadVideoMeta(f);
      video.remove(); // preview uses its own <video>; keep the url alive for it
      setMeta(m);
      setPreviewUrl(url);
      setFile(f);
      // Default to the first 5s (or the whole clip if shorter) — like the classics.
      setOpts((o) => ({ ...o, start: 0, end: Math.min(5, m.duration || 5) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this video.');
    }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

  function reset() {
    jobRef.current++; setBusy(false);
    setFile(null); setMeta(null); setResult(null); setError(null); setProgress(null);
    setPreviewUrl(null);
  }

  async function run() {
    if (!file || !meta) return;
    const job = ++jobRef.current;
    setBusy(true); setError(null); setResult(null); setProgress(null);
    try {
      // Lazy-load the encoder so the route stays light until someone converts.
      const { videoToGif } = await import('@/lib/video-to-gif');
      const t0 = performance.now();
      const blob = await videoToGif(file, opts, (done, total) => { if (jobRef.current === job) setProgress({ done, total }); });
      if (jobRef.current !== job) return; // superseded by a new file/run
      const secs = (performance.now() - t0) / 1000;
      setResult({ url: URL.createObjectURL(blob), size: blob.size, blob, secs });
      download(blob, `${file.name.replace(/\.[^.]+$/, '')}.gif`);
    } catch (e) {
      if (jobRef.current === job) setError(e instanceof Error ? e.message : 'Could not build the GIF.');
    } finally {
      if (jobRef.current === job) { setBusy(false); setProgress(null); }
    }
  }

  const frames = meta ? frameCount(opts.start, opts.end, opts.fps) : 0;

  return (
    <Card>
      <CardContent className="p-5">
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
            <p className="mt-2 text-sm font-medium">Drop a video here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Turned into a GIF on your device — the video is never uploaded</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/40"><Film className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)}{meta ? ` · ${clock(meta.duration)} · ${meta.width}×${meta.height}` : ''}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={reset}><X className="size-4" /></Button>
            </div>

            {previewUrl && !result && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={previewUrl} controls muted playsInline className="mt-3 max-h-64 w-full rounded-lg bg-black" />
            )}
          </>
        )}
        <input ref={inputRef} type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv,.ogg" className="hidden"
          onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {file && <BigFileHint bytes={file.size} threshold={500 * 1024 * 1024} />}

        {file && meta && !result && (
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 flex items-center justify-between"><span className="font-medium">Clip</span>
                <span className="text-xs text-muted-foreground">{clock(opts.start)} → {clock(opts.end)} · {(opts.end - opts.start).toFixed(1)}s</span></span>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={meta.duration} step={0.1} value={opts.start}
                  onChange={(e) => setOpts((o) => ({ ...o, start: Math.min(+e.target.value, o.end - 0.1) }))} className="w-full" aria-label="Start time" />
                <input type="range" min={0} max={meta.duration} step={0.1} value={opts.end}
                  onChange={(e) => setOpts((o) => ({ ...o, end: Math.max(+e.target.value, o.start + 0.1) }))} className="w-full" aria-label="End time" />
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Frame rate</span>
                <div className="flex flex-wrap gap-1.5">
                  {FPS.map((f) => (
                    <button key={f} type="button" onClick={() => setOpts((o) => ({ ...o, fps: f }))}
                      className={`rounded-md border px-2.5 py-1 text-xs ${opts.fps === f ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:border-primary/40'}`}>{f} fps</button>
                  ))}
                </div>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Width</span>
                <div className="flex flex-wrap gap-1.5">
                  {WIDTHS.map((w) => (
                    <button key={w} type="button" onClick={() => setOpts((o) => ({ ...o, width: w }))}
                      className={`rounded-md border px-2.5 py-1 text-xs ${opts.width === w ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:border-primary/40'}`}>{w}px</button>
                  ))}
                </div>
              </label>
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm sm:pt-6">
                <input type="checkbox" checked={opts.loop} onChange={(e) => setOpts((o) => ({ ...o, loop: e.target.checked }))} className="size-4 accent-primary" />
                <span className="font-medium">Loop forever</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {frames} frame{frames === 1 ? '' : 's'} at {opts.width}px. Tip: shorter clips and lower frame rates make much smaller GIFs.
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && meta && !result && (
          <Button className="mt-4 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> {progress ? `Rendering frame ${progress.done} of ${progress.total}…` : 'Preparing…'}</>
              : <><Clapperboard className="size-4" /> Make GIF &amp; download</>}
          </Button>
        )}

        {result && (
          <div className="mt-5">
            <div className="rounded-xl border bg-card p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="Your GIF" className="mx-auto max-h-72 rounded-lg" />
              <p className="mt-3 text-sm text-muted-foreground">GIF ready — {fmt(result.size)} · {formatDuration(result.secs)}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => download(result.blob, `${(file?.name || 'clip').replace(/\.[^.]+$/, '')}.gif`)}>
                  <Download className="size-4" /> Download again
                </Button>
                <Button size="sm" variant="outline" onClick={() => setResult(null)}><RotateCw className="size-4" /> Tweak settings</Button>
                <Button size="sm" variant="ghost" onClick={reset}><X className="size-4" /> New video</Button>
              </div>
            </div>
          </div>
        )}

        <KeepGoing exclude="/video-to-gif" />
      </CardContent>
    </Card>
  );
}
