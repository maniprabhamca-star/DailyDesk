'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Trash2, Zap, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { PdfDone } from '@/components/app/pdf-done';

// One page thumbnail + whether it's marked for removal. Deletion is lossless
// (pdf-lib removePage — the kept pages are untouched), so quality is preserved.
type Thumb = { page: number; url: string; marked: boolean };

const THUMB_PX = 240; // long-edge px for the preview render — small + lean

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DeletePagesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function revoke(ts: Thumb[]) { ts.forEach((t) => URL.revokeObjectURL(t.url)); }
  useEffect(() => () => revoke(thumbs), [thumbs]);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setDone(null);
    setThumbs((prev) => { revoke(prev); return []; });
    setFile(f);
    setLoading({ done: 0, total: 0 });
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const task = pdfjs.getDocument({ data: await f.arrayBuffer() });
      const doc = await task.promise;
      try {
        const total = doc.numPages;
        setLoading({ done: 0, total });
        const out: Thumb[] = [];
        for (let i = 1; i <= total; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = THUMB_PX / Math.max(base.width, base.height);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(vp.width);
          canvas.height = Math.ceil(vp.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('no-canvas');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
          const url = await new Promise<string>((res, rej) =>
            canvas.toBlob((b) => (b ? res(URL.createObjectURL(b)) : rej(new Error('thumb'))), 'image/jpeg', 0.72),
          );
          canvas.width = 0;
          canvas.height = 0;
          out.push({ page: i, url, marked: false });
          setLoading({ done: i, total });
          await new Promise((r) => setTimeout(r, 0));
        }
        setThumbs(out);
      } finally {
        try { await task.destroy(); } catch { /* ignore */ }
      }
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      setLoading(null);
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
    setThumbs((prev) => { revoke(prev); return []; });
    setFile(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setLoading(null);
  }

  function toggleMark(i: number) {
    setDone(null);
    setThumbs((cur) => cur.map((t, idx) => (idx === i ? { ...t, marked: !t.marked } : t)));
  }
  const marked = thumbs.filter((t) => t.marked).length;
  const remaining = thumbs.length - marked;
  const allMarked = thumbs.length > 0 && marked === thumbs.length;

  function toggleAll() {
    const next = !allMarked;
    setDone(null);
    setThumbs((cur) => cur.map((t) => ({ ...t, marked: next })));
  }
  function clearMarks() {
    setDone(null);
    setThumbs((cur) => cur.map((t) => ({ ...t, marked: false })));
  }

  async function apply() {
    if (!file || marked === 0 || remaining < 1) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      // Remove from the end so earlier indices stay valid.
      const toRemove = thumbs.map((t, i) => (t.marked ? i : -1)).filter((i) => i >= 0).sort((a, b) => b - a);
      toRemove.forEach((i) => src.removePage(i));
      const out = await src.save();
      const name = `${file.name.replace(/\.pdf$/i, '')}-pages-removed.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the pages.');
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
            <p className="text-xs text-muted-foreground">See every page and tap the ones to remove</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files)} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)} · {thumbs.length || loading?.total || 0} page{(thumbs.length || loading?.total) === 1 ? '' : 's'}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
            </div>

            {loading ? (
              <div className="mt-6 flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <p className="text-sm">Rendering page previews… {loading.total ? `${loading.done}/${loading.total}` : ''}</p>
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
                  <span className="ml-auto text-xs text-muted-foreground">
                    {marked > 0 ? <><span className="font-semibold text-destructive">{marked} to remove</span> · {remaining} will remain</> : 'Tap pages to remove them'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {thumbs.map((t, i) => (
                    <div key={t.page} className="group">
                      <button
                        type="button"
                        onClick={() => toggleMark(i)}
                        aria-pressed={t.marked}
                        aria-label={`${t.marked ? 'Keep' : 'Remove'} page ${t.page}`}
                        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/30 transition-all ${
                          t.marked ? 'border-destructive ring-1 ring-destructive' : 'hover:border-destructive/40'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.url}
                          alt={`Page ${t.page}`}
                          loading="lazy"
                          className={`max-h-[86%] max-w-[86%] object-contain shadow-sm transition-opacity ${t.marked ? 'opacity-30' : ''}`}
                        />
                        {t.marked && (
                          <span className="absolute inset-0 flex items-center justify-center bg-destructive/5">
                            <span className="flex size-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"><Trash2 className="size-[18px]" /></span>
                          </span>
                        )}
                        <span className={`absolute left-2 top-2 flex size-4 items-center justify-center rounded border ${t.marked ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border bg-background/80'}`}>
                          {t.marked && <Trash2 className="size-2.5" />}
                        </span>
                      </button>
                      <p className={`mt-1 text-center text-xs ${t.marked ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                        {t.marked ? 'Will be removed' : `Page ${t.page}`}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {file && !loading && allMarked && (
          <p className="mt-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">You can’t remove every page — keep at least one.</p>
        )}

        {file && !loading && (
          <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={busy || marked === 0 || remaining < 1}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Removing…</> : <><Download className="size-4" /> {marked > 0 ? `Remove ${marked} page${marked === 1 ? '' : 's'} & download` : 'Remove pages & download'}</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/delete-pages-from-pdf" fromLabel="Delete Pages" />}
      </CardContent>
    </Card>
  );
}
