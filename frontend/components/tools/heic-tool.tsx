'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, Download, Loader2, ImageIcon, FileImage, FileText, CheckCircle2, RotateCcw, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { encodeJpeg } from '@/lib/mozjpeg';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { KeepMoving } from '@/components/app/keep-moving';
import { setHandoff } from '@/lib/handoff';
import { yieldToLoop } from '@/lib/pdf-render';
import { usePlan, canProcessSize, allowedBatchCount, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { BeforeAfter } from '@/components/pdf/before-after';
import { useQualityPreview } from '@/lib/use-quality-preview';
import { buildPreviewCanvas, canvasToPngBlob, encodeCanvas } from '@/lib/image-convert';

// ---- libheif loader ---------------------------------------------------------
// The decoder is the open-source libheif compiled to WebAssembly (LGPL-3.0 —
// served as SEPARATE, swappable files under /public/libheif/ with LICENSE.txt
// alongside, per the license terms). Loaded lazily via a plain script tag (the
// emscripten glue is UMD and fights bundlers), and only when the user actually
// converts — nothing is fetched for visitors who just read the page.
type HeifImage = {
  get_width(): number;
  get_height(): number;
  display(target: ImageData, cb: (result: ImageData | null) => void): void;
  free?: () => void;
};
type LibheifModule = { HeifDecoder: new () => { decode(b: Uint8Array): HeifImage[] } };
type LibheifFactory = (opts: { wasmBinary: ArrayBuffer }) => LibheifModule & { ready?: Promise<unknown> };

let libheifPromise: Promise<LibheifModule> | null = null;
function getLibheif(): Promise<LibheifModule> {
  if (!libheifPromise) {
    libheifPromise = (async () => {
      await new Promise<void>((res, rej) => {
        if ((window as unknown as { libheif?: LibheifFactory }).libheif) return res();
        const s = document.createElement('script');
        s.src = '/libheif/libheif.js';
        s.onload = () => res();
        s.onerror = () => rej(new Error('Could not load the HEIC decoder.'));
        document.head.appendChild(s);
      });
      const wasmRes = await fetch('/libheif/libheif.wasm');
      if (!wasmRes.ok) throw new Error('Could not load the HEIC decoder.');
      const factory = (window as unknown as { libheif: LibheifFactory }).libheif;
      const mod = factory({ wasmBinary: await wasmRes.arrayBuffer() });
      if (mod.ready && typeof mod.ready.then === 'function') await mod.ready;
      if (typeof mod.HeifDecoder !== 'function') throw new Error('Could not start the HEIC decoder.');
      return mod;
    })();
    libheifPromise.catch(() => { libheifPromise = null; }); // don't cache failures
  }
  return libheifPromise;
}

// ---- tool -------------------------------------------------------------------
type Format = 'jpg' | 'png';
type Quality = 'high' | 'balanced';
const Q: Record<Quality, number> = { high: 90, balanced: 82 };
const MAX_PIXELS = 100e6; // sanity guard (48MP iPhone photos are fine; 100MP+ is not a photo)

type Result = { name: string; blob: Blob; url: string; w: number; h: number };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isHeic(f: File) {
  return /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

export function HeicTool() {
  const plan = usePlan();
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<Format>('jpg');
  const [quality, setQuality] = useState<Quality>('high');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  // Live quality preview: the first photo decoded once into a capped canvas, then
  // re-encoded at the selected quality next to the lossless original.
  const [beforePrev, setBeforePrev] = useState<{ url: string; w: number; h: number } | null>(null);
  const prevCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function revoke(rs: Result[]) { rs.forEach((r) => URL.revokeObjectURL(r.url)); }
  useEffect(() => () => revoke(results), [results]);

  function releasePreview() {
    setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    const c = prevCanvasRef.current;
    if (c) { c.width = 0; c.height = 0; }
    prevCanvasRef.current = null;
  }
  useEffect(() => () => releasePreview(), []);

  // Decode the first photo once (libheif) into a capped preview source + build the
  // lossless "before" snapshot. Runs only after a file is added — nothing loads
  // for visitors just reading the page.
  const firstKey = files[0] ? `${files[0].name}:${files[0].size}:${files[0].lastModified}` : '';
  useEffect(() => {
    const f = files[0];
    if (!f) { releasePreview(); return; }
    let cancelled = false;
    void (async () => {
      try {
        const lib = await getLibheif();
        const images = new lib.HeifDecoder().decode(new Uint8Array(await f.arrayBuffer()));
        if (!images.length) return;
        const img = images[0];
        const w = img.get_width(), h = img.get_height();
        if (!w || !h || w * h > MAX_PIXELS) { img.free?.(); return; }
        const id = new ImageData(w, h);
        await new Promise<void>((res, rej) => img.display(id, (d) => (d ? res() : rej(new Error('decode')))));
        img.free?.();
        if (cancelled) return;
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d')!.putImageData(id, 0, 0);
        const { canvas, w: pw, h: ph } = buildPreviewCanvas(tmp);
        tmp.width = 0; tmp.height = 0;
        if (cancelled) { canvas.width = 0; canvas.height = 0; return; }
        prevCanvasRef.current = canvas;
        const png = await canvasToPngBlob(canvas);
        if (cancelled) return;
        setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(png), w: pw, h: ph }; });
      } catch { /* preview is optional */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey]);

  // Debounced re-encode at the selected quality (JPG only — PNG is lossless).
  const showPreview = files.length > 0 && !busy && format === 'jpg';
  const { preview, busy: previewBusy } = useQualityPreview({
    active: showPreview && !!beforePrev,
    signature: `${firstKey}|${quality}`,
    render: async () => {
      const c = prevCanvasRef.current;
      if (!c) return null;
      const blob = await encodeCanvas(c, 'jpg', Q[quality]);
      return { blob, w: c.width, h: c.height };
    },
  });

  function addFiles(list: FileList | null) {
    if (!list) return;
    const heics = Array.from(list).filter(isHeic);
    if (heics.length === 0) {
      setError('Please choose HEIC or HEIF photos (the format iPhones shoot in).');
      return;
    }
    setError(null);
    setNotice(null);
    setResults((prev) => { revoke(prev); return []; });
    setFiles((cur) => [...cur, ...heics]);
  }

  function removeAt(i: number) { setFiles((cur) => cur.filter((_, j) => j !== i)); }

  function startOver() {
    setResults((prev) => { revoke(prev); return []; });
    setFiles([]);
    setSkipped([]);
    setError(null);
    setNotice(null);
    setElapsed(null);
    releasePreview();
  }

  // "Keep moving": carry the converted photos straight into JPG→PDF.
  function combineIntoPdf() {
    setHandoff({ files: results.map((r) => new File([r.blob], r.name, { type: r.blob.type })), from: 'HEIC to JPG' });
    router.push('/jpg-to-pdf');
  }

  async function run() {
    if (files.length === 0) { setError('Add a HEIC photo first.'); return; }
    // Free plan: one photo per job (batch is a Pro lever); size gate per file.
    const allowed = allowedBatchCount(files.length, plan);
    if (allowed < files.length) {
      setNotice(`Free converts one photo per go — converting the first. Pro unlocks batch conversion of all ${files.length}.`);
    }
    const queue = files.slice(0, allowed).filter((f) => {
      if (!canProcessSize(f.size, plan)) {
        setNotice(`“${f.name}” is over the free ${fmtBytes(FREE_MAX_BYTES)} limit and was skipped — Pro lifts the cap.`);
        return false;
      }
      return true;
    });
    if (queue.length === 0) return;

    setBusy(true);
    setError(null);
    setResults((prev) => { revoke(prev); return []; });
    setSkipped([]);
    try {
      const t0 = performance.now();
      const lib = await getLibheif();
      const out: Result[] = [];
      const fails: string[] = [];
      setProgress({ done: 0, total: queue.length });
      for (let qi = 0; qi < queue.length; qi++) {
        const file = queue[qi];
        try {
          const decoder = new lib.HeifDecoder();
          const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
          if (!images.length) throw new Error('no-images');
          const base = file.name.replace(/\.(heic|heif)$/i, '');
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const w = img.get_width();
            const h = img.get_height();
            if (!w || !h || w * h > MAX_PIXELS) { img.free?.(); continue; }
            const id = new ImageData(w, h);
            await new Promise<void>((res, rej) => img.display(id, (d) => (d ? res() : rej(new Error('decode')))));
            img.free?.();
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('no-canvas');
            ctx.putImageData(id, 0, 0);
            let blob: Blob | null;
            if (format === 'png') {
              blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
            } else {
              try {
                blob = await encodeJpeg(id, Q[quality]); // studio-grade mozjpeg
              } catch {
                blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', Q[quality] / 100));
              }
            }
            canvas.width = 0; canvas.height = 0;
            if (!blob) throw new Error('encode');
            const name = `${base}${images.length > 1 ? `-${i + 1}` : ''}.${format}`;
            out.push({ name, blob, url: URL.createObjectURL(blob), w, h });
            await yieldToLoop(); // progress repaints, tab stays responsive
          }
        } catch {
          fails.push(file.name);
        }
        setProgress({ done: qi + 1, total: queue.length });
      }
      if (out.length === 0) throw new Error('None of the photos could be converted — are they really HEIC files?');
      setElapsed((performance.now() - t0) / 1000);
      setResults(out);
      setSkipped(fails);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg && msg.length < 120 ? msg : 'Could not convert the photos.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function downloadAll() {
    if (results.length === 1) { download(results[0].blob, results[0].name); return; }
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    results.forEach((r) => zip.file(r.name, r.blob));
    download(await zip.generateAsync({ type: 'blob' }), 'converted-photos.zip');
  }

  // ---- results --------------------------------------------------------------
  if (results.length > 0) {
    const totalBytes = results.reduce((a, r) => a + r.blob.size, 0);
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold">Done — {results.length} photo{results.length === 1 ? '' : 's'} converted</p>
                <p className="text-xs text-muted-foreground">{format.toUpperCase()} · {fmt(totalBytes)} total{elapsed != null ? ` · ${formatDuration(elapsed)}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={startOver}><RotateCcw className="size-4" /> New photos</Button>
              <Button size="sm" onClick={downloadAll}><Download className="size-4" /> {results.length === 1 ? 'Download' : 'Download all (.zip)'}</Button>
            </div>
          </div>

          {notice && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              <Sparkles className="mt-0.5 size-4 shrink-0" /><span>{notice}</span>
            </p>
          )}
          {skipped.length > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Couldn’t convert: {skipped.join(', ')}</span>
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((r, i) => (
              <div key={i} className="group overflow-hidden rounded-xl border bg-card">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.name} className="max-h-full max-w-full rounded shadow-sm" loading="lazy" />
                </div>
                <div className="flex items-center justify-between gap-2 border-t p-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.w}×{r.h} · {fmt(r.blob.size)}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Download ${r.name}`} onClick={() => download(r.blob, r.name)}>
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <KeepMoving
            actions={[{
              count: results.length,
              fromIcon: ImageIcon,
              toIcon: FileText,
              toName: 'JPG to PDF',
              label: 'Combine into a PDF',
              blurb: `Send ${results.length === 1 ? 'the converted photo' : `all ${results.length} photos`} straight into JPG → PDF — no re-upload.`,
              onClick: combineIntoPdf,
            }]}
          />
          <KeepGoing exclude="/heic-to-jpg" />
        </CardContent>
      </Card>
    );
  }

  // ---- upload + options ------------------------------------------------------
  return (
    <Card>
      <CardContent className="p-5">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop iPhone photos here, or click to choose</p>
          <p className="text-xs text-muted-foreground">HEIC / HEIF in — JPG or PNG out, right on your device</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose photos</span>
          <input ref={inputRef} type="file" accept=".heic,.heif,image/heic,image/heif" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-600 dark:bg-sky-950/40"><FileImage className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(f.size)}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeAt(i)}><X className="size-4" /></Button>
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Output format</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setFormat('jpg')} aria-pressed={format === 'jpg'}
                  className={`rounded-xl border p-3 text-left transition-all ${format === 'jpg' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                  <span className="block text-sm font-semibold">JPG</span>
                  <span className="block text-xs text-muted-foreground">Opens everywhere — small files</span>
                </button>
                <button type="button" onClick={() => setFormat('png')} aria-pressed={format === 'png'}
                  className={`rounded-xl border p-3 text-left transition-all ${format === 'png' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                  <span className="block text-sm font-semibold">PNG</span>
                  <span className="block text-xs text-muted-foreground">Lossless — larger files</span>
                </button>
              </div>
            </div>
            {format === 'jpg' && (
              <div>
                <p className="mb-2 text-sm font-medium">Quality</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setQuality('high')} aria-pressed={quality === 'high'}
                    className={`rounded-xl border px-3 py-2 text-left transition-all ${quality === 'high' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                    <span className="block text-sm font-semibold">High</span>
                    <span className="block text-xs text-muted-foreground">Best detail · recommended</span>
                  </button>
                  <button type="button" onClick={() => setQuality('balanced')} aria-pressed={quality === 'balanced'}
                    className={`rounded-xl border px-3 py-2 text-left transition-all ${quality === 'balanced' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                    <span className="block text-sm font-semibold">Balanced</span>
                    <span className="block text-xs text-muted-foreground">Smaller files</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live quality preview — the first photo at this exact quality vs. the
                lossless original. iPhone HEICs can't show in a browser directly, so
                this decodes it for you. PNG is lossless, so no preview there. */}
            {format === 'jpg' && (beforePrev || preview || previewBusy) && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  Quality preview{files.length > 1 ? ' — first photo' : ''} · {quality === 'high' ? 'High' : 'Balanced'}
                  {previewBusy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                </p>
                <BeforeAfter
                  before={beforePrev}
                  after={preview}
                  beforeCaption="Original"
                  afterCaption={`JPG · ${quality === 'high' ? 'High' : 'Balanced'}`}
                  beforeLabel="Full quality"
                  afterLabel={`Quality ${Q[quality]}`}
                  loading={!preview}
                  zoomHint="Hover to zoom in and check the detail before you save"
                />
              </div>
            )}
          </div>
        )}

        {notice && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
            <Sparkles className="mt-0.5 size-4 shrink-0" /><span>{notice}</span>
          </p>
        )}
        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {files.length > 0 && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy
              ? <><Loader2 className="size-4 animate-spin" /> {progress ? `Converting ${progress.done}/${progress.total}…` : 'Converting…'}</>
              : <><ImageIcon className="size-4" /> Convert to {format.toUpperCase()}</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
