'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, FileText, Download, Loader2, AlertTriangle, X, ShieldCheck, Code2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { useFileHandoff } from '@/lib/file-handoff';
import { makeTextPdf, pdfCanRender, type PdfBlock } from '@/lib/ai-export';
import { makeDocx } from '@/lib/docx';
import { blocksToPlainText, forDocx, forPdf, markdownToBlocks, type DocBlock } from '@/lib/md-blocks';

export type DocSource = 'epub' | 'pdf' | 'markdown';
export type DocOutput = 'pdf' | 'docx' | 'txt';

const ACCEPT: Record<DocSource, string> = {
  epub: '.epub,application/epub+zip',
  pdf: 'application/pdf,.pdf',
  markdown: '.md,.markdown,.txt,text/markdown,text/plain',
};

const LABEL: Record<DocOutput, string> = { pdf: 'PDF', docx: 'Word .docx', txt: 'Plain text' };

type Loaded = { title: string; note: string; blocks: DocBlock[] };

export function DocExportTool({
  source, to, dropTitle, dropHint, pasteHint,
}: {
  source: DocSource;
  to: DocOutput[];
  dropTitle: string;
  dropHint: string;
  pasteHint?: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState('document');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fmt, setFmt] = useState<DocOutput>(to[0]);
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [paste, setPaste] = useState('');
  const [tidy, setTidy] = useState(true);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (f?: File) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    setLoaded(null);
    try {
      setName(f.name.replace(/\.[^.]+$/, '') || 'document');
      if (source === 'epub') {
        const { readEpub, flattenChapters } = await import('@/lib/epub-read');
        const doc = await readEpub(f);
        setLoaded({
          title: doc.title,
          note: `${doc.chapters.length} section${doc.chapters.length === 1 ? '' : 's'} · ${doc.words.toLocaleString()} words${doc.author ? ` · ${doc.author}` : ''}`,
          blocks: flattenChapters(doc),
        });
      } else if (source === 'pdf') {
        const { extractPages } = await import('@/lib/pdf-markdown');
        const { pdfItemsToMarkdown } = await import('@/lib/pdf-markdown-core');
        const { stripRunningHeads, dehyphenate, stitchPages } = await import('@/lib/epub-core');
        const res = await extractPages(f);
        if (!res.hasText) throw new Error('There’s no selectable text in that PDF — it’s a scan. Run it through OCR first and the text will come out.');
        const pages = tidy ? stripRunningHeads(res.pages) : res.pages;
        const perPage = pages.map((p) => pdfItemsToMarkdown([p], { headings: false, tables: false }));
        const joined = tidy ? dehyphenate(stitchPages(perPage)) : perPage.join('\n\n');
        setLoaded({
          title: f.name.replace(/\.pdf$/i, ''),
          note: `${res.numPages} page${res.numPages === 1 ? '' : 's'} · ${(joined.match(/\S+/g) || []).length.toLocaleString()} words`,
          blocks: joined.split(/\n{2,}/).filter((t) => t.trim()).map((text) => ({ type: 'p', text: text.trim() })),
        });
      } else {
        const text = await f.text();
        const blocks = markdownToBlocks(text);
        setLoaded({ title: f.name.replace(/\.[^.]+$/, ''), note: `${blocks.length} blocks · ${(text.match(/\S+/g) || []).length.toLocaleString()} words`, blocks });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }, [source, tidy]);

  useFileHandoff(load);

  function runPaste() {
    setError(null);
    const blocks = markdownToBlocks(paste);
    if (!blocks.length) { setError('Nothing to convert — the box is empty.'); return; }
    setName('document');
    setLoaded({ title: 'document', note: `${blocks.length} blocks · ${(paste.match(/\S+/g) || []).length.toLocaleString()} words`, blocks });
  }

  const plain = useMemo(() => (loaded ? blocksToPlainText(loaded.blocks) : ''), [loaded]);

  // The bundled PDF fonts are WinAnsi — Tamil, Arabic, Chinese and the rest
  // would come out as blank boxes, so we say so instead of shipping tofu.
  const pdfSafe = useMemo(() => (loaded ? pdfCanRender(plain.slice(0, 20000)) : true), [loaded, plain]);

  async function save() {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      if (fmt === 'txt') {
        downloadBlob(new Blob([plain], { type: 'text/plain;charset=utf-8' }), `${name}.txt`);
      } else if (fmt === 'docx') {
        downloadBlob(await makeDocx(forDocx(loaded.blocks)), `${name}.docx`);
      } else {
        downloadBlob(await makeTextPdf(loaded.title || name, forPdf(loaded.blocks) as PdfBlock[]), `${name}.pdf`);
      }
    } catch {
      setError('Could not build that file. Try Word or plain text instead.');
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    try { await navigator.clipboard.writeText(plain); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ }
  }

  function reset() { setLoaded(null); setError(null); setPaste(''); }

  if (!loaded) {
    return (
      <div>
        {source === 'markdown' && (
          <div className="mb-3 inline-flex rounded-xl border p-0.5 text-xs">
            {([['file', 'Drop a file', Upload], ['paste', 'Paste Markdown', Code2]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setTab(id); setError(null); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        )}

        {(source !== 'markdown' || tab === 'file') && (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void load(e.dataTransfer.files?.[0]); }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            </span>
            <span className="mt-4 text-base font-semibold">{dropTitle}</span>
            <span className="mt-1 text-sm text-muted-foreground">{dropHint}</span>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose file</span>
          </button>
        )}

        {source === 'markdown' && tab === 'paste' && (
          <div className="rounded-2xl border bg-card p-4">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={pasteHint}
              className="h-48 w-full resize-y rounded-xl border bg-background p-3 font-mono text-xs outline-none focus:border-primary" />
            <div className="mt-3 flex justify-end">
              <button onClick={runPaste} disabled={!paste.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
                <FileText className="size-4" /> Convert
              </button>
            </div>
          </div>
        )}

        <input ref={inputRef} type="file" accept={ACCEPT[source]} className="dd-file-input" onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}
        <PrivacyNote />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={loaded.title}>{loaded.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{loaded.note}</span>
          <button onClick={reset} aria-label="Start over" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap bg-muted/20 p-4 text-[13px] leading-relaxed">{plain.slice(0, 20000)}{plain.length > 20000 ? '\n\n…' : ''}</pre>

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          {to.length > 1 && (
            <div className="inline-flex overflow-hidden rounded-lg border">
              {to.map((f) => (
                <button key={f} onClick={() => setFmt(f)}
                  className={`px-3 py-1.5 text-xs font-semibold ${fmt === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {LABEL[f]}
                </button>
              ))}
            </div>
          )}
          {source === 'pdf' && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={tidy} onChange={(e) => { setTidy(e.target.checked); setLoaded(null); }} className="size-4 accent-primary" />
              Tidy for reading
            </label>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => void copyText()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy text</>}
            </button>
            <Button onClick={() => void save()} disabled={busy} className="bg-primary text-primary-foreground">
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />}
              Download {LABEL[fmt]}
            </Button>
          </div>
        </div>

        {fmt === 'pdf' && !pdfSafe && (
          <p className="border-t bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            This text uses letters the built-in PDF fonts can’t draw (Tamil, Arabic, Chinese and the like) — they’d come out as empty boxes.
            <b> Word or plain text keeps every character.</b>
          </p>
        )}
        {error && <p className="border-t px-4 py-2.5 text-sm text-destructive">{error}</p>}
      </div>

      <PrivacyNote />
      <KeepGoing title="Do more, privately" />
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Converted on your device.</b> The file is read and the new one written inside this browser tab — nothing is uploaded.</p>
    </div>
  );
}
