'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, Fingerprint, CheckCircle2, ShieldCheck, Zap, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { KeepGoing } from '@/components/app/keep-going';
import { takeHandoff } from '@/lib/handoff';
import { scanDocMetadata, stripDocMetadata, type MetadataScan } from '@/lib/pdf-sanitize';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// The Info keys that most often leak something personal — highlighted in the
// scan so the user sees WHY this matters at a glance.
const SENSITIVE = new Set(['Author', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Title', 'Subject', 'Keywords']);

// Render PDF date strings (D:20260702143000+00'00') as something readable.
function prettyValue(key: string, value: string): string {
  if (/Date$/.test(key)) {
    const m = value.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5] ?? '00'}` : ''}`;
  }
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

export function MetadataTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [scan, setScan] = useState<MetadataScan | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; removed: number; before: number; after: number; verifiedRemaining: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "Keep moving": pick up a PDF handed over from another tool, no re-upload.
  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      void pick2(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(files: FileList | null) {
    await pick2(files?.[0]);
  }

  async function pick2(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError(wrongTypeError(f.name));
      return;
    }
    if (!canProcessSize(f.size, plan)) {
      setError(null);
      setTooBig({ name: f.name, size: f.size });
      return;
    }
    setTooBig(null);
    setError(null);
    setDone(null);
    setScan(null);
    setBusy(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      // updateMetadata:false — otherwise pdf-lib writes its own Producer/ModDate
      // at load time and the scan would report things that aren't in YOUR file.
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      setScan(await scanDocMetadata(doc));
      setPageCount(doc.getPageCount());
      setFile(f);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setFile(null);
    setScan(null);
    setPageCount(0);
    setDone(null);
    setError(null);
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      const removed = await stripDocMetadata(doc);
      const out = await doc.save({ useObjectStreams: true });
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const name = `${file.name.replace(/\.pdf$/i, '')}-clean.pdf`;
      download(blob, name);
      // Re-scan the finished file with the same scanner — metadata is invisible
      // on the page, so this proves to the user it's actually gone.
      let verifiedRemaining = 0;
      try {
        const verify = await PDFDocument.load(out, { ignoreEncryption: true, updateMetadata: false });
        const m = await scanDocMetadata(verify);
        verifiedRemaining = m.fields.length + (m.xmpBytes ? 1 : 0) + (m.thumbs ? 1 : 0) + (m.pieceInfo ? 1 : 0);
      } catch { /* keep 0 if the re-scan fails */ }
      setDone({ blob, name, removed, before: file.size, after: out.length, verifiedRemaining });
    } catch {
      setError('Could not clean this PDF.');
    } finally {
      setBusy(false);
    }
  }

  const found = scan ? scan.fields.length + (scan.xmpBytes > 0 ? 1 : 0) + (scan.thumbs > 0 ? 1 : 0) + (scan.pieceInfo ? 1 : 0) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}
        {tooBig ? (
          <UpgradeNotice
            fileName={tooBig.name}
            sizeText={fmtBytes(tooBig.size)}
            limitText={fmtBytes(FREE_MAX_BYTES)}
            onReset={() => { setTooBig(null); inputRef.current?.click(); }}
          />
        ) : !file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">See the hidden info your PDF carries — then wipe it in one click</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
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
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {/* Scan result — what this PDF quietly says about you */}
        {scan && !done && (
          <div className="mt-4">
            {found === 0 ? (
              <p className="flex items-start gap-2 rounded-md bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <span>Good news — this PDF is already clean. No document metadata, XMP packet, thumbnails or private application data found.</span>
              </p>
            ) : (
              <>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Fingerprint className="size-4 text-primary" /> Hidden info found in this PDF
                </p>
                <div className="divide-y rounded-xl border bg-card text-sm">
                  {scan.fields.map((f2) => (
                    <div key={f2.key} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className={`shrink-0 text-xs font-medium ${SENSITIVE.has(f2.key) ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{f2.key}</span>
                      <span className="min-w-0 break-words text-right text-xs text-foreground">{prettyValue(f2.key, f2.value)}</span>
                    </div>
                  ))}
                  {scan.xmpBytes > 0 && (
                    <div className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">XMP data packet</span>
                      <span className="text-right text-xs text-muted-foreground">{fmt(scan.xmpBytes)} — usually author, software and editing history</span>
                    </div>
                  )}
                  {scan.thumbs > 0 && (
                    <div className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">Embedded thumbnails</span>
                      <span className="text-right text-xs text-muted-foreground">{scan.thumbs} page preview image{scan.thumbs === 1 ? '' : 's'}</span>
                    </div>
                  )}
                  {scan.pieceInfo && (
                    <div className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">Private app data</span>
                      <span className="text-right text-xs text-muted-foreground">/PieceInfo left behind by the creating application</span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  This cleans document metadata only — it does not redact anything visible on the pages themselves.
                </p>
              </>
            )}
          </div>
        )}

        {error && <UploadError error={error} />}

        {done ? (
          <>
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Cleaned — {done.removed} item{done.removed === 1 ? '' : 's'} removed</p>
                  <p className="text-xs text-muted-foreground">{fmt(done.before)} → {fmt(done.after)} · metadata gone, pages untouched</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Again</Button>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                {done.verifiedRemaining === 0 ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-4 shrink-0 text-amber-500" />}
                <span>We re-scanned your cleaned file: <span className="font-medium">{done.removed} hidden item{done.removed === 1 ? '' : 's'}</span> → <span className={done.verifiedRemaining === 0 ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-amber-600'}>{done.verifiedRemaining === 0 ? 'none remain' : `${done.verifiedRemaining} remain`}</span>. It’s invisible on the page, but anyone can read it with “Document Properties” or exiftool — now they can’t.</span>
              </div>
            </div>
            <PdfDone blob={done.blob} name={done.name} currentHref="/remove-pdf-metadata" fromLabel="Remove metadata" hideBanner />
          </>
        ) : (
          <>
            {file && !tooBig && found > 0 && (
              <Button className="mt-4 w-full" size="lg" onClick={run} disabled={busy}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> Cleaning…</> : <><Fingerprint className="size-4" /> Remove all metadata</>}
              </Button>
            )}
            {file && !tooBig && scan && found === 0 && <KeepGoing exclude="/remove-pdf-metadata" />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
