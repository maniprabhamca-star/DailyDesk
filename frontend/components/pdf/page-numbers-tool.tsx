'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseRanges } from '@/lib/page-ranges';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { useCancelableJob, isCancel } from '@/lib/use-cancelable-job';

type Pos = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
type Fmt = 'n' | 'n_slash_N' | 'page_n' | 'page_n_of_N' | 'custom';
type Size = 'small' | 'medium' | 'large';
type Margin = 'small' | 'medium' | 'large';
type Tone = 'gray' | 'red' | 'blue' | 'black';

const SIZE: Record<Size, number> = { small: 9, medium: 11, large: 14 };
const MARGINS: Record<Margin, number> = { small: 18, medium: 28, large: 44 };
const TONES: Record<Tone, { rgb: [number, number, number]; label: string; chip: string }> = {
  gray: { rgb: [0.32, 0.32, 0.32], label: 'Gray', chip: '#6b7280' },
  red: { rgb: [0.86, 0.15, 0.15], label: 'Red', chip: '#dc2626' },
  blue: { rgb: [0.15, 0.39, 0.92], label: 'Blue', chip: '#2563eb' },
  black: { rgb: [0.1, 0.1, 0.1], label: 'Black', chip: '#111827' },
};

// The label template the rewrite core fills in: {n} = assigned number,
// {p} = the last assigned number (so "of {p}" can never read "5 of 3").
const TEMPLATES: Record<Exclude<Fmt, 'custom'>, string> = {
  n: '{n}',
  n_slash_N: '{n} / {p}',
  page_n: 'Page {n}',
  page_n_of_N: 'Page {n} of {p}',
};

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls = 'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';
const selectCls = 'h-9 w-full rounded-lg border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary';

export function PageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pos, setPos] = useState<Pos>('bc');
  const [format, setFormat] = useState<Fmt>('n');
  const [custom, setCustom] = useState('Page {n} of {p}');
  const [size, setSize] = useState<Size>('medium');
  const [margin, setMargin] = useState<Margin>('medium');
  const [tone, setTone] = useState<Tone>('gray');
  const [start, setStart] = useState(1);
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState(false);
  const jobs = useCancelableJob();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
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
    const { id, signal } = jobs.begin();
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      // pdf-lib runs in the rewrite WORKER — numbering very large files no
      // longer freezes the tab. The stamp itself happens in pdf-rewrite-core.
      const target = parseRanges(ranges, pageCount); // 1-based, may throw
      const template = format === 'custom' ? (custom.trim() || '{n}') : TEMPLATES[format];
      const out = await rewritePdf(file, {
        type: 'page-numbers',
        opts: { pageNums: target, start, template, fontSize: SIZE[size], margin: MARGINS[margin], colorRgb: TONES[tone].rgb, pos },
      }, { signal });
      if (!jobs.isCurrent(id)) return;
      const name = `${file.name.replace(/\.pdf$/i, '')}-numbered.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      if (isCancel(e) || !jobs.isCurrent(id)) return;
      setError(e instanceof Error ? e.message : 'Could not add page numbers.');
    } finally {
      if (jobs.isCurrent(id)) setBusy(false);
    }
  }
  function cancelRun() {
    jobs.cancel();
    setBusy(false);
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
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
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
                  <option value="custom">Custom text…</option>
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
              {format === 'custom' && (
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1.5 block font-medium">Custom text</span>
                  <input className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={60} placeholder="e.g. Sheet {n} / {p} — Annual report" />
                  <span className="mt-1 block text-xs text-muted-foreground">{'{n}'} = page number · {'{p}'} = last number</span>
                </label>
              )}
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Start at number</span>
                <input className={inputCls} type="number" min={0} value={start} onChange={(e) => setStart(Math.max(0, parseInt(e.target.value || '1', 10)))} inputMode="numeric" />
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Pages to number</span>
                <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-10" inputMode="numeric" />
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Distance from edge</span>
                <select className={selectCls} value={margin} onChange={(e) => setMargin(e.target.value as Margin)}>
                  <option value="small">Close</option>
                  <option value="medium">Standard</option>
                  <option value="large">Wide</option>
                </select>
              </label>
              <div className="text-sm">
                <p className="mb-1.5 font-medium">Color</p>
                <div className="flex h-9 items-center gap-2">
                  {(Object.keys(TONES) as Tone[]).map((t) => (
                    <button
                      key={t} onClick={() => setTone(t)} aria-label={TONES[t].label} aria-pressed={tone === t}
                      className={`size-7 rounded-full border-2 transition-all ${tone === t ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: TONES[t].chip }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. Leave the range as is to number every page — or start it at 2 to skip a cover page.</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Adding numbers…</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}>
              <Download className="size-4" /> Add page numbers &amp; download
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/add-page-numbers-to-pdf" fromLabel="Page Numbers" />}
      </CardContent>
    </Card>
  );
}
