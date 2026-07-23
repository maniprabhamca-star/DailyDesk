'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, FileText, Loader2, X, Hash, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { batesLabel, normalizeOptions, type BatesPosition } from '@/lib/bates-core';
import { stampBatesSet } from '@/lib/pdf-bates';

const fmt = (n: number) => (n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const POSITIONS: { id: BatesPosition; label: string }[] = [
  { id: 'tl', label: 'Top left' }, { id: 'tc', label: 'Top center' }, { id: 'tr', label: 'Top right' },
  { id: 'bl', label: 'Bottom left' }, { id: 'bc', label: 'Bottom center' }, { id: 'br', label: 'Bottom right' },
];

export function BatesNumberingTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [prefix, setPrefix] = useState('BATES-');
  const [suffix, setSuffix] = useState('');
  const [start, setStart] = useState(1);
  const [digits, setDigits] = useState(6);
  const [fontSize, setFontSize] = useState(10);
  const [position, setPosition] = useState<BatesPosition>('br');
  const [useRange, setUseRange] = useState(false);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(9999);
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((list?: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) { setError('Please choose PDF files.'); return; }
    setError(null);
    setFiles((prev) => [...prev, ...pdfs]);
  }, []);

  const firstLabel = useMemo(() => batesLabel(prefix, start, digits, suffix), [prefix, start, digits, suffix]);

  const run = useCallback(async () => {
    if (!files.length) return;
    setStatus('working'); setError(null); setProgress(0);
    try {
      const opts = normalizeOptions({
        prefix, suffix, start, digits, fontSize, position,
        fromPage: useRange ? fromPage : undefined,
        toPage: useRange ? toPage : undefined,
      });
      const result = await stampBatesSet(files, opts, (done, total) => setProgress(done / total));
      if (result.files.length === 1) {
        downloadBlob(result.files[0].blob, result.files[0].name);
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        result.files.forEach((f) => zip.file(f.name, f.blob));
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, 'bates-numbered.zip');
      }
      setStatus('done');
    } catch {
      setStatus('idle');
      setError('Could not stamp one of these PDFs — it may be password-protected or damaged.');
    }
  }, [files, prefix, suffix, start, digits, fontSize, position, useRange, fromPage, toPage]);

  if (!files.length) {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop PDFs to Bates-number them</span>
          <span className="mt-1 text-sm text-muted-foreground">drop several — numbering runs continuously across the whole set, on your device</span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDFs</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Config */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Numbering</h2>
          <div className="space-y-3">
            <Field label="Prefix"><input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm" placeholder="ABC-" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start at"><input type="number" min={0} value={start} onChange={(e) => setStart(Math.max(0, +e.target.value || 0))} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm" /></Field>
              <Field label="Digits"><input type="number" min={1} max={10} value={digits} onChange={(e) => setDigits(Math.max(1, Math.min(10, +e.target.value || 1)))} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Suffix (optional)"><input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm" placeholder="-EX" /></Field>
              <Field label="Text size"><input type="number" min={6} max={24} value={fontSize} onChange={(e) => setFontSize(Math.max(6, Math.min(24, +e.target.value || 10)))} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm" /></Field>
            </div>

            <Field label="Position">
              <div className="grid grid-cols-3 gap-1.5">
                {POSITIONS.map((p) => (
                  <button key={p.id} onClick={() => setPosition(p.id)} title={p.label}
                    className={`rounded-md border px-2 py-2 text-xs font-medium transition ${position === p.id ? 'border-transparent bg-[#1e3a5f] text-white' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <label className="flex items-center gap-2 pt-1 text-sm">
              <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} className="size-4 accent-[#1e3a5f]" />
              <span>Only pages</span>
              {useRange && (
                <span className="flex items-center gap-1.5">
                  <input type="number" min={1} value={fromPage} onChange={(e) => setFromPage(Math.max(1, +e.target.value || 1))} className="w-16 rounded-md border bg-background px-2 py-1 text-sm" />
                  <span className="text-muted-foreground">to</span>
                  <input type="number" min={1} value={toPage} onChange={(e) => setToPage(Math.max(1, +e.target.value || 1))} className="w-16 rounded-md border bg-background px-2 py-1 text-sm" />
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Live preview</h2>
          <div className="relative mx-auto aspect-[8.5/11] w-full max-w-[240px] overflow-hidden rounded-md border bg-white shadow-sm">
            <div className="flex flex-col gap-2 p-5">
              {[70, 96, 92, 98, 88, 94, 60, 90].map((w, i) => (
                <span key={i} className="block h-1.5 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
              ))}
            </div>
            <span
              className="absolute rounded-sm bg-[#c99a2e]/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1e3a5f]"
              style={{
                top: position[0] === 't' ? 8 : undefined,
                bottom: position[0] === 'b' ? 8 : undefined,
                left: position[1] === 'l' ? 10 : position[1] === 'c' ? '50%' : undefined,
                right: position[1] === 'r' ? 10 : undefined,
                transform: position[1] === 'c' ? 'translateX(-50%)' : undefined,
              }}
            >
              {firstLabel}
            </span>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            First stamp <span className="font-mono font-semibold text-foreground">{firstLabel}</span> · continues across all {files.length} file{files.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Files */}
      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{files.length} file{files.length === 1 ? '' : 's'} · stamped in this order</span>
          <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="size-3.5" /> Add more</button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        <ul className="divide-y">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmt(f.size)}</span>
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex items-center justify-end gap-3">
        {status === 'done' && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Downloaded ✓</span>}
        <Button onClick={run} disabled={status === 'working'} className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90">
          {status === 'working'
            ? <><Loader2 className="mr-1.5 size-4 animate-spin" /> Stamping {Math.round(progress * 100)}%</>
            : <><Hash className="mr-1.5 size-4" /> {files.length > 1 ? 'Stamp & download .zip' : 'Stamp & download PDF'}</>}
        </Button>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Stamped on your device.</b> Case files and discovery documents never touch our servers — the numbering is applied entirely in your browser, so nothing is uploaded or seen by anyone but you.</p>
      </div>
      {status === 'done' && <KeepGoing exclude="/bates-numbering" title="Do more, privately" />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
