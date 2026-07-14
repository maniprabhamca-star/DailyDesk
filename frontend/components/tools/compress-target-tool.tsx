'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, CheckCircle2, AlertTriangle, RotateCcw, FileText, Image as ImageIcon, Crosshair, Shrink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { formatDuration } from '@/lib/format';
import { BigFileHint } from '@/components/app/big-file-hint';
import { KeepGoing } from '@/components/app/keep-going';
import { compressImageToTarget, compressPdfToTarget, isPdfFile, isImageFile, type TargetResult } from '@/lib/compress-to-target';

const KB = 1024, MB = 1024 * 1024;
function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

const SIZE_PRESETS: { label: string; bytes: number }[] = [
  { label: '50 KB', bytes: 50 * KB },
  { label: '100 KB', bytes: 100 * KB },
  { label: '200 KB', bytes: 200 * KB },
  { label: '500 KB', bytes: 500 * KB },
  { label: '1 MB', bytes: 1 * MB },
  { label: '2 MB', bytes: 2 * MB },
];

// Real government / exam / everyday upload limits — one tap fills the exact cap.
const EXAM_PRESETS: { label: string; note: string; bytes: number }[] = [
  { label: 'UPSC photo', note: '40 KB', bytes: 40 * KB },
  { label: 'UPSC PDF', note: '300 KB', bytes: 300 * KB },
  { label: 'SSC', note: '100 KB', bytes: 100 * KB },
  { label: 'IBPS', note: '50 KB', bytes: 50 * KB },
  { label: 'SBI', note: '50 KB', bytes: 50 * KB },
  { label: 'Email', note: '25 MB', bytes: 25 * MB },
];

type Kind = 'pdf' | 'image';

