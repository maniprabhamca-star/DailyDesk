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

// Friendly TARGET label: rolls up into MB once you're at ~1000 KB, so a custom
// "1000 KB" reads as "1 MB" (not "1000 KB"), and 1536 KB reads as "1.5 MB".
function fmtTarget(bytes: number) {
  if (bytes < 1000 * KB) return `${Math.round(bytes / KB)} KB`;
  const mb = Math.round((bytes / MB) * 10) / 10;
  return `${mb} MB`;
}

const SIZE_PRESETS: { label: string; bytes: number }[] = [
  { label: '50 KB', bytes: 50 * KB },
  { label: '100 KB', bytes: 100 * KB },
  { label: '200 KB', bytes: 200 * KB },
  { label: '500 KB', bytes: 500 * KB },
  { label: '1 MB', bytes: 1 * MB },
  { label: '2 MB', bytes: 2 * MB },
];

// Real, sourced upload limits from the portals people actually fight with,
// worldwide. One tap fills the exact cap. (Photo DIMENSION cropping — 35×45 mm,
// 2×2 in — lives in the Passport/ID Photo tool; here we hit the byte limit.)
type Preset = { label: string; note: string; bytes: number };
const PRESET_GROUPS: { label: string; items: Preset[] }[] = [
  {
    label: '🇮🇳 India exams & forms',
    items: [
      { label: 'UPSC photo', note: '40 KB', bytes: 40 * KB },
      { label: 'UPSC doc', note: '300 KB', bytes: 300 * KB },
      { label: 'SSC', note: '100 KB', bytes: 100 * KB },
      { label: 'IBPS', note: '50 KB', bytes: 50 * KB },
      { label: 'SBI', note: '50 KB', bytes: 50 * KB },
      { label: 'Signature', note: '20 KB', bytes: 20 * KB },
    ],
  },
  {
    label: '🛂 Passport & visa',
    items: [
      { label: 'US visa', note: '240 KB', bytes: 240 * KB },
      { label: 'India passport', note: '250 KB', bytes: 250 * KB },
      { label: 'India e-Visa', note: '1 MB', bytes: 1 * MB },
      { label: 'Canada PR', note: '4 MB', bytes: 4 * MB },
      { label: 'Passport photo', note: '200 KB', bytes: 200 * KB },
    ],
  },
  {
    label: '✉️ Everyday sharing',
    items: [
      { label: 'Email', note: '25 MB', bytes: 25 * MB },
      { label: 'Discord', note: '25 MB', bytes: 25 * MB },
      { label: 'Web upload', note: '2 MB', bytes: 2 * MB },
    ],
  },
];

type Kind = 'pdf' | 'image';

export function CompressTargetTool() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind>('pdf');
  const [target, setTarget] = useState<number>(200 * KB);
  const [customOn, setCustomOn] = useState(false);
  const [customKb, setCustomKb] = useState('150');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<(TargetResult & { url: string; secs: number }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningName = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { if (done) URL.revokeObjectURL(done.url); }, [done]);

  const customNum = parseFloat(customKb);
  const customValid = !customOn || (isFinite(customNum) && customNum > 0);
  const effectiveTarget = customOn ? Math.max(1, Math.round((isFinite(customNum) ? customNum : 0) * KB)) : target;

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
    if (!file || !customValid) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setProgress('Preparing…');
    runningName.current = file.name;
    const startedAt = performance.now();
    try {
      const res = isPdfFile(file)
        ? await compressPdfToTarget(file, effectiveTarget, setProgress, controller.signal)
        : await compressImageToTarget(file, effectiveTarget, setProgress, controller.signal);
      if (runningName.current !== file.name) return;
      const url = URL.createObjectURL(res.blob);
      setDone({ ...res, url, secs: (performance.now() - startedAt) / 1000 });
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'Compression failed. Try a different file or target.');
      }
    } finally {
      setBusy(false);
      setProgress('');
      abortRef.current = null;
    }
  }

  function cancelRun() { abortRef.current?.abort(); }

  function reset() {
    setFile(null);
    setDone(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const presetOn = (bytes: number) => !customOn && target === bytes;

  return (
    <div className="mx-auto max-w-xl">
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'pdf' ? 'application/pdf,image/*' : 'image/*,application/pdf'}
        className="hidden"
        onChange={(e) => loadFile(e.target.files?.[0])}
      />

      {!file && (
        <div className="mb-4 inline-flex rounded-xl border bg-muted/50 p-1">
          {(['pdf', 'image'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
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
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setCustomOn(false); setTarget(p.bytes); }}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${presetOn(p.bytes) ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomOn(true)}
                  className={`rounded-lg border border-dashed px-3 py-2 text-sm font-semibold transition ${customOn ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40'}`}
                >
                  Custom…
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
                  {customValid ? (
                    <span className="text-sm font-medium text-primary">= {fmtTarget(effectiveTarget)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">enter a size</span>
                  )}
                </div>
              )}

              <div className="mt-3 rounded-xl border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-semibold">Real-world upload limits <span className="font-normal text-muted-foreground">— fill the exact cap</span></p>
                <div className="space-y-2.5">
                  {PRESET_GROUPS.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{g.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {g.items.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => { setCustomOn(false); setTarget(p.bytes); }}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${presetOn(p.bytes) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}
                          >
                            {p.label} <span className={presetOn(p.bytes) ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{p.note}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span><b className="text-foreground">How it hits the target:</b> we step the {isPdfFile(file) ? 'resolution & quality' : 'quality, then size'} down just enough to fit — {isPdfFile(file) ? 'text stays readable' : 'photos stay sharp'}. Everything runs in your browser; the file is never uploaded.</span>
              </p>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

              {busy ? (
                <div className="mt-5 flex gap-2">
                  <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> {progress || 'Compressing…'}</Button>
                  <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
                </div>
              ) : (
                <Button className="mt-5 w-full" size="lg" onClick={run} disabled={!customValid}>
                  <Shrink className="size-4" /> {customValid ? `Compress to ${fmtTarget(effectiveTarget)}` : 'Enter a target size'}
                </Button>
              )}
            </>
          )}

          {done && (
            <div className="mt-4 rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${done.reached ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                  {done.reached ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                </span>
                <div className="min-w-0">
                  {done.unchanged ? (
                    <p className="text-sm font-semibold">Already under {fmtTarget(effectiveTarget)} — <span className="text-emerald-600 dark:text-emerald-400">nothing to compress ✓</span></p>
                  ) : done.reached ? (
                    <p className="text-sm font-semibold">Done — {fmt(done.after)} <span className="text-emerald-600 dark:text-emerald-400">· under your {fmtTarget(effectiveTarget)} limit ✓</span></p>
                  ) : (
                    <p className="text-sm font-semibold">Smallest we could reach: {fmt(done.after)} <span className="text-amber-600 dark:text-amber-400">(the max possible) · couldn’t get under {fmtTarget(effectiveTarget)}</span></p>
                  )}
                  <p className="text-xs text-muted-foreground">was {fmt(done.before)}{done.unchanged ? '' : ` · −${Math.max(0, Math.round((1 - done.after / done.before) * 100))}%`} · {formatDuration(done.secs)}</p>
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
