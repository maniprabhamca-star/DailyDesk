'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, WandSparkles, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { BeforeAfter } from '@/components/pdf/before-after';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';

type Mode = 'clean' | 'bw';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function blobFromCanvas(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('Could not encode page image.');
  return blob;
}

async function cleanRenderedPage(rp: RenderedPage, mode: Mode, contrast: number) {
  const blob = await (await fetch(rp.url)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = rp.w;
  canvas.height = rp.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas context.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, rp.w, rp.h);
  const d = img.data;
  const boost = 1 + contrast / 60;
  for (let p = 0; p < d.length; p += 4) {
    const gray = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    let v = (gray - 128) * boost + 128;
    if (mode === 'bw') v = v > 178 ? 255 : 0;
    else v = Math.max(0, Math.min(255, v + 8));
    d[p] = v; d[p + 1] = v; d[p + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const cleaned = await blobFromCanvas(canvas, 'image/jpeg', mode === 'bw' ? 0.86 : 0.9);
  return { blob: cleaned, page: { url: URL.createObjectURL(cleaned), w: rp.w, h: rp.h } satisfies RenderedPage };
}

export function CleanScannedPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<Mode>('clean');
  const [contrast, setContrast] = useState(18);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [beforePreview, setBeforePreview] = useState<RenderedPage | null>(null);
  const [afterPreview, setAfterPreview] = useState<RenderedPage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setFile(f);
    setDone(null);
    setError(null);
    setBusy(true);
    let handle: PdfHandle | null = null;
    try {
      handle = await openPdf(f);
      setPageCount(handle.numPages);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      if (handle) void handle.destroy();
      setBusy(false);
    }
  }

  function clear() {
    setFile(null);
    setPageCount(0);
    setDone(null);
    setError(null);
    setProgress('');
  }

  useEffect(() => {
    return () => { if (beforePreview) URL.revokeObjectURL(beforePreview.url); };
  }, [beforePreview]);

  useEffect(() => {
    return () => { if (afterPreview) URL.revokeObjectURL(afterPreview.url); };
  }, [afterPreview]);

  useEffect(() => {
    if (!file) {
      setBeforePreview(null);
      setAfterPreview(null);
      setPreviewBusy(false);
      return;
    }
    let cancelled = false;
    let handle: PdfHandle | null = null;
    setPreviewBusy(true);
    setBeforePreview(null);
    setAfterPreview(null);
    (async () => {
      handle = await openPdf(file);
      const rp = await renderPage(handle, 0, dprTarget(950, 1.4, 1200));
      const cleaned = await cleanRenderedPage(rp, mode, contrast);
      if (cancelled) {
        URL.revokeObjectURL(rp.url);
        URL.revokeObjectURL(cleaned.page.url);
        return;
      }
      setBeforePreview(rp);
      setAfterPreview(cleaned.page);
    })().catch(() => {
      if (!cancelled) {
        setBeforePreview(null);
        setAfterPreview(null);
      }
    }).finally(() => {
      if (!cancelled) setPreviewBusy(false);
      if (handle) void handle.destroy();
    });
    return () => {
      cancelled = true;
    };
  }, [file, mode, contrast]);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    let handle: PdfHandle | null = null;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const out = await PDFDocument.create();
      const original = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const sizes = original.getPages().map((p) => p.getSize());
      handle = await openPdf(file);
      for (let i = 0; i < handle.numPages; i++) {
        setProgress(`Cleaning page ${i + 1} of ${handle.numPages}`);
        const rp = await renderPage(handle, i, dprTarget(1500, 1.4, 1900));
        try {
          const cleaned = await cleanRenderedPage(rp, mode, contrast);
          const jpg = await out.embedJpg(await cleaned.blob.arrayBuffer());
          URL.revokeObjectURL(cleaned.page.url);
          const size = sizes[i] || { width: jpg.width, height: jpg.height };
          const page = out.addPage([size.width, size.height]);
          page.drawImage(jpg, { x: 0, y: 0, width: size.width, height: size.height });
        } finally {
          URL.revokeObjectURL(rp.url);
        }
      }
      const bytes = await out.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const name = `${file.name.replace(/\.pdf$/i, '')}-clean-scan.pdf`;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clean this PDF.');
    } finally {
      if (handle) void handle.destroy();
      setProgress('');
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a scanned PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Improve contrast, grayscale, and readability on-device</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}{pageCount ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {file && (
          <div className="mt-4 grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={mode === 'clean' ? 'primary' : 'outline'} onClick={() => setMode('clean')}>Clean grayscale</Button>
              <Button size="sm" variant={mode === 'bw' ? 'primary' : 'outline'} onClick={() => setMode('bw')}>Black & white</Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Contrast</span>
              <input type="range" min="0" max="50" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
            </label>
          </div>
        )}

        {file && (
          <div className="mt-4 rounded-xl border bg-card p-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Quality preview</p>
                <p className="text-xs text-muted-foreground">First page before and after, rendered on this device.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{mode === 'bw' ? 'Black & white' : 'Clean grayscale'}</span>
            </div>
            <BeforeAfter
              before={beforePreview}
              after={afterPreview}
              beforeCaption="Original"
              afterCaption="Cleaned"
              beforeLabel="Current scan"
              afterLabel={mode === 'bw' ? 'High contrast' : 'Readable grayscale'}
              loading={previewBusy || !beforePreview || !afterPreview}
              zoomHint="Hover the preview to inspect edges and small text"
            />
          </div>
        )}

        {busy && <p className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {progress || 'Opening PDF...'}</p>}
        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Cleaning...</> : <><WandSparkles className="size-4" /> Clean scanned PDF</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/clean-scanned-pdf" fromLabel="Clean Scanned PDF" />}
      </CardContent>
    </Card>
  );
}
