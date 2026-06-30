'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, RotateCw, RotateCcw, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseRanges } from '@/components/pdf/split-tool';
import { takeHandoff } from '@/lib/handoff';
import { PdfDone } from '@/components/app/pdf-done';

type Dir = 'cw' | 'flip' | 'ccw';
const DELTA: Record<Dir, number> = { cw: 90, flip: 180, ccw: 270 };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls =
  'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';

export function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [dir, setDir] = useState<Dir>('cw');
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
      const { PDFDocument, degrees } = await import('pdf-lib');
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const total = src.getPageCount();
      const targets = new Set(parseRanges(ranges, total)); // 1-based, may throw
      const delta = DELTA[dir];
      const pages = src.getPages();
      pages.forEach((page, i) => {
        if (!targets.has(i + 1)) return;
        const current = page.getRotation().angle || 0;
        page.setRotation(degrees(((current + delta) % 360 + 360) % 360));
      });
      const out = await src.save();
      const base = file.name.replace(/\.pdf$/i, '');
      const name = `${base}-rotated.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rotate the PDF.');
    } finally {
      setBusy(false);
    }
  }

  const dirs: { id: Dir; label: string; icon: typeof RotateCw }[] = [
    { id: 'ccw', label: '90° left', icon: RotateCcw },
    { id: 'cw', label: '90° right', icon: RotateCw },
    { id: 'flip', label: '180°', icon: RefreshCw },
  ];

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
            <p className="text-xs text-muted-foreground">Rotate all pages, or just the ones you pick</p>
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
            <div>
              <p className="mb-1.5 text-sm font-medium">Rotation</p>
              <div className="grid grid-cols-3 gap-2">
                {dirs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDir(d.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${dir === d.id ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' : 'text-foreground hover:bg-accent/40'}`}
                  >
                    <d.icon className="size-5" strokeWidth={2.25} /> {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Pages to rotate</label>
              <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" inputMode="numeric" />
              <p className="mt-1 text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. Leave as is to rotate every page.</p>
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Rotating…</> : <><Download className="size-4" /> Rotate &amp; download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/rotate-pdf" fromLabel="Rotate PDF" />}
      </CardContent>
    </Card>
  );
}
