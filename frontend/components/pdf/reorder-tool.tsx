'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { useFileHandoff } from '@/lib/file-handoff';
import { Upload, FileText, X, Download, Loader2, Zap, RefreshCw, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { openPdf, useLazyPageThumb, prefetchPageThumbs, type PdfHandle } from '@/lib/pdf-render';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

// Reorder PDF pages — drag pages into a new order (or use the arrow buttons on
// touch), with lossless page copying. The rewrite runs in a Web Worker, so even
// gigabyte files reorder without freezing the page.

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ReorderTile({
  handle, pageIndex, slot, total, dragging, onDragStart, onDragEnter, onDragEnd, onMove,
}: {
  handle: PdfHandle; pageIndex: number; slot: number; total: number; dragging: boolean;
  onDragStart: (slot: number) => void; onDragEnter: (slot: number) => void; onDragEnd: () => void;
  onMove: (slot: number, dir: 1 | -1) => void;
}) {
  // Keyed by ORIGINAL page index → the thumbnail never re-renders on reorder.
  const { ref, url, failed } = useLazyPageThumb<HTMLDivElement>(handle, pageIndex, 170);
  const moved = pageIndex !== slot;
  return (
    <div className="group [contain-intrinsic-size:auto_220px] [content-visibility:auto]">
      <div
        ref={ref}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(slot); }}
        onDragEnter={(e) => { e.preventDefault(); onDragEnter(slot); }}
        onDragOver={(e) => e.preventDefault()}
        onDragEnd={onDragEnd}
        aria-label={`Page ${pageIndex + 1}, now in position ${slot + 1}. Drag to reorder.`}
        className={`relative flex aspect-square cursor-grab items-center justify-center overflow-hidden rounded-xl border bg-muted/30 transition-all active:cursor-grabbing ${
          dragging ? 'border-primary opacity-60 ring-2 ring-primary' : moved ? 'border-primary/50' : ''
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Page ${pageIndex + 1}`} className="pointer-events-none max-h-[86%] max-w-[86%] object-contain shadow-sm" />
        ) : (
          <span className="flex size-full items-center justify-center">
            {failed ? <FileText className="size-5 text-muted-foreground/50" /> : <Loader2 className="size-5 animate-spin text-muted-foreground/50" />}
          </span>
        )}
        {/* new position badge */}
        <span className={`absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-semibold ${moved ? 'bg-primary text-primary-foreground' : 'bg-black/55 text-white'}`}>
          {slot + 1}
        </span>
        {/* move buttons (touch / accessibility) */}
        <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={() => onMove(slot, -1)} disabled={slot === 0} aria-label="Move earlier" className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-background disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
          <button onClick={() => onMove(slot, 1)} disabled={slot === total - 1} aria-label="Move later" className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-background disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
        </div>
      </div>
      <p className={`mt-1 text-center text-xs ${moved ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
        {moved ? `Page ${pageIndex + 1} → ${slot + 1}` : `Page ${pageIndex + 1}`}
      </p>
    </div>
  );
}

export function ReorderTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const jobs = useCancelableJob();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { setHandle((prev) => { if (prev) void prev.destroy(); return null; }); }, []);

  useFileHandoff(loadOne);
  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setError(null);
    setTooBig(null);
    setDone(null);
    setOrder([]);
    setHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setFile(f);
    setParsing(true);
    try {
      const h = await openPdf(f);
      setHandle(h);
      setOrder(Array.from({ length: h.numPages }, (_, i) => i));
      prefetchPageThumbs(h, 170);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      setParsing(false);
    }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

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
    setOrder([]);
    setFile(null);
    setTooBig(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setParsing(false);
  }

  function moveSlot(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setDone(null);
    setOrder((cur) => {
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
    moveSlot(from, slot);
    dragFrom.current = slot;
    setDraggingSlot(slot);
  };
  const onDragEnd = () => { dragFrom.current = null; setDraggingSlot(null); };

  const changed = order.some((p, i) => p !== i);

  async function apply() {
    if (!file || !changed) return;
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      // Runs in a Web Worker — the page never freezes, even on huge files.
      const out = await rewritePdf(file, { type: 'reorder', order }, { signal });
      if (!jobs.isCurrent(id)) return;
      const name = `${file.name.replace(/\.pdf$/i, '')}-reordered.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return;
      setError(e instanceof Error ? e.message : 'Could not reorder the PDF.');
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
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
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
            <p className="text-xs text-muted-foreground">Drag pages into a new order — nothing re-rendered, quality untouched</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)} · {order.length || '…'} page{order.length === 1 ? '' : 's'}</p>
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
                  <Button size="sm" variant="outline" onClick={() => { setDone(null); setOrder((cur) => cur.slice().reverse()); }}>
                    <ArrowLeftRight className="size-4" /> Reverse order
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDone(null); setOrder(Array.from({ length: order.length }, (_, i) => i)); }} disabled={!changed}>
                    <RefreshCw className="size-4" /> Reset
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {changed ? 'New order set — download when ready' : 'Drag pages, or use the arrows'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {order.map((pageIndex, slot) => (
                    <ReorderTile
                      key={pageIndex}
                      handle={handle}
                      pageIndex={pageIndex}
                      slot={slot}
                      total={order.length}
                      dragging={draggingSlot === slot}
                      onDragStart={onDragStart}
                      onDragEnter={onDragEnter}
                      onDragEnd={onDragEnd}
                      onMove={(s, dir) => moveSlot(s, s + dir)}
                    />
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
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Reordering…</Button>
              <Button size="lg" variant="outline" onClick={cancelApply}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={!changed}>
              <Download className="size-4" /> {changed ? 'Save new order & download' : 'Reorder & download'}
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/reorder-pdf" fromLabel="Reorder pages" />}
      </CardContent>
    </Card>
  );
}
