'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, ArrowUp, ArrowDown, Download, Loader2, Zap, ArrowLeft, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UploadError } from '@/components/app/upload-error';
import { mergePdfs, mergePdfPages } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';
import { useIsOwner } from '@/lib/plan';
import { openPdf, useLazyPageThumb, prefetchPageThumbs, type PdfHandle } from '@/lib/pdf-render';

type Item = { id: string; file: File };
type PageRef = { key: string; srcId: string; page: number }; // page is 0-based

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// One draggable page thumbnail in the page-level organize grid. Keyed by its
// stable page key so the thumbnail never re-renders while pages are reordered.
function PageTile({
  handle, page, slot, label, dragging, onDragStart, onDragEnter, onDragEnd, onRemove,
}: {
  handle: PdfHandle; page: number; slot: number; label: string; dragging: boolean;
  onDragStart: (slot: number) => void; onDragEnter: (slot: number) => void; onDragEnd: () => void; onRemove: () => void;
}) {
  const { ref, url, failed } = useLazyPageThumb<HTMLDivElement>(handle, page, 150);
  return (
    <div className="group [contain-intrinsic-size:auto_240px] [content-visibility:auto]">
      <div
        ref={ref}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(slot); }}
        onDragEnter={(e) => { e.preventDefault(); onDragEnter(slot); }}
        onDragOver={(e) => e.preventDefault()}
        onDragEnd={onDragEnd}
        aria-label={`${label}, position ${slot + 1}. Drag to reorder.`}
        className={`relative flex aspect-[3/4] cursor-grab items-center justify-center overflow-hidden rounded-xl border bg-muted/30 transition-all active:cursor-grabbing ${dragging ? 'border-primary opacity-60 ring-2 ring-primary' : 'hover:border-primary/50'}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="pointer-events-none max-h-[92%] max-w-[92%] object-contain shadow-sm" />
        ) : (
          <span className="flex size-full items-center justify-center">
            {failed ? <FileText className="size-5 text-muted-foreground/50" /> : <Loader2 className="size-5 animate-spin text-muted-foreground/50" />}
          </span>
        )}
        <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-[11px] font-semibold text-primary-foreground">{slot + 1}</span>
        <button
          onClick={onRemove}
          aria-label="Remove page"
          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground opacity-100 shadow ring-1 ring-border transition-colors hover:bg-destructive hover:text-destructive-foreground sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function MergeTool() {
  const isOwner = useIsOwner();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const jobs = useCancelableJob();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Page-level organize mode (owner-only until launch).
  const [pageMode, setPageMode] = useState(false);
  const [opening, setOpening] = useState(false);
  const [handles, setHandles] = useState<Record<string, PdfHandle>>({});
  const [pages, setPages] = useState<PageRef[]>([]);
  const dragFrom = useRef<number | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);

  // Destroy every open pdf.js handle on unmount (frees memory / blob URLs).
  const handlesRef = useRef(handles);
  handlesRef.current = handles;
  useEffect(() => () => { Object.values(handlesRef.current).forEach((h) => { try { void h.destroy(); } catch { /* gone */ } }); }, []);

  function addPdfFiles(pdfs: File[]) {
    if (pdfs.length === 0) return;
    setDone(null);
    setItems((cur) => [...cur, ...pdfs.map((f) => ({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, file: f }))]);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setError('Those files aren’t PDFs — Merge combines PDF files.');
      return;
    }
    setError(null);
    addPdfFiles(pdfs);
  }

  // "Keep moving": pick up PDF(s) handed over from another tool, no re-upload.
  useEffect(() => {
    const h = takeHandoff();
    const pdfs = h?.files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) ?? [];
    if (h && pdfs.length) {
      setHandoffNote(`${pdfs.length} PDF${pdfs.length === 1 ? '' : 's'} brought straight over from ${h.from} — add more to merge.`);
      addPdfFiles(pdfs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While organizing, keep the grid in sync when more files are dropped: open
  // each new file once and append its pages to the end.
  useEffect(() => {
    if (!pageMode) return;
    let cancelled = false;
    (async () => {
      const missing = items.filter((it) => !handles[it.id]);
      if (missing.length === 0) return;
      const next = { ...handles };
      for (const it of missing) {
        try { next[it.id] = await openPdf(it.file); prefetchPageThumbs(next[it.id], 150); } catch { /* skip unreadable */ }
      }
      if (cancelled) return;
      setHandles(next);
      setPages((cur) => {
        const out = cur.slice();
        for (const it of missing) {
          const h = next[it.id];
          if (!h) continue;
          for (let p = 0; p < h.numPages; p++) out.push({ key: `${it.id}:${p}`, srcId: it.id, page: p });
        }
        return out;
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pageMode]);

  function move(i: number, dir: -1 | 1) {
    setItems((cur) => {
      const next = [...cur];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function remove(id: string) {
    setItems((cur) => cur.filter((it) => it.id !== id));
  }

  async function enterPageMode() {
    if (items.length === 0) return;
    setOpening(true);
    setError(null);
    setDone(null);
    try {
      const next: Record<string, PdfHandle> = { ...handles };
      const pg: PageRef[] = [];
      for (const it of items) {
        let h = next[it.id];
        if (!h) { h = await openPdf(it.file); next[it.id] = h; }
        prefetchPageThumbs(h, 150);
        for (let p = 0; p < h.numPages; p++) pg.push({ key: `${it.id}:${p}`, srcId: it.id, page: p });
      }
      setHandles(next);
      setPages(pg);
      setPageMode(true);
    } catch {
      setError('Could not open one of the PDFs — it may be corrupted or password-protected.');
    } finally {
      setOpening(false);
    }
  }

  function resetPages() {
    setDone(null);
    const pg: PageRef[] = [];
    for (const it of items) {
      const h = handles[it.id];
      if (!h) continue;
      for (let p = 0; p < h.numPages; p++) pg.push({ key: `${it.id}:${p}`, srcId: it.id, page: p });
    }
    setPages(pg);
  }

  function movePage(from: number, to: number) {
    if (to < 0 || to >= pages.length || from === to) return;
    setDone(null);
    setPages((cur) => {
      const next = cur.slice();
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  }
  const onDragStart = (slot: number) => { dragFrom.current = slot; setDraggingSlot(slot); };
  const onDragEnter = (slot: number) => {
    const from = dragFrom.current;
    if (from === null || from === slot) return;
    movePage(from, slot);
    dragFrom.current = slot;
    setDraggingSlot(slot);
  };
  const onDragEnd = () => { dragFrom.current = null; setDraggingSlot(null); };
  function removePage(key: string) { setDone(null); setPages((cur) => cur.filter((p) => p.key !== key)); }

  async function merge() {
    if (pageMode) {
      if (pages.length < 1) { setError('Keep at least one page to merge.'); return; }
    } else if (items.length < 2) {
      setError('Add at least two PDFs to merge.');
      return;
    }
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      let mergedBytes: Uint8Array;
      if (pageMode) {
        const srcs = items.map((it) => it.file);
        const idx: Record<string, number> = {};
        items.forEach((it, i) => { idx[it.id] = i; });
        const plan = pages.map((pr) => ({ src: idx[pr.srcId], page: pr.page }));
        mergedBytes = await mergePdfPages(srcs, plan, { signal });
      } else {
        // pdf-lib runs in the rewrite WORKER — merging very large files no longer
        // freezes the tab (buffers are transferred, zero-copy).
        mergedBytes = await mergePdfs(items.map((it) => it.file), { signal });
      }
      if (!jobs.isCurrent(id)) return;
      const name = 'merged.pdf';
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return;
      setError(e instanceof Error ? `Could not merge: ${e.message}` : 'Could not merge the files.');
    } finally {
      if (jobs.isCurrent(id)) setBusy(false);
    }
  }
  function cancelMerge() {
    jobs.cancel();
    setBusy(false);
  }

  const nameById: Record<string, string> = {};
  items.forEach((it) => { nameById[it.id] = it.file.name; });

  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop PDFs here, or click to choose</p>
          <p className="text-xs text-muted-foreground">Select two or more files</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDFs</span>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        {/* FILE-LIST mode (default) */}
        {!pageMode && items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(it.file.size)}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(it.id)}><X className="size-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Owner-only entry into page-level organize — a premium feature card so
            it clearly reads as an extra capability, not just another button. */}
        {isOwner && !pageMode && items.length > 0 && (
          <button
            onClick={enterPageMode}
            disabled={opening}
            className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.09] to-violet-500/[0.06] p-3.5 text-left transition-all hover:border-primary/55 hover:shadow-sm disabled:opacity-70"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner">
              {opening ? <Loader2 className="size-5 animate-spin" /> : <Layers className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Organize pages</span>
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">New</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {opening ? 'Opening your pages…' : 'See every page as a thumbnail — pick, drop and reorder pages across all your files before merging.'}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <span className="hidden sm:inline">Open</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        )}

        {/* PAGE-LEVEL organize grid */}
        {pageMode && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPageMode(false)}><ArrowLeft className="size-4" /> File list</Button>
              <Button size="sm" variant="ghost" onClick={resetPages}><RefreshCw className="size-4" /> Reset order</Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {pages.length} page{pages.length === 1 ? '' : 's'} · drag to reorder, ✕ to remove
              </span>
            </div>
            {pages.length === 0 ? (
              <p className="mt-6 py-8 text-center text-sm text-muted-foreground">All pages removed — reset to start over.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {pages.map((pr, slot) => {
                  const h = handles[pr.srcId];
                  if (!h) return null;
                  return (
                    <PageTile
                      key={pr.key}
                      handle={h}
                      page={pr.page}
                      slot={slot}
                      label={`${nameById[pr.srcId] ?? 'PDF'} · p${pr.page + 1}`}
                      dragging={draggingSlot === slot}
                      onDragStart={onDragStart}
                      onDragEnter={onDragEnter}
                      onDragEnd={onDragEnd}
                      onRemove={() => removePage(pr.key)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {error && <UploadError error={error} />}

        {busy ? (
          <div className="mt-5 flex gap-2">
            <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Merging…</Button>
            <Button size="lg" variant="outline" onClick={cancelMerge}><X className="size-4" /> Cancel</Button>
          </div>
        ) : (
          <Button className="mt-5 w-full" size="lg" onClick={merge} disabled={pageMode ? pages.length < 1 : items.length < 2}>
            <Download className="size-4" /> {pageMode ? `Merge ${pages.length} page${pages.length === 1 ? '' : 's'}` : `Merge ${items.length > 0 ? `${items.length} ` : ''}PDFs`}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/merge-pdf" fromLabel="Merge PDF" />}
      </CardContent>
    </Card>
  );
}
