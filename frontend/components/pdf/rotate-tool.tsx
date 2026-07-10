'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, RotateCw, RotateCcw, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, useLazyPageThumb, prefetchPageThumbs, type PdfHandle } from '@/lib/pdf-render';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

// Per-page pending rotation (delta added on top of the page's existing rotation)
// + selection. Rotation is applied LOSSLESSLY with pdf-lib (it just sets the
// page's rotation flag — no re-rendering), so output quality is untouched.
// Thumbnails render lazily through the shared queue as tiles scroll into view,
// so even a 1000-page scanned book shows its grid instantly.
type PageState = { delta: number; selected: boolean };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const norm = (d: number) => ((d % 360) + 360) % 360;

function RotateTile({
  handle, index, state, onRotate, onToggle,
}: {
  handle: PdfHandle; index: number; state: PageState;
  onRotate: (index: number, dir: 1 | -1) => void; onToggle: (index: number) => void;
}) {
  const { ref, url, failed } = useLazyPageThumb<HTMLDivElement>(handle, index, 170);
  return (
    <div className="group [contain-intrinsic-size:auto_220px] [content-visibility:auto]">
      <div
        ref={ref}
        className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted/30 transition-colors ${state.selected ? 'border-primary ring-1 ring-primary' : ''}`}
      >
        <input
          type="checkbox"
          aria-label={`Select page ${index + 1}`}
          className="absolute left-2 top-2 z-10 size-4 accent-[hsl(var(--primary))]"
          checked={state.selected}
          onChange={() => onToggle(index)}
        />
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Page ${index + 1}`}
            className="max-h-[86%] max-w-[86%] object-contain shadow-sm transition-transform duration-200"
            style={{ transform: `rotate(${state.delta}deg)` }}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            {failed ? <FileText className="size-5 text-muted-foreground/50" /> : <Loader2 className="size-5 animate-spin text-muted-foreground/50" />}
          </div>
        )}
        {/* per-page rotate controls (always visible on touch, hover on desktop) */}
        <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={() => onRotate(index, -1)} aria-label={`Rotate page ${index + 1} left`} className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-background"><RotateCcw className="size-3.5" /></button>
          <button onClick={() => onRotate(index, 1)} aria-label={`Rotate page ${index + 1} right`} className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90"><RotateCw className="size-3.5" /></button>
        </div>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">Page {index + 1}{state.delta ? ` · ${state.delta}°` : ''}</p>
    </div>
  );
}

export function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const jobs = useCancelableJob();

  // Free the pdf.js document (and its cached thumbnails) on replace/unmount.
  useEffect(() => () => { setHandle((prev) => { if (prev) void prev.destroy(); return null; }); }, []);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    setError(null);
    setDone(null);
    setPages([]);
    setHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setFile(f);
    setParsing(true);
    try {
      const h = await openPdf(f);
      setHandle(h);
      // The grid shows instantly with placeholders; thumbnails stream in lazily,
      // and the rest warm in the background so scrolling never hits a spinner.
      setPages(Array.from({ length: h.numPages }, () => ({ delta: 0, selected: false })));
      prefetchPageThumbs(h, 170);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      setParsing(false);
    }
  }

  function pick(files: FileList | null) { void loadOne(files?.[0]); }

  // "Keep moving": pick up a PDF handed over from another tool, no re-upload.
  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      void loadOne(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    setHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setPages([]);
    setFile(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setParsing(false);
  }

  function rotatePage(i: number, dir: 1 | -1) {
    setDone(null);
    setPages((cur) => cur.map((p, idx) => (idx === i ? { ...p, delta: norm(p.delta + dir * 90) } : p)));
  }

  function bulkRotate(dir: 1 | -1) {
    setDone(null);
    const anySelected = pages.some((p) => p.selected);
    setPages((cur) => cur.map((p) => (!anySelected || p.selected ? { ...p, delta: norm(p.delta + dir * 90) } : p)));
  }

  const allSelected = pages.length > 0 && pages.every((p) => p.selected);
  function toggleAll() {
    const next = !allSelected;
    setPages((cur) => cur.map((p) => ({ ...p, selected: next })));
  }
  function toggleOne(i: number) {
    setPages((cur) => cur.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));
  }
  function reset() {
    setDone(null);
    setPages((cur) => cur.map(() => ({ delta: 0, selected: false })));
  }

  const changes = pages.filter((p) => p.delta !== 0).length;

  async function apply() {
    if (!file || changes === 0) return;
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      // Rewrites run in a Web Worker so the page never freezes, even on huge files.
      const out = await rewritePdf(file, { type: 'rotate', deltas: pages.map((p) => p.delta) }, { signal });
      if (!jobs.isCurrent(id)) return; // cancelled or superseded
      const name = `${file.name.replace(/\.pdf$/i, '')}-rotated.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return; // quiet on cancel
      setError(e instanceof Error ? e.message : 'Could not rotate the PDF.');
    } finally {
      if (jobs.isCurrent(id)) setBusy(false);
    }
  }
  function cancelApply() {
    jobs.cancel();
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}

        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">See every page and rotate them visually</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)} · {pages.length || '…'} page{pages.length === 1 ? '' : 's'}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
            </div>

            {parsing || !handle ? (
              <div className="mt-6 flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <p className="text-sm">Opening your PDF…</p>
              </div>
            ) : (
              <>
                {/* toolbar */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={allSelected} onChange={toggleAll} />
                    Select all
                  </label>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <Button size="sm" variant="outline" onClick={() => bulkRotate(-1)}><RotateCcw className="size-4" /> Left</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkRotate(1)}><RotateCw className="size-4" /> Right</Button>
                  <Button size="sm" variant="ghost" onClick={reset} disabled={changes === 0}><RefreshCw className="size-4" /> Reset</Button>
                  <span className="ml-auto text-xs text-muted-foreground">{changes > 0 ? `${changes} page${changes === 1 ? '' : 's'} to rotate` : 'Tap a page to rotate'}</span>
                </div>

                {/* page grid — thumbnails stream in as you scroll */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {pages.map((p, i) => (
                    <RotateTile key={i} handle={handle} index={i} state={p} onRotate={rotatePage} onToggle={toggleOne} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {error && <UploadError error={error} />}

        {file && !parsing && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Rotating…</Button>
              <Button size="lg" variant="outline" onClick={cancelApply}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={changes === 0}>
              <Download className="size-4" /> {changes > 0 ? `Rotate ${changes} page${changes === 1 ? '' : 's'} & download` : 'Rotate & download'}
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/rotate-pdf" fromLabel="Rotate PDF" />}
      </CardContent>
    </Card>
  );
}
