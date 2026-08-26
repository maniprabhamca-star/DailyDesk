'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, FileText, Loader2, Download, Copy, Check, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { useFileHandoff } from '@/lib/file-handoff';
import { useFileSession } from '@/lib/editor-session';
import { extractPages, type ExtractedPages } from '@/lib/pdf-markdown';
import { pdfItemsToMarkdown } from '@/lib/pdf-markdown-core';
import { markdownToHtml, buildHtmlDocument } from '@/lib/pdf-html';

// This runs on the device rather than through LibreOffice on the server, and
// that is a deliberate correction rather than a preference. LibreOffice's PDF
// import represents text as draw objects, which its HTML filter can only export
// as pictures — a real document came out as 75 GIFs and seventeen words. Reading
// the text with pdf.js gives an actual web page, and costs no upload.

export function PdfToHtmlTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [data, setData] = useState<ExtractedPages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headings, setHeadings] = useState(true);
  const [tables, setTables] = useState(true);
  const [view, setView] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setFile(f); setStatus('working'); setError(null); setData(null);
    try {
      setData(await extractPages(f));
      setStatus('done');
    } catch {
      setStatus('failed');
      setError('Could not read that PDF — it may be password-protected or damaged.');
    }
  }, []);

  useFileHandoff(run);
  useFileSession('pdf-to-html', file, run);

  const baseName = (file?.name || 'document.pdf').replace(/\.pdf$/i, '');
  const bodyHtml = useMemo(
    () => (data ? markdownToHtml(pdfItemsToMarkdown(data.pages, { headings, tables })) : ''),
    [data, headings, tables],
  );
  const fullHtml = useMemo(
    () => (data ? buildHtmlDocument(baseName, bodyHtml) : ''),
    [data, bodyHtml, baseName],
  );

  const reset = () => { setFile(null); setStatus('idle'); setData(null); setError(null); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(fullHtml); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  const download = () => downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `${baseName}.html`);

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
          <span className="mt-4 text-base font-semibold">Drop a PDF to turn it into a web page</span>
          <span className="mt-1 text-sm text-muted-foreground">headings, lists and tables preserved — converted on your device, never uploaded</span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" aria-label="Choose a PDF file" className="dd-file-input" onChange={(e) => { void run(e.target.files?.[0]); e.target.value = ''; }} />
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center gap-3 border-b p-4">
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file?.name}>{file?.name}</span>
          <button onClick={reset} aria-label="Remove file" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {status === 'working' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm font-medium">Reading the document…</p>
            <p className="text-xs text-muted-foreground">Extracting text and layout on your device — nothing is uploaded.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-7" /></span>
            <p className="text-base font-bold">Couldn’t read this PDF</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={reset} className="mt-2">Try another PDF</Button>
          </div>
        )}

        {status === 'done' && data && !data.hasText && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-7" /></span>
            <p className="text-base font-bold">This looks like a scanned PDF</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              There’s no selectable text to convert — it’s a picture of a page. Run it through{' '}
              <a href="/ocr-pdf" className="font-semibold text-primary hover:underline">OCR</a> first to add a text layer, then come back.
            </p>
            <Button variant="outline" onClick={reset} className="mt-2">Try another PDF</Button>
          </div>
        )}

        {status === 'done' && data && data.hasText && (
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Toggle on={headings} onClick={() => setHeadings((v) => !v)}>Detect headings</Toggle>
              <Toggle on={tables} onClick={() => setTables((v) => !v)}>Keep tables</Toggle>
              <div className="ml-auto inline-flex rounded-lg border p-0.5 text-xs">
                <button onClick={() => setView('preview')} className={`rounded-md px-2.5 py-1 font-medium transition ${view === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Preview</button>
                <button onClick={() => setView('source')} className={`rounded-md px-2.5 py-1 font-medium transition ${view === 'source' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>HTML</button>
              </div>
            </div>

            {view === 'source' ? (
              <pre className="max-h-[460px] overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">{fullHtml}</pre>
            ) : (
              <div className="md-preview max-h-[460px] overflow-auto rounded-xl border bg-background p-5" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={copy}>{copied ? <><Check className="mr-1.5 size-4" /> Copied</> : <><Copy className="mr-1.5 size-4" /> Copy HTML</>}</Button>
              <Button onClick={download} className="bg-primary text-primary-foreground"><Download className="mr-1.5 size-4" /> Download .html</Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Converted on your device.</b> The PDF is read entirely in your browser — nothing is uploaded, stored, or seen by anyone but you.</p>
      </div>
      {status === 'done' && data?.hasText && <KeepGoing exclude="/pdf-to-html" title="Do more, privately" />}

      <style jsx>{`
        .md-preview :global(h1){font-size:1.4rem;font-weight:700;margin:.6em 0 .3em;line-height:1.2}
        .md-preview :global(h2){font-size:1.2rem;font-weight:700;margin:.6em 0 .3em}
        .md-preview :global(h3){font-size:1.05rem;font-weight:600;margin:.6em 0 .3em}
        .md-preview :global(h4),.md-preview :global(h5),.md-preview :global(h6){font-weight:600;margin:.5em 0 .2em}
        .md-preview :global(p){margin:.5em 0;line-height:1.6}
        .md-preview :global(ul),.md-preview :global(ol){margin:.5em 0 .5em 1.4em}
        .md-preview :global(li){margin:.15em 0}
        .md-preview :global(code){font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:hsl(var(--muted));padding:.1em .35em;border-radius:.25em}
        .md-preview :global(table){border-collapse:collapse;margin:.6em 0;font-size:.9em;display:block;overflow-x:auto}
        .md-preview :global(th),.md-preview :global(td){border:1px solid hsl(var(--border));padding:.35em .6em;text-align:left}
        .md-preview :global(th){background:hsl(var(--muted));font-weight:600}
      `}</style>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      <span className={`size-2 rounded-full ${on ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
      {children}
    </button>
  );
}
