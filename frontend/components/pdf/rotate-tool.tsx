'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, RotateCw, RotateCcw, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';

// One page thumbnail + its pending rotation (delta added on top of the page's
// existing rotation). Rotation is applied LOSSLESSLY with pdf-lib (it just sets
// the page's rotation flag — no re-rendering), so output quality is untouched.
// `url` is null until the thumbnail has been rendered (previews render lazily as
// each page scrolls into view — so a 500-page / scanned PDF shows instantly
// instead of grinding through every page up front).
type Thumb = { page: number; url: string | null; delta: number; selected: boolean };

const THUMB_PX = 240; // long-edge px for the preview render — small + lean
const RENDER_CONCURRENCY = 2; // render a couple of visible pages at a time

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const norm = (d: number) => ((d % 360) + 360) % 360;

export function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [parsing, setParsing] = useState(false); // parsing the PDF (before the grid appears)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live pdf.js document kept alive for lazy thumbnail rendering.
  const docRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const taskRef = useRef<import('pdfjs-dist').PDFDocumentLoadingTask | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const urlsRef = useRef<Set<string>>(new Set()); // every object URL we create, for reliable cleanup
  const claimedRef = useRef<Set<number>>(new Set()); // pages queued/rendered — never render twice
  const queueRef = useRef<number[]>([]);
  const activeRef = useRef(0);

  const teardown = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    queueRef.current = [];
    activeRef.current = 0;
    claimedRef.current.clear();
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current.clear();
    const doc = docRef.current;
    const task = taskRef.current;
    docRef.current = null;
    taskRef.current = null;
    if (doc) { try { void doc.destroy(); } catch { /* ignore */ } }
    if (task) { try { void task.destroy(); } catch { /* ignore */ } }
  }, []);

  // Revoke everything + destroy the pdf.js doc when the component unmounts.
  useEffect(() => () => teardown(), [teardown]);

  // Render a single page's thumbnail on demand and drop it into `thumbs`.
  const renderThumb = useCallback(async (pageNum: number) => {
    const doc = docRef.current;
    if (!doc) return;
    try {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const scale = THUMB_PX / Math.max(base.width, base.height);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
      const url = await new Promise<string | null>((res) =>
        canvas.toBlob((b) => res(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.72),
      );
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      if (!docRef.current) { if (url) URL.revokeObjectURL(url); return; } // torn down mid-render
      if (url) {
        urlsRef.current.add(url);
        setThumbs((cur) => cur.map((t) => (t.page === pageNum ? { ...t, url } : t)));
      }
    } catch {
      claimedRef.current.delete(pageNum); // allow a retry if it scrolls back into view
    }
  }, []);

  // Serial-ish pump: keep RENDER_CONCURRENCY renders in flight.
  const pump = useCallback(() => {
    while (activeRef.current < RENDER_CONCURRENCY && queueRef.current.length > 0) {
      const page = queueRef.current.shift()!;
      activeRef.current++;
      void renderThumb(page).finally(() => {
        activeRef.current--;
        pump();
      });
    }
  }, [renderThumb]);

  const enqueue = useCallback((page: number) => {
    if (claimedRef.current.has(page)) return;
    claimedRef.current.add(page);
    queueRef.current.push(page);
    pump();
  }, [pump]);

  // Tile ref callback — register each page tile with the IntersectionObserver so
  // its thumbnail renders the moment it (nearly) enters the viewport.
  const observeTile = useCallback((el: HTMLDivElement | null, page: number) => {
    const obs = observerRef.current;
    if (!el || !obs) return;
    el.dataset.page = String(page);
    obs.observe(el);
  }, []);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setDone(null);
    teardown();
    setThumbs([]);
    setFile(f);
    setParsing(true);
    try {
      const pdfjs = await import('pdfjs-dist'); // render previews only
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const task = pdfjs.getDocument({ data: await f.arrayBuffer() });
      taskRef.current = task;
      const doc = await task.promise;
      docRef.current = doc;
      const total = doc.numPages;

      // Set up the lazy-render observer BEFORE the tiles mount so their ref
      // callbacks can register immediately. 600px margin pre-renders just ahead
      // of the scroll so previews feel instant.
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const page = Number((e.target as HTMLElement).dataset.page);
            if (page) enqueue(page);
            observerRef.current?.unobserve(e.target); // render each tile once
          }
        },
        { root: null, rootMargin: '600px 0px' },
      );

      // Show the whole grid instantly with placeholders; thumbnails stream in.
      setThumbs(Array.from({ length: total }, (_, i) => ({ page: i + 1, url: null, delta: 0, selected: false })));
    } catch {
      teardown();
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
    teardown();
    setThumbs([]);
    setFile(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setParsing(false);
  }

  function rotatePage(i: number, dir: 1 | -1) {
    setDone(null);
    setThumbs((cur) => cur.map((t, idx) => (idx === i ? { ...t, delta: norm(t.delta + dir * 90) } : t)));
  }

  function bulkRotate(dir: 1 | -1) {
    setDone(null);
    const anySelected = thumbs.some((t) => t.selected);
    setThumbs((cur) => cur.map((t) => (!anySelected || t.selected ? { ...t, delta: norm(t.delta + dir * 90) } : t)));
  }

  const allSelected = thumbs.length > 0 && thumbs.every((t) => t.selected);
  function toggleAll() {
    const next = !allSelected;
    setThumbs((cur) => cur.map((t) => ({ ...t, selected: next })));
  }
  function toggleOne(i: number) {
    setThumbs((cur) => cur.map((t, idx) => (idx === i ? { ...t, selected: !t.selected } : t)));
  }
  function reset() {
    setDone(null);
    setThumbs((cur) => cur.map((t) => ({ ...t, delta: 0, selected: false })));
  }

  const changes = thumbs.filter((t) => t.delta !== 0).length;

  async function apply() {
    if (!file || changes === 0) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const pages = src.getPages();
      thumbs.forEach((t, i) => {
        if (t.delta === 0 || !pages[i]) return;
        const cur = pages[i].getRotation().angle || 0;
        pages[i].setRotation(degrees(norm(cur + t.delta)));
      });
      const out = await src.save();
      const name = `${file.name.replace(/\.pdf$/i, '')}-rotated.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rotate the PDF.');
    } finally {
      setBusy(false);
    }
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
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files)} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)} · {thumbs.length || 0} page{thumbs.length === 1 ? '' : 's'}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
            </div>

            {parsing ? (
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

                {/* page grid */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {thumbs.map((t, i) => (
                    <div key={t.page} className="group">
                      <div
                        ref={(el) => observeTile(el, t.page)}
                        className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted/30 transition-colors ${t.selected ? 'border-primary ring-1 ring-primary' : ''}`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select page ${t.page}`}
                          className="absolute left-2 top-2 z-10 size-4 accent-[hsl(var(--primary))]"
                          checked={t.selected}
                          onChange={() => toggleOne(i)}
                        />
                        {t.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.url}
                            alt={`Page ${t.page}`}
                            loading="lazy"
                            className="max-h-[86%] max-w-[86%] object-contain shadow-sm transition-transform duration-200"
                            style={{ transform: `rotate(${t.delta}deg)` }}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <Loader2 className="size-5 animate-spin text-muted-foreground/50" />
                          </div>
                        )}
                        {/* per-page rotate controls (always visible on touch, hover on desktop) */}
                        <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <button onClick={() => rotatePage(i, -1)} aria-label={`Rotate page ${t.page} left`} className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-background"><RotateCcw className="size-3.5" /></button>
                          <button onClick={() => rotatePage(i, 1)} aria-label={`Rotate page ${t.page} right`} className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90"><RotateCw className="size-3.5" /></button>
                        </div>
                      </div>
                      <p className="mt-1 text-center text-xs text-muted-foreground">Page {t.page}{t.delta ? ` · ${t.delta}°` : ''}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !parsing && (
          <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={busy || changes === 0}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Rotating…</> : <><Download className="size-4" /> {changes > 0 ? `Rotate ${changes} page${changes === 1 ? '' : 's'} & download` : 'Rotate & download'}</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/rotate-pdf" fromLabel="Rotate PDF" />}
      </CardContent>
    </Card>
  );
}