export function CompressTargetTool() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind>('pdf'); // accept-filter hint; auto-set from the dropped file
  const [target, setTarget] = useState<number>(200 * KB);
  const [customOn, setCustomOn] = useState(false);
  const [customKb, setCustomKb] = useState('150');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<(TargetResult & { url: string; secs: number }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledName = useRef<string>('');

  useEffect(() => () => { if (done) URL.revokeObjectURL(done.url); }, [done]);

  const effectiveTarget = customOn ? Math.max(1, Math.round(parseFloat(customKb || '0') * KB)) : target;

  function loadFile(f?: File) {
    if (!f) return;
    if (!isPdfFile(f) && !isImageFile(f)) {
      setError('Please choose a PDF or an image (JPG, PNG, WebP).');
      return;
    }
    setError(null);
    setDone(null);
    setKind(isPdfFile(f) ? 'pdf' : 'image');
    setFile(f);
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress('Preparing…');
    cancelledName.current = file.name;
    const startedAt = performance.now();
    try {
      const isPdf = isPdfFile(file);
      const res = isPdf
        ? await compressPdfToTarget(file, effectiveTarget, setProgress)
        : await compressImageToTarget(file, effectiveTarget, setProgress);
      if (cancelledName.current !== file.name) return; // file changed mid-run
      const url = URL.createObjectURL(res.blob);
      setDone({ ...res, url, secs: (performance.now() - startedAt) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compression failed. Try a different file or target.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function reset() {
    setFile(null);
    setDone(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="mx-auto max-w-xl">
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'pdf' ? 'application/pdf,image/*' : 'image/*,application/pdf'}
        className="hidden"
        onChange={(e) => loadFile(e.target.files?.[0])}
      />

      {/* Format hint / accept toggle */}
      {!file && (
        <div className="mb-4 inline-flex rounded-xl border bg-muted/50 p-1">
          {(['pdf', 'image'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {k === 'pdf' ? 'PDF' : 'Image'}
            </button>
          ))}
        </div>
      )}

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-12 text-center transition hover:border-primary/50 hover:bg-muted/30"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Upload className="size-6 text-muted-foreground" /></span>
          <span className="mt-4 text-sm font-medium">Drop a {kind === 'pdf' ? 'PDF' : 'image'} here, or click to choose</span>
          <span className="mt-1 text-xs text-muted-foreground">PDF or image · compressed on your device — never uploaded</span>
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${isPdfFile(file) ? 'bg-red-100 text-red-600 dark:bg-red-950/40' : 'bg-sky-100 text-sky-600 dark:bg-sky-950/40'}`}>
              {isPdfFile(file) ? <FileText className="size-4" /> : <ImageIcon className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)} · {isPdfFile(file) ? 'PDF' : 'image'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={reset}><X className="size-4" /></Button>
          </div>

          {file && <BigFileHint bytes={file.size} />}

          {!done && (
            <>
              <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Crosshair className="size-3.5 text-primary" /> Target size <span className="font-medium normal-case tracking-normal text-muted-foreground/80">— we get as close under it as we can</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SIZE_PRESETS.map((p) => (
                  <Chip key={p.label} on={!customOn && target === p.bytes} onClick={() => { setCustomOn(false); setTarget(p.bytes); }}>{p.label}</Chip>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomOn(true)}
                  className={`rounded-lg border border-dashed px-3 py-2 text-sm font-semibold transition ${customOn ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40'}`}
                >
                  Custom KB…
                </button>
              </div>

              {customOn && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={customKb}
                    onChange={(e) => setCustomKb(e.target.value)}
                    className="w-28 rounded-lg border bg-card px-3 py-2 text-sm"
                    aria-label="Custom target in KB"
                  />
                  <span className="text-sm text-muted-foreground">KB</span>
                </div>
              )}

              <div className="mt-3 rounded-xl border bg-muted/40 p-3">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold">🎓 Government &amp; exam presets <span className="font-normal text-muted-foreground">— fill the exact limit</span></p>
                <div className="flex flex-wrap gap-2">
                  {EXAM_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setCustomOn(false); setTarget(p.bytes); }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${!customOn && target === p.bytes ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}
                    >
                      {p.label} <span className={!customOn && target === p.bytes ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{p.note}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span><b className="text-foreground">How it hits the target:</b> we step the {isPdfFile(file) ? 'resolution &amp; quality' : 'quality, then size'} down just enough to fit — {isPdfFile(file) ? 'text stays readable' : 'photos stay sharp'}. Everything runs in your browser; the file is never uploaded.</span>
              </p>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> {progress || 'Compressing…'}</> : <><Shrink className="size-4" /> Compress to {fmt(effectiveTarget)}</>}
              </Button>
            </>
          )}

          {done && (
            <div className="mt-4 rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${done.reached ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                  {done.reached ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                </span>
                <div className="min-w-0">
                  {done.reached ? (
                    <p className="text-sm font-semibold">Done — {fmt(done.after)} <span className="text-emerald-600 dark:text-emerald-400">· under your {fmt(effectiveTarget)} limit ✓</span></p>
                  ) : (
                    <p className="text-sm font-semibold">Smallest we could reach: {fmt(done.after)} <span className="text-amber-600 dark:text-amber-400">· couldn’t get under {fmt(effectiveTarget)}</span></p>
                  )}
                  <p className="text-xs text-muted-foreground">was {fmt(done.before)} · −{Math.max(0, Math.round((1 - done.after / done.before) * 100))}% · {formatDuration(done.secs)}</p>
                </div>
              </div>
              {!done.reached && (
                <p className="mt-3 text-xs text-muted-foreground">This file can’t go smaller without losing too much. Try a slightly larger target, or split a multi-page PDF first.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="flex-1" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download</Button>
                <Button variant="outline" onClick={() => setDone(null)}><RotateCcw className="size-4" /> Try a different size</Button>
                <Button variant="ghost" onClick={reset}><Upload className="size-4" /> New file</Button>
              </div>
            </div>
          )}
        </>
      )}

      <KeepGoing />
    </div>
  );
}
