'use client';
import { useFileSession } from '@/lib/editor-session';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { useFileHandoff } from '@/lib/file-handoff';
import { Upload, FileText, X, Download, Loader2, Zap, FileOutput, Layers, Copy, SplitSquareHorizontal, Gauge, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Premium mode selector card — icon chip + title + hint, with a clear active state.
function ModeCard({ active, onClick, icon: Icon, title, desc }: { active: boolean; onClick: () => void; icon: LucideIcon; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${active ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary' : 'border-border hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm'}`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { parseRanges } from '@/lib/page-ranges';
import { rewritePdf, splitPdf } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

type Mode = 'extract' | 'ranges' | 'each' | 'every' | 'size';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls =
  'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';

// parseRanges moved to lib/page-ranges (the rewrite worker needs it too);
// re-exported here for the existing importers (pdf-to-jpg, page numbers, …).
export { parseRanges };


export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<Mode>('extract');
  const [every, setEvery] = useState(2); // "fixed ranges": pages per output file
  const [ranges, setRanges] = useState('');
  const [maxSizeMb, setMaxSizeMb] = useState(5); // "by max size": target ceiling per output file
  const [busy, setBusy] = useState(false);
  const jobs = useCancelableJob();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useFileHandoff(loadOne);
  // Survive a background-tab discard: silently reload the last file.
  useFileSession('split', file, loadOne);
  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const count = doc.getPageCount();
      setFile(f);
      setPageCount(count);
      setRanges(`1-${count}`);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
    } finally {
      setBusy(false);
    }
  }

  function pick(files: FileList | null) {
    void loadOne(files?.[0]);
  }

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
    setFile(null);
    setPageCount(0);
    setRanges('');
    setError(null);
    setDone(null);
    setHandoffNote(null);
  }

  async function run() {
    if (!file) {
      setError('Add a PDF first.');
      return;
    }
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      // pdf-lib runs in the rewrite WORKER — the page stays responsive even on
      // very large files (main-thread applies used to freeze the tab).
      const base = file.name.replace(/\.pdf$/i, '');

      if (mode === 'extract') {
        const pages = parseRanges(ranges, pageCount); // 1-based, may throw
        const bytes = await rewritePdf(file, { type: 'extract', indices: pages.map((n) => n - 1) }, { signal });
        if (!jobs.isCurrent(id)) return;
        const name = `${base}-extracted.pdf`;
        const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
        download(blob, name);
        setDone({ blob, name, secs: (performance.now() - t0) / 1000 }); // single PDF → chainable via Keep moving
      } else {
        // Multi-output modes → a ZIP of PDFs.
        let op: Parameters<typeof splitPdf>[1];
        let label: string;
        if (mode === 'each') { op = { type: 'split-each' }; label = 'page'; }
        else if (mode === 'every') { op = { type: 'split-chunks', every }; label = 'part'; }
        else if (mode === 'size') { op = { type: 'split-size', maxBytes: Math.max(0.1, maxSizeMb) * 1024 * 1024 }; label = 'part'; }
        else { // 'ranges' — one file PER comma-separated range
          const groups = ranges.split(',').map((s) => s.trim()).filter(Boolean).map((seg) => parseRanges(seg, pageCount).map((n) => n - 1));
          if (!groups.length) throw new Error('Enter at least one range, e.g. 1-3, 5-8');
          op = { type: 'split-groups', groups }; label = 'range';
        }
        const parts = await splitPdf(file, op, { signal });
        if (!jobs.isCurrent(id)) return;
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const pad = String(parts.length).length;
        parts.forEach((bytes, i) => { zip.file(`${base}-${label}-${String(i + 1).padStart(pad, '0')}.pdf`, bytes); });
        const blob = await zip.generateAsync({ type: 'blob' });
        if (!jobs.isCurrent(id)) return;
        download(blob, `${base}-${mode === 'each' ? 'pages' : mode === 'ranges' ? 'ranges' : 'parts'}.zip`);
      }
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return;
      setError(e instanceof Error ? e.message : 'Could not split the PDF.');
    } finally {
      if (jobs.isCurrent(id)) setBusy(false);
    }
  }
  function cancelRun() {
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
            <p className="text-xs text-muted-foreground">Extract pages, or split into separate files</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {file && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <ModeCard active={mode === 'extract'} onClick={() => setMode('extract')} icon={FileOutput} title="Extract pages" desc="Pick pages into one new PDF" />
              <ModeCard active={mode === 'every'} onClick={() => setMode('every')} icon={Layers} title="Every N pages" desc="Fixed ranges — one PDF per chunk" />
              <ModeCard active={mode === 'each'} onClick={() => setMode('each')} icon={Copy} title="Each page as a file" desc={`Split into ${pageCount} PDFs (ZIP)`} />
              <ModeCard active={mode === 'ranges'} onClick={() => setMode('ranges')} icon={SplitSquareHorizontal} title="Per-range files" desc="Each range → its own PDF (ZIP)" />
              <ModeCard active={mode === 'size'} onClick={() => setMode('size')} icon={Gauge} title="By max file size" desc="Chunks each under a size cap (ZIP)" />
            </div>

            {mode === 'extract' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Pages to extract</label>
                <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" inputMode="numeric" />
                <p className="mt-1 text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. Use commas and ranges, e.g. 1-3, 5.</p>
              </div>
            )}

            {mode === 'every' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Pages per file</label>
                <input
                  className={inputCls} type="number" min={1} max={Math.max(1, pageCount)} value={every}
                  onChange={(e) => setEvery(Math.min(Math.max(1, parseInt(e.target.value || '1', 10)), Math.max(1, pageCount)))}
                  inputMode="numeric"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Splits into {Math.ceil(pageCount / Math.max(1, every))} file{Math.ceil(pageCount / Math.max(1, every)) === 1 ? '' : 's'} of {every} page{every === 1 ? '' : 's'} each (last one may be shorter), bundled as a ZIP.
                </p>
              </div>
            )}

            {mode === 'ranges' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Ranges — one file each</label>
                <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 4-8, 9-12" inputMode="numeric" />
                <p className="mt-1 text-xs text-muted-foreground">This PDF has {pageCount} pages. Each comma-separated range becomes its own PDF — e.g. <span className="font-medium">1-3, 4-8</span> → two files.</p>
              </div>
            )}

            {mode === 'size' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Max size per file (MB)</label>
                <input
                  className={inputCls} type="number" min={0.1} step={0.1} value={maxSizeMb}
                  onChange={(e) => setMaxSizeMb(Math.max(0.1, parseFloat(e.target.value || '1')))}
                  inputMode="decimal"
                />
                <p className="mt-1 text-xs text-muted-foreground">Fills each PDF with as many pages as fit under {maxSizeMb} MB, then starts a new one. A single page bigger than the cap gets its own file. Bundled as a ZIP.</p>
              </div>
            )}
          </div>
        )}

        {error && <UploadError error={error} />}

        {file && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Working…</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}>
              <Download className="size-4" /> {mode === 'extract' ? 'Extract pages' : mode === 'every' ? `Split into ${Math.ceil(pageCount / Math.max(1, every))} files` : mode === 'each' ? `Split into ${pageCount} files` : mode === 'size' ? `Split under ${maxSizeMb} MB each` : 'Split by range'}
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/split-pdf" fromLabel="Split PDF" />}
      </CardContent>
    </Card>
  );
}
