'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { PdfDone } from '@/components/app/pdf-done';

type Mode = 'extract' | 'each';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls =
  'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';

// Parse "1-3, 5, 8-10" into ordered 1-based page numbers; throws a clear error on invalid input.
export function parseRanges(input: string, total: number): number[] {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('Enter at least one page or range.');
  const out: number[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1];
      let b = +m[2];
      if (a < 1 || b < 1 || a > total || b > total) throw new Error(`Pages must be between 1 and ${total}.`);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) out.push(i);
    } else if (/^\d+$/.test(p)) {
      const n = +p;
      if (n < 1 || n > total) throw new Error(`Page ${n} is out of range (1–${total}).`);
      out.push(n);
    } else {
      throw new Error(`“${p}” isn’t a valid page or range.`);
    }
  }
  return out;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<Mode>('extract');
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
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
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const srcBytes = await file.arrayBuffer();
      const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const base = file.name.replace(/\.pdf$/i, '');

      if (mode === 'extract') {
        const pages = parseRanges(ranges, total); // 1-based, may throw
        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, pages.map((n) => n - 1));
        copied.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        const name = `${base}-extracted.pdf`;
        const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
        download(blob, name);
        setDone({ blob, name }); // single PDF → chainable via Keep moving
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const pad = String(total).length;
        for (let i = 0; i < total; i++) {
          const out = await PDFDocument.create();
          const [pg] = await out.copyPages(src, [i]);
          out.addPage(pg);
          const bytes = await out.save();
          zip.file(`${base}-page-${String(i + 1).padStart(pad, '0')}.pdf`, bytes);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        download(blob, `${base}-pages.zip`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not split the PDF.');
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
            <p className="text-xs text-muted-foreground">Extract pages, or split into separate files</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files)} />
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
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => setMode('extract')}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${mode === 'extract' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent/40'}`}
              >
                <p className="font-semibold">Extract pages</p>
                <p className="text-xs text-muted-foreground">Pick pages into one new PDF</p>
              </button>
              <button
                onClick={() => setMode('each')}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${mode === 'each' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent/40'}`}
              >
                <p className="font-semibold">Each page as a file</p>
                <p className="text-xs text-muted-foreground">Split into {pageCount} PDFs (ZIP)</p>
              </button>
            </div>

            {mode === 'extract' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Pages to extract</label>
                <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" inputMode="numeric" />
                <p className="mt-1 text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. Use commas and ranges, e.g. 1-3, 5.</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Working…</> : <><Download className="size-4" /> {mode === 'extract' ? 'Extract pages' : `Split into ${pageCount} files`}</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/split-pdf" fromLabel="Split PDF" />}
      </CardContent>
    </Card>
  );
}
