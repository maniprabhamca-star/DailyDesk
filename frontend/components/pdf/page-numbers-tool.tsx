'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseRanges } from '@/components/pdf/split-tool';
import { takeHandoff } from '@/lib/handoff';
import { PdfDone } from '@/components/app/pdf-done';

type Pos = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
type Fmt = 'n' | 'n_slash_N' | 'page_n' | 'page_n_of_N';
type Size = 'small' | 'medium' | 'large';

const SIZE: Record<Size, number> = { small: 9, medium: 11, large: 14 };
const MARGIN = 28; // pt from the page edge

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function label(num: number, total: number, f: Fmt) {
  switch (f) {
    case 'n': return `${num}`;
    case 'n_slash_N': return `${num} / ${total}`;
    case 'page_n': return `Page ${num}`;
    case 'page_n_of_N': return `Page ${num} of ${total}`;
  }
}

const inputCls = 'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';
const selectCls = 'h-9 w-full rounded-lg border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary';

export function PageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pos, setPos] = useState<Pos>('bc');
  const [format, setFormat] = useState<Fmt>('n');
  const [size, setSize] = useState<Size>('medium');
  const [start, setStart] = useState(1);
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
    setFile(null);
    setPageCount(0);
    setRanges('');
    setError(null);
    setDone(null);
    setHandoffNote(null);
  }

  async function run() {
    if (!file) { setError('Add a PDF first.'); return; }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const target = parseRanges(ranges, total); // 1-based, may throw
      const fs = SIZE[size];
      // "of N" denominator = the last number we assign, so it's never e.g. "5 of 3".
      const denom = start + target.length - 1;

      target.forEach((pageNo, i) => {
        const page = pages[pageNo - 1];
        const { width, height } = page.getSize();
        const text = label(start + i, denom, format);
        const tw = font.widthOfTextAtSize(text, fs);
        const left = pos.endsWith('l');
        const center = pos.endsWith('c');
        const x = left ? MARGIN : center ? (width - tw) / 2 : width - MARGIN - tw;
        const y = pos.startsWith('t') ? height - MARGIN - fs : MARGIN;
        page.drawText(text, { x, y, size: fs, font, color: rgb(0.32, 0.32, 0.32) });
      });

      const out = await doc.save();
      const name = `${file.name.replace(/\.pdf$/i, '')}-numbered.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add page numbers.');
    } finally {
      setBusy(false);
    }
  }

  const positions: { id: Pos; row: number; col: number }[] = [
    { id: 'tl', row: 0, col: 0 }, { id: 'tc', row: 0, col: 1 }, { id: 'tr', row: 0, col: 2 },
    { id: 'bl', row: 1, col: 0 }, { id: 'bc', row: 1, col: 1 }, { id: 'br', row: 1, col: 2 },
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
            <p className="text-xs text-muted-foreground">Add page numbers in the corner you pick</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files)} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmtBytes(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {file && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">Position</p>
              <div className="mx-auto grid aspect-[1.6/1] max-w-[220px] grid-cols-3 grid-rows-2 gap-1.5 rounded-lg border bg-muted/30 p-2">
                {positions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPos(p.id)}
                    aria-label={p.id}
                    aria-pressed={pos === p.id}
                    className={`flex items-center justify-center rounded-md border text-[10px] font-bold transition-colors ${
                      pos === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent bg-background/60 text-muted-foreground hover:bg-background'
                    } ${p.row === 0 ? 'items-start pt-1' : 'items-end pb-1'} ${p.col === 0 ? 'justify-start pl-1.5' : p.col === 2 ? 'justify-end pr-1.5' : ''}`}
                  >
                    {pos === p.id ? '1' : '•'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Format</span>
                <select className={selectCls} value={format} onChange={(e) => setFormat(e.target.value as Fmt)}>
                  <option value="n">1</option>
                  <option value="n_slash_N">1 / {pageCount}</option>
                  <option value="page_n">Page 1</option>
                  <option value="page_n_of_N">Page 1 of {pageCount}</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Text size</span>
                <select className={selectCls} value={size} onChange={(e) => setSize(e.target.value as Size)}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Start at number</span>
                <input className={inputCls} type="number" min={0} value={start} onChange={(e) => setStart(Math.max(0, parseInt(e.target.value || '1', 10)))} inputMode="numeric" />
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Pages to number</span>
                <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-10" inputMode="numeric" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. Leave the range as is to number every page.</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Adding numbers…</> : <><Download className="size-4" /> Add page numbers &amp; download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/add-page-numbers-to-pdf" fromLabel="Page Numbers" />}
      </CardContent>
    </Card>
  );
}
