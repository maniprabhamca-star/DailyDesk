'use client';

// A reusable server-conversion tool (PDF → PowerPoint, PDF → PDF/A). Same honest
// server-tier UX as PDF → Word: amber "this one uploads, then it's deleted"
// disclosure, upload progress, the free-daily-cap upsell, immediate download.
// The file is sent, converted on the server, and deleted the instant it downloads.
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, FileText, X, Download, Loader2, CheckCircle2, RotateCcw, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { ConversionLimitUpsell } from './conversion-limit';
import { formatDuration } from '@/lib/format';
import { useFileHandoff } from '@/lib/file-handoff';
import { useFileSession } from '@/lib/editor-session';

const MAX_BYTES = 50 * 1024 * 1024;
const fmt = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export type ServerConvertProps = {
  endpoint: string;      // e.g. /api/convert/pdf-to-powerpoint
  sessionKey: string;    // useFileSession key
  outExt: string;        // 'pptx' | 'pdf'
  ctaLabel: string;      // "Convert to PowerPoint"
  hint: string;          // dropzone sub-line
  excludeHref: string;   // KeepGoing exclude
  disclosure: string;    // the amber server-tier explanation
};

export function ServerConvertTool(props: ServerConvertProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<'upload' | 'convert' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError(wrongTypeError(f.name)); return; }
    if (f.size > MAX_BYTES) { setError(`This PDF is ${fmt(f.size)} — the conversion limit is ${fmt(MAX_BYTES)}.`); return; }
    setError(null); setDone(null); setFile(f);
  }
  useFileHandoff(loadOne);
  useFileSession(props.sessionKey, file, loadOne);

  function run() {
    if (!file) return;
    setBusy(true); setError(null); setLimitHit(null); setDone(null); setPhase('upload'); setProgress(0);
    const t0 = performance.now();
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', props.endpoint);
    xhr.responseType = 'blob';
    const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`); // Pro bypasses the daily cap
    xhr.onabort = () => { setBusy(false); setPhase(null); setProgress(null); };
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
        if (pct >= 100) setPhase('convert');
      }
    };
    xhr.onerror = () => { setBusy(false); setPhase(null); setError('Could not reach the conversion server — check your connection and try again.'); };
    xhr.onload = () => {
      setBusy(false); setPhase(null); setProgress(null);
      if (xhr.status === 200) {
        const name = `${file.name.replace(/\.pdf$/i, '')}.${props.outExt}`;
        const blob = xhr.response as Blob;
        download(blob, name);
        setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
        return;
      }
      void (xhr.response as Blob).text().then((t) => {
        try {
          const j = JSON.parse(t) as { message?: string; error?: string };
          if (j.error === 'daily-limit') { setLimitHit(j.message || 'You’ve used your free conversions for today.'); return; }
          setError(j.message || 'Could not convert this PDF.');
        } catch {
          setError(xhr.status === 429 ? 'Too many conversions — please try again in a few minutes.' : 'Could not convert this PDF.');
        }
      });
    };
    xhr.send(form);
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Cloud className="mt-0.5 size-4 shrink-0" />
          <span>{props.disclosure}{' '}
            <Link href="/security#where-data-goes" target="_blank" rel="noopener noreferrer" className="underline">How we handle data</Link>
          </span>
        </p>

        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { loadOne(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); loadOne(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">{props.hint}</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); setLimitHit(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full bg-primary transition-all ${phase === 'convert' ? 'animate-pulse' : ''}`} style={{ width: `${phase === 'convert' ? 100 : progress ?? 0}%` }} />
            </div>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {phase === 'upload' ? `Uploading securely… ${progress ?? 0}%` : 'Converting on the server — usually a few seconds…'}
            </p>
          </div>
        )}

        {error && <UploadError error={error} />}
        {limitHit && <ConversionLimitUpsell message={limitHit} />}

        {file && !done && !limitHit && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Converting…</Button>
              <Button size="lg" variant="outline" onClick={() => { xhrRef.current?.abort(); }}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}><Download className="size-4" /> {props.ctaLabel}</Button>
          )
        )}

        {done && (
          <>
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Done — {done.name} saved</p>
                <p className="text-xs text-muted-foreground">{fmt(done.blob.size)} · {formatDuration(done.secs)} · your PDF was deleted from the server the moment this downloaded</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDone(null); setFile(null); }}><RotateCcw className="size-4" /> New PDF</Button>
                <Button size="sm" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Again</Button>
              </div>
            </div>
            <KeepGoing exclude={props.excludeHref} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
