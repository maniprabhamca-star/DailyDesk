'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, Unlock, Eye, EyeOff, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { runQpdf, QpdfError } from '@/lib/qpdf';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls = 'h-10 w-full rounded-lg border bg-background px-3 pr-10 text-sm outline-none focus:border-primary';

export function UnlockTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null);
    setError(null);
    setDone(null);
    setFile(f);
  }
  function pick(files: FileList | null) { loadOne(files?.[0]); }

  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      loadOne(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      const out = await runQpdf(file, { type: 'decrypt', password: pw });
      const name = `${file.name.replace(/\.pdf$/i, '')}-unlocked.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      // Wrong password keeps the file loaded — the user just retypes and retries.
      if (e instanceof QpdfError && e.wrongPassword && pw === '') setError('This PDF needs its password — type it above.');
      else setError(e instanceof Error ? e.message : 'Could not unlock the PDF.');
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
        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a password-protected PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Enter the password you know — get a copy that opens freely</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); setPw(''); }}><X className="size-4" /></Button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {file && !done && (
          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block font-medium">PDF password</span>
            <span className="relative block sm:max-w-sm">
              <input className={inputCls} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
                autoComplete="off" placeholder="The password this PDF opens with" onKeyDown={(e) => { if (e.key === 'Enter') void run(); }} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
            <span className="mt-1.5 block text-[11px] text-muted-foreground">
              Honest note: this removes a password you already know. It can’t crack or guess a password you don’t have.
            </span>
          </label>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Unlocking…</> : <><Unlock className="size-4" /> Remove password &amp; download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/unlock-pdf" fromLabel="Unlock PDF" />}
      </CardContent>
    </Card>
  );
}
