'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { Upload, Film, X, Loader2, Download, Shrink, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { BigFileHint } from '@/components/app/big-file-hint';
import { SavingsRing } from '@/components/app/savings-ring';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { loadVideoMeta, type VideoMeta } from '@/lib/video-to-gif';
import type { VideoPref, Quality, CompressResult } from '@/lib/compress-video';

const RES = [
  { label: 'Keep', maxHeight: 0 },
  { label: '1080p', maxHeight: 1080 },
  { label: '720p', maxHeight: 720 },
  { label: '480p', maxHeight: 480 },
];
const QUAL: { id: Quality; label: string; hint: string }[] = [
  { id: 'high', label: 'High', hint: 'Best quality, gentle shrink' },
  { id: 'balanced', label: 'Balanced', hint: 'Great quality, big shrink' },
  { id: 'small', label: 'Small', hint: 'Smallest file' },
];

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function clock(s: number) { const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }

export function CompressVideoTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pref, setPref] = useState<VideoPref>('mp4');
  const [quality, setQuality] = useState<Quality>('balanced');
  const [maxHeight, setMaxHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(CompressResult & { secs: number }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped whenever a new file is loaded or the tool is reset, so a slow/stuck
  // compression (e.g. an over-large file) can never revive its old spinner or
  // stamp a stale result onto a different video.
  const jobRef = useRef(0);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(URL.createObjectURL(result.blob)); }, [result]);

  async function loadOne(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|avi|mkv|ogg)$/i.test(f.name)) {
      setError('Please choose a video file (MP4, WebM, MOV…).'); return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    jobRef.current++; setBusy(false); setPct(0);
    setTooBig(null); setError(null); setResult(null);
    try {
      const { video, meta: m, url } = await loadVideoMeta(f);
      video.remove();
      setMeta(m); setPreviewUrl(url); setFile(f);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this video.'); }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }
  function reset() { jobRef.current++; setBusy(false); setFile(null); setMeta(null); setResult(null); setError(null); setPct(0); setPreviewUrl(null); }

  async function run() {
    if (!file) return;
    const job = ++jobRef.current;
    setBusy(true); setError(null); setResult(null); setPct(0);
    try {
      const { compressVideo } = await import('@/lib/compress-video');
      const t0 = performance.now();
      const res = await compressVideo(file, { pref, quality, maxHeight }, (fr) => { if (jobRef.current === job) setPct(Math.round(fr * 100)); });
      if (jobRef.current !== job) return; // superseded by a new file/run — drop this result
      const secs = (performance.now() - t0) / 1000;
      setResult({ ...res, secs });
      download(res.blob, `${file.name.replace(/\.[^.]+$/, '')}-compressed.${res.ext}`);
    } catch (e) {
      if (jobRef.current === job) setError(e instanceof Error ? e.message : 'Could not compress the video.');
    } finally {
      if (jobRef.current === job) setBusy(false);
    }
  }

  const saved = result ? file!.size - result.blob.size : 0;
  const savedPct = result && file ? Math.round((saved / file.size) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a video here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Compressed on your device — the video is never uploaded</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose video</span>
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
              <video src={previewUrl} controls muted playsInline className="mt-3 max-h-56 w-full rounded-lg bg-black" />
            )}
          </>
        )}
        <input ref={inputRef} type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv,.ogg" className="hidden"
          onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {file && <BigFileHint bytes={file.size} threshold={150 * 1024 * 1024} />}

        {file && !result && (
          <div className="mt-4 grid gap-4">
            <div>
              <span className="mb-1 block text-sm font-medium">Format</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setPref('mp4')} aria-pressed={pref === 'mp4'}
                  className={`rounded-xl border p-3 text-left text-sm ${pref === 'mp4' ? 'border-primary ring-1 ring-primary bg-primary/[0.04]' : 'hover:border-primary/40'}`}>
                  <span className="font-medium">MP4 — plays everywhere</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Best compatibility (H.264). Recommended.</span>
                </button>
                <button type="button" onClick={() => setPref('smallest')} aria-pressed={pref === 'smallest'}
                  className={`rounded-xl border p-3 text-left text-sm ${pref === 'smallest' ? 'border-primary ring-1 ring-primary bg-primary/[0.04]' : 'hover:border-primary/40'}`}>
                  <span className="font-medium">Smallest — WebM</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">VP9/AV1 shrinks ~30% more. Modern players.</span>
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-sm font-medium">Quality</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUAL.map((q) => (
                    <button key={q.id} type="button" onClick={() => setQuality(q.id)} title={q.hint}
                      className={`rounded-md border px-2.5 py-1 text-xs ${quality === q.id ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:border-primary/40'}`}>{q.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">Resolution</span>
                <div className="flex flex-wrap gap-1.5">
                  {RES.map((r) => (
                    <button key={r.label} type="button" onClick={() => setMaxHeight(r.maxHeight)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${maxHeight === r.maxHeight ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:border-primary/40'}`}>{r.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Compression runs as the video plays through once, so it takes about the length of the clip. Longer clips take longer.</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !result && (
          <Button className="mt-4 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Compressing… {pct}%</> : <><Shrink className="size-4" /> Compress video</>}
          </Button>
        )}

        {result && file && (
          <div className="mt-5">
            {saved > 0 ? (
              <SavingsRing savedPct={savedPct} beforeLabel={fmt(file.size)} afterLabel={fmt(result.blob.size)} note={`${result.label} · ${formatDuration(result.secs)}`} />
            ) : (
              <p className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">This video is already efficiently compressed — the re‑encoded {result.label} file is {fmt(result.blob.size)} ({formatDuration(result.secs)}). Try a lower quality or resolution for more shrink.</p>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => download(result.blob, `${file.name.replace(/\.[^.]+$/, '')}-compressed.${result.ext}`)}><Download className="size-4" /> Download again</Button>
              <Button size="sm" variant="outline" onClick={() => setResult(null)}><RotateCw className="size-4" /> Try other settings</Button>
              <Button size="sm" variant="ghost" onClick={reset}><X className="size-4" /> New video</Button>
            </div>
          </div>
        )}

        <KeepGoing exclude="/compress-video" />
      </CardContent>
    </Card>
  );
}
