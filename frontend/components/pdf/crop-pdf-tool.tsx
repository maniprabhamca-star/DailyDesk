'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Crop, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

type Box = { x: number; y: number; w: number; h: number };
type Gesture = { mode: 'move' | 'resize'; dx: number; dy: number } | null;

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CropPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [box, setBox] = useState<Box>({ x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(null);
  const jobs = useCancelableJob();

  // Revoke the preview blob URL when it changes / on unmount.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function pick(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError(wrongTypeError(f.name)); return; }
    setError(null);
    setDone(null);
    setFile(f);
    setBox({ x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
    setPreviewBusy(true);
    setPreview(null);
    let handle: PdfHandle | null = null;
    try {
      handle = await openPdf(f);
      setPageCount(handle.numPages);
      const rp = await renderPage(handle, 0, dprTarget(760, 1.2, 1000));
      // Detach the blob into our own URL, THEN destroy the handle — renderPage
      // caches its URL inside the handle and destroy() revokes it, which would
      // otherwise break the <img>. (See the render-handle blob-URL gotcha.)
      const bytes = await (await fetch(rp.url)).blob();
      setPreview({ url: URL.createObjectURL(bytes), w: rp.w, h: rp.h });
    } catch {
      setError('Could not open that PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      if (handle) void handle.destroy();
      setPreviewBusy(false);
    }
  }

  function clear() {
    setFile(null);
    setPageCount(0);
    setPreview(null);
    setDone(null);
    setError(null);
  }

  function framePos(e: React.PointerEvent): { x: number; y: number } | null {
    const r = frameRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function onBoxDown(e: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    e.stopPropagation();
    const p = framePos(e);
    if (!p) return;
    gesture.current = mode === 'move' ? { mode, dx: p.x - box.x, dy: p.y - box.y } : { mode, dx: 0, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDone(null);
  }
  function onFrameMove(e: React.PointerEvent) {
    const g = gesture.current;
    const p = framePos(e);
    if (!g || !p) return;
    setBox((b) => {
      if (g.mode === 'move') {
        return { ...b, x: Math.min(Math.max(p.x - g.dx, 0), 1 - b.w), y: Math.min(Math.max(p.y - g.dy, 0), 1 - b.h) };
      }
      const w = Math.min(Math.max(p.x - b.x, 0.05), 1 - b.x);
      const h = Math.min(Math.max(p.y - b.y, 0.05), 1 - b.y);
      return { ...b, w, h };
    });
  }
  function onFrameUp() { gesture.current = null; }

  const trimmed = box.x > 0.001 || box.y > 0.001 || box.w < 0.999 || box.h < 0.999;

  async function apply() {
    if (!file) return;
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      const out = await rewritePdf(file, { type: 'crop', opts: { xFrac: box.x, yFrac: box.y, wFrac: box.w, hFrac: box.h } }, { signal });
      if (!jobs.isCurrent(id)) return;
      const name = `${file.name.replace(/\.pdf$/i, '')}-cropped.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return;
      setError(e instanceof Error ? e.message : 'Could not crop the PDF.');
    } finally {
      if (jobs.isCurrent(id)) setBusy(false);
    }
  }
  function cancelApply() { jobs.cancel(); setBusy(false); }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

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
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Trim margins or crop every page — on your device, nothing uploaded</p>
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
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">Drag the box to move it, or drag its bottom-right corner to resize. The crop applies to <span className="font-medium text-foreground">every page</span> (proportionally, so mixed page sizes stay aligned).</p>
            <div className="flex justify-center rounded-xl border bg-muted/30 p-3">
              {preview ? (
                <div
                  ref={frameRef}
                  onPointerMove={onFrameMove}
                  onPointerUp={onFrameUp}
                  onPointerLeave={onFrameUp}
                  className="relative select-none touch-none"
                  style={{ width: 'min(100%, 420px)', aspectRatio: `${preview.w} / ${preview.h}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt="Page 1 preview" className="pointer-events-none absolute inset-0 h-full w-full rounded-md object-contain" draggable={false} />
                  {/* dimmed outside area */}
                  <div className="pointer-events-none absolute inset-0 rounded-md" style={{ boxShadow: `inset 0 0 0 9999px rgba(0,0,0,0)`, clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${pct(box.y)}, ${pct(box.x)} ${pct(box.y)}, ${pct(box.x)} ${pct(box.y + box.h)}, ${pct(box.x + box.w)} ${pct(box.y + box.h)}, ${pct(box.x + box.w)} ${pct(box.y)}, 0 ${pct(box.y)})`, background: 'rgba(0,0,0,0.45)' }} />
                  {/* crop box */}
                  <div
                    onPointerDown={(e) => onBoxDown(e, 'move')}
                    className="absolute cursor-move rounded-sm border-2 border-primary"
                    style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
                  >
                    <span
                      onPointerDown={(e) => onBoxDown(e, 'resize')}
                      className="absolute -bottom-2 -right-2 size-4 cursor-se-resize rounded-full border-2 border-white bg-primary shadow"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  {previewBusy ? <Loader2 className="size-6 animate-spin" /> : <span className="text-sm">No preview</span>}
                </div>
              )}
            </div>
            {trimmed && (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Keeping the middle {pct(box.w)} × {pct(box.h)} of each page.</span>
                <button onClick={() => setBox({ x: 0.06, y: 0.06, w: 0.88, h: 0.88 })} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><RotateCcw className="size-3" /> Reset</button>
              </div>
            )}
          </div>
        )}

        {error && <UploadError error={error} />}

        {file && !done && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Cropping…</Button>
              <Button size="lg" variant="outline" onClick={cancelApply}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={!trimmed}>
              <Crop className="size-4" /> {trimmed ? 'Crop & download' : 'Drag the box to crop'}
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/crop-pdf" fromLabel="Crop PDF" />}
      </CardContent>
    </Card>
  );
}
