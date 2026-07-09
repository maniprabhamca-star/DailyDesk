'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, ArrowUp, ArrowDown, Download, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { mergePdfs } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

type Item = { id: string; file: File };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MergeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const jobs = useCancelableJob();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addPdfFiles(pdfs: File[]) {
    if (pdfs.length === 0) return;
    setDone(null);
    setItems((cur) => [...cur, ...pdfs.map((f) => ({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, file: f }))]);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setError('Please choose PDF files.');
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

  async function merge() {
    if (items.length < 2) {
      setError('Add at least two PDFs to merge.');
      return;
    }
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      // pdf-lib runs in the rewrite WORKER — merging very large files no longer
      // freezes the tab (buffers are transferred, zero-copy).
      const merged = await mergePdfs(items.map((it) => it.file), { signal });
      if (!jobs.isCurrent(id)) return;
      const name = 'merged.pdf';
      const blob = new Blob([new Uint8Array(merged)], { type: 'application/pdf' });
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
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        {items.length > 0 && (
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

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {busy ? (
          <div className="mt-5 flex gap-2">
            <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Merging…</Button>
            <Button size="lg" variant="outline" onClick={cancelMerge}><X className="size-4" /> Cancel</Button>
          </div>
        ) : (
          <Button className="mt-5 w-full" size="lg" onClick={merge} disabled={items.length < 2}>
            <Download className="size-4" /> Merge {items.length > 0 ? `${items.length} ` : ''}PDFs
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/merge-pdf" fromLabel="Merge PDF" />}
      </CardContent>
    </Card>
  );
}
