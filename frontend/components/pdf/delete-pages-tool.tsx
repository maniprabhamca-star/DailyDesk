'use client';
import { useFileSession } from '@/lib/editor-session';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { useFileHandoff } from '@/lib/file-handoff';
import { Upload, FileText, X, Download, Loader2, Trash2, Zap, RotateCcw, ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { openPdf, renderPage, dprTarget, useLazyPageThumb, prefetchPageThumbs, type PdfHandle } from '@/lib/pdf-render';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

// Whether each page is marked for removal. Deletion is lossless (pdf-lib
// removePage — the kept pages are untouched), so quality is preserved.
// Thumbnails render lazily through the shared queue as tiles scroll into view,
// so even a huge scanned book shows its grid instantly.

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DeleteTile({
  handle, index, marked, onToggle,
}: {
  handle: PdfHandle; index: number; marked: boolean; onToggle: (index: number) => void;
}) {
  const { ref, url, failed } = useLazyPageThumb<HTMLButtonElement>(handle, index, 170);
  return (
    <div className="group [contain-intrinsic-size:auto_220px] [content-visibility:auto]">
      <button
        ref={ref}
        type="button"
        onClick={() => onToggle(index)}
        aria-pressed={marked}
        aria-label={`${marked ? 'Keep' : 'Remove'} page ${index + 1}`}
        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/30 transition-all ${
          marked ? 'border-destructive ring-1 ring-destructive' : 'hover:border-destructive/40'
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Page ${index + 1}`}
            className={`max-h-[86%] max-w-[86%] object-contain shadow-sm transition-opacity ${marked ? 'opacity-30' : ''}`}
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            {failed ? <FileText className="size-5 text-muted-foreground/50" /> : <Loader2 className="size-5 animate-spin text-muted-foreground/50" />}
          </span>
        )}
        {marked && (
          <span className="absolute inset-0 flex items-center justify-center bg-destructive/5">
            <span className="flex size-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"><Trash2 className="size-[18px]" /></span>
          </span>
        )}
        <span className={`absolute left-2 top-2 flex size-4 items-center justify-center rounded border ${marked ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border bg-background/80'}`}>
          {marked && <Trash2 className="size-2.5" />}
        </span>
      </button>
      <p className={`mt-1 text-center text-xs ${marked ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
        {marked ? 'Will be removed' : `Page ${index + 1}`}
      </p>
    </div>
  );
}

export function DeletePagesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [markedPages, setMarkedPages] = useState<boolean[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanningBlank, setScanningBlank] = useState(false);
  const [blankScan, setBlankScan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const jobs = useCancelableJob();
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Free the pdf.js document (and its cached thumbnails) on replace/unmount.
  useEffect(() => () => { setHandle((prev) => { if (prev) void prev.destroy(); return null; }); }, []);

  useFileHandoff(loadOne);
  // Survive a background-tab discard: silently reload the last file.
  useFileSession('delete-pages', file, loadOne);
  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    setError(null);
    setDone(null);
    setBlankScan(null);
    setMarkedPages([]);
    setHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setFile(f);
    setParsing(true);
    try {
      const h = await openPdf(f);
      setHandle(h);
      // The grid shows instantly with placeholders; thumbnails stream in lazily,
      // and the rest warm in the background so scrolling never hits a spinner.
      setMarkedPages(Array.from({ length: h.numPages }, () => false));
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
    setMarkedPages([]);
    setFile(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setParsing(false);
    setBlankScan(null);
  }

  function toggleMark(i: number) {
    setDone(null);
    setMarkedPages((cur) => cur.map((m, idx) => (idx === i ? !m : m)));
  }
  const marked = markedPages.filter(Boolean).length;
  const remaining = markedPages.length - marked;
  const allMarked = markedPages.length > 0 && marked === markedPages.length;

  function toggleAll() {
    const next = !allMarked;
    setDone(null);
    setMarkedPages((cur) => cur.map(() => next));
  }
  function clearMarks() {
    setDone(null);
    setBlankScan(null);
    setMarkedPages((cur) => cur.map(() => false));
  }

  async function detectBlankPages() {
    if (!handle) return;
    setScanningBlank(true);
    setBlankScan(null);
    setError(null);
    setDone(null);
    try {
      const blanks: boolean[] = [];
      for (let page = 0; page < handle.numPages; page++) {
        const rp = await renderPage(handle, page, dprTarget(420, 1.2, 700));
        try {
          const blob = await (await fetch(rp.url)).blob();
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = rp.w;
          canvas.height = rp.h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            blanks.push(false);
            continue;
          }
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const data = ctx.getImageData(0, 0, rp.w, rp.h).data;
          const stepX = Math.max(1, Math.floor(rp.w / 90));
          const stepY = Math.max(1, Math.floor(rp.h / 120));
          let total = 0;
          let ink = 0;
          for (let y = 0; y < rp.h; y += stepY) {
            for (let x = 0; x < rp.w; x += stepX) {
              const p = (y * rp.w + x) * 4;
              const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
              if (a < 12) continue;
              total++;
              const lightness = r + g + b;
              const spread = Math.max(r, g, b) - Math.min(r, g, b);
              if (lightness < 735 || spread > 22) ink++;
            }
          }
          blanks.push(total > 0 && ink / total < 0.0035);
        } finally {
          URL.revokeObjectURL(rp.url);
        }
      }
      const found = blanks.filter(Boolean).length;
      if (found === 0) {
        setBlankScan('No likely blank pages found.');
        return;
      }
      setMarkedPages((cur) => cur.map((m, i) => m || blanks[i]));
      setBlankScan(`Found ${found} likely blank page${found === 1 ? '' : 's'} and selected ${found === 1 ? 'it' : 'them'}.`);
    } catch {
      setError('Could not scan for blank pages in this PDF.');
    } finally {
      setScanningBlank(false);
    }
  }

  async function apply() {
    if (!file || marked === 0 || remaining < 1) return;
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      // Rewrites run in a Web Worker so the page never freezes, even on huge files.
      const indices = markedPages.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
      const out = await rewritePdf(file, { type: 'delete', indices }, { signal });
      if (!jobs.isCurrent(id)) return;
      const name = `${file.name.replace(/\.pdf$/i, '')}-pages-removed.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return;
      setError(e instanceof Error ? e.message : 'Could not delete the pages.');
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
            <p className="text-xs text-muted-foreground">See every page and tap the ones to remove</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)} · {markedPages.length || '…'} page{markedPages.length === 1 ? '' : 's'}</p>
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
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={allMarked} onChange={toggleAll} />
                    Select all
                  </label>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <Button size="sm" variant="ghost" onClick={clearMarks} disabled={marked === 0}><RotateCcw className="size-4" /> Clear</Button>
                  <Button size="sm" variant="outline" onClick={detectBlankPages} disabled={scanningBlank}>
                    {scanningBlank ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />} Detect blank pages
                  </Button>
                  {blankScan && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{blankScan}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {marked > 0 ? <><span className="font-semibold text-destructive">{marked} to remove</span> · {remaining} will remain</> : 'Tap pages to remove them'}
                  </span>
                </div>

                {/* page grid — thumbnails stream in as you scroll */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {markedPages.map((m, i) => (
                    <DeleteTile key={i} handle={handle} index={i} marked={m} onToggle={toggleMark} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {error && <UploadError error={error} />}
        {file && !parsing && allMarked && (
          <p className="mt-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">You can’t remove every page — keep at least one.</p>
        )}

        {file && !parsing && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Removing…</Button>
              <Button size="lg" variant="outline" onClick={cancelApply}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={marked === 0 || remaining < 1}>
              <Download className="size-4" /> {marked > 0 ? `Remove ${marked} page${marked === 1 ? '' : 's'} & download` : 'Remove pages & download'}
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/delete-pages-from-pdf" fromLabel="Delete Pages" />}
      </CardContent>
    </Card>
  );
}
