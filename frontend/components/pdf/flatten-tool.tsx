'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, FileText, X, Loader2, Layers, Image as ImageIcon, Zap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { runQpdf, QpdfError } from '@/lib/qpdf';
import type { FlattenScan } from '@/lib/pdf-flatten';
import { RASTER_PRESETS, type RasterPreset } from '@/lib/raster-presets';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

type Mode = 'fields' | 'raster';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FlattenTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [scan, setScan] = useState<FlattenScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<Mode>('fields');
  const [preset, setPreset] = useState<RasterPreset>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null);
    setError(null);
    setDone(null);
    setScan(null);
    setMode('fields');
    setFile(f);
    setScanning(true);
    void (async () => {
      try {
        // Lazy: pdf-lib loads on first file, not with the page.
        const { scanFlattenables } = await import('@/lib/pdf-flatten');
        const s = await scanFlattenables(new Uint8Array(await f.arrayBuffer()));
        setScan(s);
        // Nothing interactive to flatten -> the picture mode is the useful one.
        if (!s.encrypted && s.fields === 0 && s.annotations === 0) setMode('raster');
      } catch {
        setScan(null); // scan is advisory only — qpdf itself may still cope
      } finally {
        setScanning(false);
      }
    })();
  }
  function pick(files: FileList | null) { loadOne(files?.[0]); }

  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      loadOne(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setProgress(null);
    try {
      const out = mode === 'fields'
        ? await runQpdf(file, { type: 'flatten' })
        : await (await import('@/lib/pdf-rasterize')).rasterizePdf(file, preset, (d, t) => setProgress({ done: d, total: t }));
      const name = `${file.name.replace(/\.pdf$/i, '')}-flattened.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name });
    } catch (e) {
      if (e instanceof QpdfError) setError(e.message);
      else if (e instanceof Error && /password/i.test(e.message)) setError('This PDF is password-protected — remove the password first with Unlock PDF, then flatten it.');
      else setError(e instanceof Error ? e.message : 'Could not flatten the PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const scanLine = scan && !scan.encrypted
    ? scan.fields === 0 && scan.annotations === 0
      ? 'No fillable fields or annotations found — pick “Lock pages as images” to make the content itself uneditable.'
      : `Found ${scan.fields} fillable field${scan.fields === 1 ? '' : 's'} and ${scan.annotations} annotation${scan.annotations === 1 ? '' : 's'} across ${scan.pages} page${scan.pages === 1 ? '' : 's'}.`
    : null;

  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}
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
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Make filled forms, signatures and annotations permanent</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}{scanning ? ' · inspecting…' : ''}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setScan(null); setDone(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {file && scan?.encrypted && (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            This PDF is password-protected, so it can’t be flattened yet.{' '}
            <Link href="/unlock-pdf" className="font-medium text-primary underline underline-offset-2">Remove the password with Unlock PDF</Link> first, then come back — “Keep moving” will carry the file over.
          </p>
        )}

        {file && !done && !scan?.encrypted && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={mode === 'fields'}
              onClick={() => setMode('fields')}
              className={`rounded-xl border p-4 text-left transition-colors ${mode === 'fields' ? 'border-primary ring-1 ring-primary bg-primary/[0.04]' : 'hover:border-primary/40'}`}
            >
              <span className="flex items-center gap-2 font-medium"><Layers className="size-4 text-primary" /> Flatten fields &amp; annotations</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Filled form fields, signatures, stamps and comments become a permanent part of the page. Text stays crisp and selectable.
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === 'raster'}
              onClick={() => setMode('raster')}
              className={`rounded-xl border p-4 text-left transition-colors ${mode === 'raster' ? 'border-primary ring-1 ring-primary bg-primary/[0.04]' : 'hover:border-primary/40'}`}
            >
              <span className="flex items-center gap-2 font-medium"><ImageIcon className="size-4 text-primary" /> Lock pages as images</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Every page becomes a picture — nothing can be selected, copied or edited afterwards.
              </span>
            </button>
          </div>
        )}

        {file && !done && !scan?.encrypted && scanLine && (
          <p className="mt-3 text-xs text-muted-foreground">{scanLine}</p>
        )}

        {file && !done && !scan?.encrypted && mode === 'raster' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(RASTER_PRESETS) as RasterPreset[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={preset === k}
                onClick={() => setPreset(k)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${preset === k ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:border-primary/40'}`}
                title={RASTER_PRESETS[k].hint}
              >
                {RASTER_PRESETS[k].label} · {RASTER_PRESETS[k].dpi} DPI
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && !scan?.encrypted && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy || scanning}>
            {busy ? (
              <><Loader2 className="size-4 animate-spin" /> {progress ? `Locking page ${progress.done} of ${progress.total}…` : 'Flattening…'}</>
            ) : (
              <><Lock className="size-4" /> Flatten &amp; download</>
            )}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/flatten-pdf" fromLabel="Flatten PDF" />}
      </CardContent>
    </Card>
  );
}
