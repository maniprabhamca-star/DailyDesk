'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

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

// Export-path renderer: render a pdf.js page STRAIGHT to a canvas, clean the
// pixels, and encode ONE JPEG. Avoids the preview path's extra JPEG encode +
// fetch + createImageBitmap decode per page (roughly halves the work), and
// returns the page's point size so the output page matches the original.
async function renderCleanToJpeg(handle: PdfHandle, index: number, mode: Mode, contrast: number, targetLong: number) {
  const page = await handle.doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = targetLong / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas context.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const boost = 1 + contrast / 60;
  for (let p = 0; p < d.length; p += 4) {
    const gray = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    let v = (gray - 128) * boost + 128;
    if (mode === 'bw') v = v > 178 ? 255 : 0;
    else v = Math.max(0, Math.min(255, v + 8));
    d[p] = v; d[p + 1] = v; d[p + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
  const jpeg = await new Promise<ArrayBuffer>((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve) : reject(new Error('Could not encode page image.'))), 'image/jpeg', mode === 'bw' ? 0.85 : 0.88),
  );
  canvas.width = 0;
  canvas.height = 0;
  return { jpeg, w: base.width, h: base.height };
}

export function CleanScannedPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<Mode>('clean');
  const [contrast, setContrast] = useState(18);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const cancelRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [beforePreview, setBeforePreview] = useState<RenderedPage | null>(null);
  const [afterPreview, setAfterPreview] = useState<RenderedPage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
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
      const rp = await renderPage(handle, 0, dprTarget(720, 1.15, 950));
      // renderPage caches the blob URL inside the handle, and handle.destroy()
      // revokes every cached URL. So copy the image into an INDEPENDENT object
      // URL before we destroy the handle — otherwise the preview <img> points at
      // a revoked URL (broken Original) and cleanRenderedPage's fetch() throws
      // (Cleaned spins forever). This also frees the whole PDF doc immediately.
      const bytes = await (await fetch(rp.url)).blob();
      if (cancelled) return;
      const detached: RenderedPage = { url: URL.createObjectURL(bytes), w: rp.w, h: rp.h };
      setBeforePreview(detached);
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
  }, [file]);

  useEffect(() => {
    if (!beforePreview) {
      setAfterPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewBusy(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const cleaned = await cleanRenderedPage(beforePreview, mode, contrast);
        if (cancelled) {
          URL.revokeObjectURL(cleaned.page.url);
          return;
        }
        setAfterPreview(cleaned.page);
      })().catch(() => {
        if (!cancelled) setAfterPreview(null);
      }).finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [beforePreview, mode, contrast]);

  function cancelRun() {
    cancelRef.current = true; // the batch loop bails on its next iteration
  }
  async function run() {
    if (!file) return;
    cancelRef.current = false;
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    let handle: PdfHandle | null = null;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const out = await PDFDocument.create();
      handle = await openPdf(file);
      const total = handle.numPages;
      // Scanned pages don't need huge rasters to stay readable; a lower long
      // edge cuts render + encode time a lot. B&W keeps a touch more for edges.
      const targetLong = mode === 'bw' ? 1650 : 1500;
      // Render a few pages at once (pdf.js decode + JPEG encode overlap), but
      // embed them in order so peak memory stays at ~`conc` pages — safe for
      // documents of any length.
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
      const conc = Math.max(2, Math.min(4, cores));
      let processed = 0;
      for (let start = 0; start < total; start += conc) {
        if (cancelRef.current) throw new DOMException('Cancelled', 'AbortError');
        const batch: number[] = [];
        for (let i = start; i < Math.min(start + conc, total); i++) batch.push(i);
        const results = await Promise.all(batch.map((i) => renderCleanToJpeg(handle as PdfHandle, i, mode, contrast, targetLong)));
        for (const r of results) {
          const img = await out.embedJpg(r.jpeg);
          const page = out.addPage([r.w, r.h]);
          page.drawImage(img, { x: 0, y: 0, width: r.w, height: r.h });
          processed++;
        }
        setProgress(`Cleaning page ${Math.min(processed, total)} of ${total}`);
      }
      const bytes = await out.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const name = `${file.name.replace(/\.pdf$/i, '')}-clean-scan.pdf`;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { /* cancelled — quiet */ }
      else setError(e instanceof Error ? e.message : 'Could not clean this PDF.');
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
        {error && <UploadError error={error} />}

        {file && !done && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Cleaning...</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}>
              <WandSparkles className="size-4" /> Clean scanned PDF
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/clean-scanned-pdf" fromLabel="Clean Scanned PDF" />}
      </CardContent>
    </Card>
  );
}
