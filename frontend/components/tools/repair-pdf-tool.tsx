'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Loader2, Download, Wrench, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { useFileHandoff } from '@/lib/file-handoff';
import { useFileSession } from '@/lib/editor-session';
import { repairPdf, RepairError, type RepairResult } from '@/lib/pdf-repair';

const fmt = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function RepairPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setFile(f); setStatus('working'); setError(null); setResult(null);
    try {
      const r = await repairPdf(f);
      setResult(r); setStatus('done');
    } catch (e) {
      setStatus('failed');
      setError(e instanceof RepairError
        ? (e.recoverablePages > 0
            ? `This PDF is badly damaged — even the tolerant repair couldn’t rebuild it. Your reader may still show about ${e.recoverablePages} page${e.recoverablePages === 1 ? '' : 's'}; try “Print to PDF” from there to salvage them.`
            : 'This file is too damaged to rebuild — it may not be a PDF, or the content itself is corrupted (not just the index).')
        : 'Could not repair that file — please try again.');
    }
  }, []);

  useFileHandoff(run);
  useFileSession('repair', file, run);

  const reset = () => { setFile(null); setStatus('idle'); setResult(null); setError(null); };

  if (status === 'idle') {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void run(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop a damaged PDF to repair it</span>
          <span className="mt-1 text-sm text-muted-foreground">won’t open, blank, or “file is corrupt”? — fixed on your device, never uploaded</span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void run(e.target.files?.[0]); e.target.value = ''; }} />
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3 border-b pb-4">
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file?.name}>{file?.name}</span>
          <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {status === 'working' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm font-medium">Rebuilding the document…</p>
            <p className="text-xs text-muted-foreground">Reconstructing the page index and dropping corrupted junk — all on your device.</p>
          </div>
        )}

        {status === 'done' && result && (
          <div className="py-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-7" /></span>
              <p className="text-lg font-bold">Repaired</p>
              <p className="text-sm text-muted-foreground">{result.pages} page{result.pages === 1 ? '' : 's'} · {fmt(result.beforeBytes)} → {fmt(result.afterBytes)}</p>
            </div>
            <ul className="mx-auto mt-5 max-w-md space-y-1.5">
              {result.notes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Wrench className="mt-0.5 size-3.5 shrink-0 text-primary" /> {n}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => downloadBlob(result.blob, result.name)} className="bg-primary text-primary-foreground"><Download className="mr-1.5 size-4" /> Download repaired PDF</Button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">Open it to confirm it reads correctly. If pages are still missing, the original content — not just the index — was damaged.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-7" /></span>
            <p className="text-base font-bold">Couldn’t rebuild this one</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={reset} className="mt-2">Try another PDF</Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <Wrench className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Repaired on your device.</b> A damaged PDF is exactly the file you shouldn’t hand to a random website — so we don’t. The rebuild happens entirely in your browser; the file is never uploaded.</p>
      </div>
      {status === 'done' && <KeepGoing exclude="/repair-pdf" title="Do more, privately" />}
    </div>
  );
}
