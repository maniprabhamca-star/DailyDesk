'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, Zap, AlertTriangle, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { BatchRunner } from '@/components/app/batch-runner';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { takeHandoff } from '@/lib/handoff';
import { readDocInfo, writeDocInfo, EMPTY_DOCINFO, type DocInfo } from '@/lib/pdf-docinfo';

const HREF = '/edit-pdf-metadata';

const FIELDS: Array<{ key: keyof DocInfo; label: string; hint: string; type?: 'date' }> = [
  { key: 'title', label: 'Title', hint: 'What readers see in the window and tab — and what search engines index if you publish it' },
  { key: 'author', label: 'Author', hint: 'Separate several names with a semicolon' },
  { key: 'subject', label: 'Subject', hint: 'A one-line description of what the document is' },
  { key: 'keywords', label: 'Keywords', hint: 'Comma-separated' },
  { key: 'creator', label: 'Created with', hint: 'The application the document was originally written in' },
  { key: 'producer', label: 'Produced by', hint: 'The application that wrote the PDF itself' },
  { key: 'created', label: 'Created on', hint: '', type: 'date' },
  { key: 'modified', label: 'Modified on', hint: '', type: 'date' },
];

export function DocInfoTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [values, setValues] = useState<DocInfo>(EMPTY_DOCINFO);
  const [original, setOriginal] = useState<DocInfo>(EMPTY_DOCINFO);
  const [meta, setMeta] = useState<{ hasXmp: boolean; conflicts: string[]; pages: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "Keep moving" — a PDF handed straight over from another tool.
  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      void load(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tooBig = !!file && !canProcessSize(file.size, plan);
  const dirty = JSON.stringify(values) !== JSON.stringify(original);

  async function pick(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length > 1) { reset(); setBatchFiles(list); return; }
    await load(list[0]);
  }

  async function load(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError(wrongTypeError(f.name)); return; }
    setError(null); setDone(null); setFile(f); setReading(true);
    try {
      const read = await readDocInfo(await f.arrayBuffer());
      setValues(read.info);
      setOriginal(read.info);
      setMeta({ hasXmp: read.hasXmp, conflicts: read.conflicts, pages: read.pages });
    } catch {
      setError('Could not read that PDF. It may be corrupted, or password-protected — unlock it first.');
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setFile(null); setBatchFiles([]); setValues(EMPTY_DOCINFO); setOriginal(EMPTY_DOCINFO);
    setMeta(null); setDone(null); setError(null);
  }

  function set<K extends keyof DocInfo>(key: K, v: DocInfo[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function go() {
    if (!file || busy) return;
    setBusy(true); setError(null);
    const t0 = performance.now();
    try {
      const out = await writeDocInfo(await file.arrayBuffer(), values);
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const name = `${file.name.replace(/\.pdf$/i, '')}-info.pdf`;
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      download(blob, name);
    } catch {
      setError('Could not write the new details to this PDF.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <p className="mb-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
          Saved to the document information and, where the file had one, to its XMP packet as well — so every reader shows the same thing.
        </p>
        <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref={HREF} fromLabel="Edit PDF details" onStartOver={reset} />
      </div>
    );
  }

  if (batchFiles.length) {
    return (
      <BatchRunner
        files={batchFiles}
        fileIcon={FileText}
        actionLabel="Apply to all"
        zipName="diemdesk-details.zip"
        onReset={reset}
        controls={
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set the same title, author and subject across every file. Leave a box empty to leave that field alone.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['title', 'author', 'subject'] as const).map((k) => (
                <label key={k} className="text-sm">
                  <span className="mb-1 block text-xs font-medium capitalize text-muted-foreground">{k}</span>
                  <input
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                    value={values[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        }
        process={async (f) => {
          const read = await readDocInfo(await f.arrayBuffer());
          // Empty means "leave alone" in batch — the opposite of the single-file
          // form, where an empty box means the user cleared the field.
          const merged: DocInfo = {
            ...read.info,
            title: values.title || read.info.title,
            author: values.author || read.info.author,
            subject: values.subject || read.info.subject,
          };
          const out = await writeDocInfo(await f.arrayBuffer(), merged);
          return {
            blob: new Blob([new Uint8Array(out)], { type: 'application/pdf' }),
            name: `${f.name.replace(/\.pdf$/i, '')}-info.pdf`,
            before: f.size,
            after: out.length,
          };
        }}
      />
    );
  }

  if (!file) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <Upload className="size-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
        <p className="text-xs text-muted-foreground">Drop several to set the same details across all of them</p>
        <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        <input
          ref={inputRef} type="file" accept="application/pdf,.pdf" multiple
          aria-label="Choose a PDF file" className="dd-file-input"
          onChange={(e) => { void pick(e.target.files); e.currentTarget.value = ''; }}
        />
        {error && <div className="mt-3 w-full"><UploadError error={error} /></div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {handoffNote && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{handoffNote}</p>}

      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        {!!meta?.pages && <span className="shrink-0 text-xs text-muted-foreground">{meta.pages} page{meta.pages === 1 ? '' : 's'}</span>}
        <button onClick={reset} aria-label="Remove file" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>

      {tooBig && (
        <UpgradeNotice fileName={file.name} sizeText={fmtBytes(file.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { reset(); inputRef.current?.click(); }} />
      )}

      {!!meta?.conflicts.length && (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="leading-relaxed">
            This file says two different things about its {meta.conflicts.join(', ').toLowerCase()}. It carries both an old-style
            information block and a newer XMP packet, and they disagree — which is why one reader shows one name and another shows
            something else. Saving here writes your values to both.
          </p>
        </div>
      )}

      {reading ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading what this file already says…
        </div>
      ) : (
        <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className={f.type === 'date' ? 'text-sm' : 'text-sm sm:col-span-2'}>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</span>
              <input
                type={f.type === 'date' ? 'date' : 'text'}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                value={values[f.key]}
                placeholder={f.type === 'date' ? '' : 'Empty'}
                onChange={(e) => set(f.key, e.target.value)}
              />
              {f.hint && <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{f.hint}</span>}
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setValues(EMPTY_DOCINFO)} disabled={busy || reading}>
          <Eraser className="size-4" /> Clear every field
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setValues(original)} disabled={busy || reading || !dirty}>
          Undo my changes
        </Button>
        <span className="text-xs text-muted-foreground">
          Clearing here blanks the fields. To strip hidden traces as well, use{' '}
          <a className="underline underline-offset-2 hover:text-foreground" href="/remove-pdf-metadata">Remove PDF metadata</a>.
        </span>
      </div>

      {error && <UploadError error={error} />}

      <Button className="w-full" size="lg" onClick={() => void go()} disabled={busy || reading || tooBig}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        {busy ? 'Saving…' : 'Save the new details'}
      </Button>
    </div>
  );
}
