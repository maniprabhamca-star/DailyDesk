'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Eraser, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { removeBackground, type BgProgress } from '@/lib/remove-bg';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { cn } from '@/lib/utils';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STAGE_TEXT: Record<BgProgress['stage'], string> = {
  model: 'Downloading the AI model (one time — cached after this)',
  init: 'Starting the model on your device',
  infer: 'Finding the subject',
  compose: 'Cutting it out at full resolution',
};

export function RemoveBackgroundTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BgProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ png: Blob; url: string; name: string; ms: number; w: number; h: number } | null>(null);
  const [view, setView] = useState<'result' | 'original'>('result');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);
  useEffect(() => () => { if (done) URL.revokeObjectURL(done.url); }, [done]);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)) {
      setError('Please choose an image (JPG, PNG, WebP, GIF, or BMP). For iPhone HEIC photos, convert with HEIC to JPG first.');
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null);
    setError(null);
    setDone(null);
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    setSrcUrl(URL.createObjectURL(f));
    setFile(f);
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const res = await removeBackground(file, setProgress);
      const name = `${file.name.replace(/\.[^.]+$/, '')}-no-background.png`;
      if (done) URL.revokeObjectURL(done.url);
      setDone({ png: res.png, url: URL.createObjectURL(res.png), name, ms: res.ms, w: res.width, h: res.height });
      setView('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the background.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function reset() {
    setFile(null);
    setDone(null);
    setError(null);
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    setSrcUrl(null);
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
            <p className="mt-2 text-sm font-medium">Drop a photo here, or click to choose</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP — processed on your device, never uploaded</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600 dark:bg-violet-950/40"><Eraser className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}{done ? ` · ${done.w}×${done.h}` : ''}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={reset}><X className="size-4" /></Button>
          </div>
        )}

        {/* Preview area */}
        {file && (
          <div className="mt-4">
            <div
              className="relative w-full overflow-hidden rounded-xl border"
              style={{
                backgroundImage:
                  'linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0,12px 12px',
                backgroundColor: '#fff',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={done && view === 'result' ? done.url : srcUrl || undefined}
                alt={done && view === 'result' ? 'Result with background removed' : 'Original image'}
                className="mx-auto max-h-[420px] w-auto max-w-full"
              />
            </div>
            {done && (
              <div className="mt-3 inline-flex rounded-lg border bg-card p-1 shadow-soft">
                {([
                  { k: 'result', label: 'Background removed' },
                  { k: 'original', label: 'Original' },
                ] as const).map((m) => (
                  <button
                    key={m.k}
                    onClick={() => setView(m.k)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      view === m.k ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {busy && progress && (
          <div className="mt-4 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">{STAGE_TEXT[progress.stage]}{progress.stage === 'model' ? ` · ${progress.pct}%` : '…'}</p>
            {progress.stage === 'model' && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
              </div>
            )}
          </div>
        )}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Sparkles className="size-4 animate-pulse" /> Working on your device…</> : <><Eraser className="size-4" /> Remove background</>}
          </Button>
        )}

        {done && (
          <>
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Background removed — transparent PNG ready</p>
                <p className="text-xs text-muted-foreground">{fmt(done.png.size)} · full {done.w}×{done.h} resolution · {formatDuration(done.ms / 1000)} on your device</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDone(null)}><RotateCcw className="size-4" /> Again</Button>
                <Button size="sm" onClick={() => downloadBlob(done.png, done.name)}><Download className="size-4" /> Download PNG</Button>
              </div>
            </div>
            <KeepGoing exclude="/remove-background" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
