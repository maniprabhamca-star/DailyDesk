'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { formatDuration } from '@/lib/format';
import { useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, FileType, CheckCircle2, RotateCcw, Cloud } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';

// PDF -> Word is DiemDesk's FIRST server-processed tool: real PDF-to-editable
// conversion needs an office engine that can't run in a browser. The honesty
// rules apply hard here — the UI says clearly that this one uploads, that the
// file is deleted immediately after conversion, and the page never carries the
// "never uploaded" pill the in-browser tools use.

const MAX_BYTES = 50 * 1024 * 1024;

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PdfToWordTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // upload %
  const [phase, setPhase] = useState<'upload' | 'convert' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  function cancelRun() { xhrRef.current?.abort(); xhrRef.current = null; }

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`This PDF is ${fmt(f.size)} — the conversion limit is ${fmt(MAX_BYTES)}.`);
      return;
    }
    setError(null);
    setDone(null);
    setFile(f);
  }
  function pick(files: FileList | null) { loadOne(files?.[0]); }

  function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setPhase('upload');
    setProgress(0);
    const t0 = performance.now();

    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/convert/pdf-to-word');
    xhr.responseType = 'blob';
    xhr.onabort = () => { setBusy(false); setPhase(null); setProgress(null); }; // user Cancel — quiet
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
        if (pct >= 100) setPhase('convert');
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      setPhase(null);
      setError('Could not reach the conversion server — check your connection and try again.');
    };
    xhr.onload = () => {
      setBusy(false);
      setPhase(null);
      setProgress(null);
      if (xhr.status === 200) {
        const name = `${file.name.replace(/\.pdf$/i, '')}.docx`;
        const blob = xhr.response as Blob;
        download(blob, name);
        setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
        return;
      }
      // Map the API's honest error messages.
      void (xhr.response as Blob).text().then((t) => {
        try {
          const j = JSON.parse(t) as { message?: string };
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
        {/* Honest disclosure — this tool is SERVER-side (amber tier, like the catalog badge). */}
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Cloud className="mt-0.5 size-4 shrink-0" />
          <span>
            Unlike our in-browser tools, converting to an editable Word file needs our server: your PDF is sent over an encrypted
            connection, converted, and <span className="font-semibold">deleted immediately</span> — never stored, never read.{' '}
            <Link href="/security#where-data-goes" className="underline">How we handle data</Link>
          </span>
        </p>

        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Get an editable Word (.docx) file — up to {fmt(MAX_BYTES)}</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setFile(null); setDone(null); setError(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full bg-primary transition-all ${phase === 'convert' ? 'animate-pulse' : ''}`}
                style={{ width: `${phase === 'convert' ? 100 : progress ?? 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {phase === 'upload' ? `Uploading securely… ${progress ?? 0}%` : 'Converting on the server — usually a few seconds…'}
            </p>
          </div>
        )}

        {error && <UploadError error={error} />}

        {file && !done && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Converting…</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}>
              <FileType className="size-4" /> Convert to Word
            </Button>
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
            <KeepGoing exclude="/pdf-to-word" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
