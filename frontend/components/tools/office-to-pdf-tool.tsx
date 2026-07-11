'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, Cloud, FileType2, FileSpreadsheet, Presentation, FileCode2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { ConversionLimitUpsell } from './conversion-limit';

// Shared engine for Word/Excel/PowerPoint -> PDF (DiemDesk's server tier —
// LibreOffice is its STRONG direction, so output fidelity is excellent).
// Same honesty rules as PDF->Word: clear server disclosure, encrypted in
// transit, deleted immediately. The output is a normal PDF, so "Keep moving"
// chains it straight into compress/merge/sign — a flow competitors don't have.

const MAX_BYTES = 50 * 1024 * 1024;

// The registry lives HERE (client side) and pages pass only a string id —
// RegExps and icon components are not serializable across the App Router
// server→client boundary (passing them hangs static generation).
export type OfficeKindId = 'word' | 'excel' | 'powerpoint' | 'document';

type OfficeKind = {
  label: string;
  accept: string;
  extRe: RegExp;
  hint: string;
  icon: LucideIcon;
  currentHref: string;
  fromLabel: string;
};

const KINDS: Record<OfficeKindId, OfficeKind> = {
  word: {
    label: 'Word document',
    accept: '.doc,.docx,.odt,.rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extRe: /\.(docx?|odt|rtf)$/i,
    hint: 'DOCX, DOC, ODT or RTF',
    icon: FileType2,
    currentHref: '/word-to-pdf',
    fromLabel: 'Word to PDF',
  },
  excel: {
    label: 'Excel spreadsheet',
    accept: '.xls,.xlsx,.ods,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
    extRe: /\.(xlsx?|ods|csv)$/i,
    hint: 'XLSX, XLS, ODS or CSV',
    icon: FileSpreadsheet,
    currentHref: '/excel-to-pdf',
    fromLabel: 'Excel to PDF',
  },
  powerpoint: {
    label: 'PowerPoint presentation',
    accept: '.ppt,.pptx,.odp,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extRe: /\.(pptx?|odp)$/i,
    hint: 'PPTX, PPT or ODP',
    icon: Presentation,
    currentHref: '/powerpoint-to-pdf',
    fromLabel: 'PowerPoint to PDF',
  },
  document: {
    label: 'HTML, text or document file',
    accept: '.html,.htm,.txt,.rtf,.odt,text/html,text/plain,application/rtf,application/vnd.oasis.opendocument.text',
    extRe: /\.(html?|txt|rtf|odt)$/i,
    hint: 'HTML, HTM, TXT, RTF or ODT',
    icon: FileCode2,
    currentHref: '/html-to-pdf',
    fromLabel: 'HTML to PDF',
  },
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function OfficeToPdfTool({ kindId }: { kindId: OfficeKindId }) {
  const kind = KINDS[kindId];
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<'upload' | 'convert' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState<string | null>(null); // daily free-conversion cap → upsell
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const Icon = kind.icon;

  function cancelRun() {
    xhrRef.current?.abort(); // fires xhr.onabort → resets busy/phase/progress
    xhrRef.current = null;
  }

  function loadOne(f?: File) {
    if (!f) return;
    if (!kind.extRe.test(f.name)) {
      setError(`Please choose a ${kind.label} (${kind.hint}).`);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`This file is ${fmt(f.size)} — the conversion limit is ${fmt(MAX_BYTES)}.`);
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
    setLimitHit(null);
    setDone(null);
    setPhase('upload');
    setProgress(0);
    const t0 = performance.now();

    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/convert/office-to-pdf');
    xhr.responseType = 'blob';
    xhr.onabort = () => { // user hit Cancel — stop cleanly, no error
      setBusy(false);
      setPhase(null);
      setProgress(null);
    };
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
        const name = `${file.name.replace(/\.[^.]+$/, '')}.pdf`;
        const blob = xhr.response as Blob;
        download(blob, name);
        setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
        return;
      }
      void (xhr.response as Blob).text().then((t) => {
        try {
          const j = JSON.parse(t) as { message?: string; error?: string };
          if (j.error === 'daily-limit') { setLimitHit(j.message || 'You’ve used your free conversions for today.'); return; }
          setError(j.message || 'Could not convert this document.');
        } catch {
          setError(xhr.status === 429 ? 'Too many conversions — please try again in a few minutes.' : 'Could not convert this document.');
        }
      });
    };
    xhr.send(form);
  }

  return (
    <Card>
      <CardContent className="p-5">
        {/* Honest disclosure — this tool is SERVER-side (amber tier). */}
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Cloud className="mt-0.5 size-4 shrink-0" />
          <span>
            Unlike our in-browser tools, Office conversion needs our server: your file is sent over an encrypted connection,
            converted, and <span className="font-semibold">deleted immediately</span> — never stored, never read.{' '}
            <Link href="/security#where-data-goes" className="underline">How we handle data</Link>
          </span>
        </p>

        <input ref={inputRef} type="file" accept={kind.accept} className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a {kind.label} here, or click to choose</p>
            <p className="text-xs text-muted-foreground">{kind.hint} — up to {fmt(MAX_BYTES)}</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose file</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950/40"><Icon className="size-4" /></span>
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

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {limitHit && <ConversionLimitUpsell message={limitHit} />}

        {file && !done && !limitHit && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> Converting…</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}>
              <FileText className="size-4" /> Convert to PDF
            </Button>
          )
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref={kind.currentHref} fromLabel={kind.fromLabel} />}
      </CardContent>
    </Card>
  );
}
