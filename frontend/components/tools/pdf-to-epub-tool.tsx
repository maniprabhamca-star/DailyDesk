'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, Loader2, Download, AlertTriangle, X, ShieldCheck, BookOpen, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { useFileHandoff } from '@/lib/file-handoff';
import { useFileSession } from '@/lib/editor-session';
import { renderMarkdown } from '@/lib/md-render';
import { replaceImageTokens } from '@/lib/epub-core';
import {
  extractForEpub, planEpub, assembleEpub, DEFAULT_EPUB_OPTIONS,
  type EpubSource, type EpubOptions, type ChapterMode,
} from '@/lib/pdf-epub';

const LANGS = [
  { v: 'en', l: 'English' }, { v: 'hi', l: 'Hindi' }, { v: 'ta', l: 'Tamil' }, { v: 'es', l: 'Spanish' },
  { v: 'fr', l: 'French' }, { v: 'de', l: 'German' }, { v: 'pt', l: 'Portuguese' }, { v: 'it', l: 'Italian' },
  { v: 'nl', l: 'Dutch' }, { v: 'ar', l: 'Arabic' }, { v: 'zh', l: 'Chinese' }, { v: 'ja', l: 'Japanese' },
];

const SPLIT_NOTE: Record<string, string> = {
  outline: 'Split at the PDF’s own bookmarks',
  headings: 'Split at the headings we found',
  pages: 'Split into fixed page blocks',
  single: 'Kept as one continuous chapter',
};

export function PdfToEpubTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [progress, setProgress] = useState('');
  const [src, setSrc] = useState<EpubSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [preview, setPreview] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState(DEFAULT_EPUB_OPTIONS.language);
  const [headings, setHeadings] = useState(DEFAULT_EPUB_OPTIONS.headings);
  const [tables, setTables] = useState(DEFAULT_EPUB_OPTIONS.tables);
  const [cleanUp, setCleanUp] = useState(DEFAULT_EPUB_OPTIONS.cleanUp);
  const [cover, setCover] = useState(DEFAULT_EPUB_OPTIONS.cover);
  const [images, setImages] = useState(DEFAULT_EPUB_OPTIONS.images);
  const [chapters, setChapters] = useState<ChapterMode>(DEFAULT_EPUB_OPTIONS.chapters);
  const [pagesPer, setPagesPer] = useState(DEFAULT_EPUB_OPTIONS.pagesPer);

  const run = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setFile(f); setStatus('working'); setError(null); setSrc(null); setPreview(0);
    try {
      const s = await extractForEpub(f, (_frac, label) => setProgress(label));
      setSrc(s);
      setTitle(s.title || f.name.replace(/\.pdf$/i, ''));
      setAuthor(s.author);
      setStatus('done');
    } catch {
      setStatus('failed');
      setError('Could not read that PDF — it may be password-protected or damaged.');
    } finally {
      setProgress('');
    }
  }, []);

  useFileHandoff(run);
  useFileSession('pdf-to-epub', file, run);

  const opts: EpubOptions = useMemo(
    () => ({ title, author, language, headings, tables, cleanUp, cover, images, chapters, pagesPer }),
    [title, author, language, headings, tables, cleanUp, cover, images, chapters, pagesPer],
  );

  // Pure + instant: every toggle re-plans the book without touching the PDF again.
  const plan = useMemo(() => (src ? planEpub(src, opts) : null), [src, opts]);
  useEffect(() => { setPreview(0); }, [plan]);

  // Object URLs for the pictures, so the preview shows the book as it will read
  // — not a list of placeholder tokens.
  const imageUrls = useMemo(() => {
    if (!src || !images) return [];
    return src.images.map((im) => URL.createObjectURL(new Blob([im.data.slice()], { type: im.mime })));
  }, [src, images]);
  useEffect(() => () => { imageUrls.forEach((u) => URL.revokeObjectURL(u)); }, [imageUrls]);

  const previewHtml = useMemo(() => {
    const md = plan?.chapters[preview]?.md ?? '';
    const html = renderMarkdown(md.length > 12000 ? `${md.slice(0, 12000)}\n\n…` : md);
    return replaceImageTokens(html, (n) => imageUrls[n] ?? null);
  }, [plan, preview, imageUrls]);

  const coverUrl = useMemo(() => {
    if (!src?.cover || !cover) return null;
    return URL.createObjectURL(new Blob([src.cover.data.slice()], { type: src.cover.mime }));
  }, [src, cover]);
  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);

  const words = useMemo(
    () => (plan?.chapters ?? []).reduce((n, c) => n + (c.md.trim().match(/\S+/g) || []).length, 0),
    [plan],
  );

  const save = async () => {
    if (!src) return;
    setBuilding(true);
    try {
      const res = await assembleEpub(src, opts);
      downloadBlob(res.blob, res.name);
    } catch {
      setError('Could not pack the EPUB. Try again, or convert without the cover.');
    } finally {
      setBuilding(false);
    }
  };

  const reset = () => { setFile(null); setStatus('idle'); setSrc(null); setError(null); };

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
          <span className="mt-4 text-base font-semibold">Drop a PDF to turn it into an EPUB</span>
          <span className="mt-1 text-sm text-muted-foreground">text that reflows to any screen — chapters, cover and contents built on your device</span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="dd-file-input" onChange={(e) => { void run(e.target.files?.[0]); e.target.value = ''; }} />
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
          {src && <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{src.numPages} page{src.numPages === 1 ? '' : 's'}</span>}
          <button onClick={reset} aria-label="Remove file" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {status === 'working' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm font-medium">{progress || 'Reading the document…'}</p>
            <p className="text-xs text-muted-foreground">Text, bookmarks and cover are read on your device — nothing is uploaded.</p>
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

        {status === 'done' && src && !src.hasText && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-7" /></span>
            <p className="text-base font-bold">This looks like a scanned PDF</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              An EPUB is text that reflows, and there’s no selectable text here — just an image of each page. Run it through{' '}
              <a href="/ocr-pdf" className="font-semibold text-primary hover:underline">OCR</a> first to add a text layer, then come back.
            </p>
            <Button variant="outline" onClick={reset} className="mt-2">Try another PDF</Button>
          </div>
        )}

        {status === 'done' && src && src.hasText && plan && (
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* Book details */}
            <div className="space-y-4">
              <div className="rounded-xl border bg-background p-3.5">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <BookOpen className="size-3.5" /> Book details
                </p>
                <div className="space-y-2.5">
                  <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /></Field>
                  <Field label="Author"><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Unknown" className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" /></Field>
                  <Field label="Language">
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary">
                      {LANGS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
                    </select>
                  </Field>
                </div>
                {coverUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt="Cover — page one of your PDF" className="h-20 w-auto rounded border bg-white object-contain" />
                    <p className="text-[11px] leading-snug text-muted-foreground">Page one becomes the cover, so it looks like a book on your shelf.</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-background p-3.5">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListTree className="size-3.5" /> How it converts
                </p>
                <Field label="Chapters">
                  <select value={chapters} onChange={(e) => setChapters(e.target.value as ChapterMode)} className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary">
                    <option value="auto">Automatic (best available)</option>
                    <option value="outline">At the PDF’s bookmarks</option>
                    <option value="headings">At detected headings</option>
                    <option value="pages">Every N pages</option>
                    <option value="single">One continuous chapter</option>
                  </select>
                </Field>
                {chapters === 'pages' && (
                  <div className="mt-2.5">
                    <Field label="Pages per chapter">
                      <input type="number" min={1} max={200} value={pagesPer} onChange={(e) => setPagesPer(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                        className="h-9 w-24 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
                    </Field>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Toggle on={headings} onClick={() => setHeadings((v) => !v)}>Detect headings</Toggle>
                  <Toggle on={tables} onClick={() => setTables((v) => !v)}>Keep tables</Toggle>
                  <Toggle on={cleanUp} onClick={() => setCleanUp((v) => !v)}>Tidy for reading</Toggle>
                  <Toggle on={cover} onClick={() => setCover((v) => !v)}>Cover</Toggle>
                  <Toggle on={images} onClick={() => setImages((v) => !v)}>
                    Pictures{src.images.length ? ` (${src.images.length})` : ''}
                  </Toggle>
                </div>
                {images && src.imagesDropped > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {src.imagesDropped} more picture{src.imagesDropped === 1 ? '' : 's'} left out to keep the book a sensible size to download.
                  </p>
                )}
                <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
                  <b>Tidy for reading</b> drops running headers and page numbers and rejoins words broken across a line — the three things that make a converted book look photocopied.
                </p>
              </div>
            </div>

            {/* Contents + preview */}
            <div className="min-w-0">
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">{plan.chapters.length} chapter{plan.chapters.length === 1 ? '' : 's'}</span>
                <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">{words.toLocaleString()} words</span>
                <span>{SPLIT_NOTE[plan.splitBy]}</span>
              </div>

              <div className="mb-2.5 flex max-h-24 flex-wrap gap-1.5 overflow-auto">
                {plan.chapters.map((c, i) => (
                  <button key={i} onClick={() => setPreview(i)}
                    className={`max-w-[220px] truncate rounded-lg border px-2.5 py-1 text-xs font-medium transition ${i === preview ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                    title={c.title}>
                    {i + 1}. {c.title}
                  </button>
                ))}
              </div>

              <div className="epub-preview max-h-[420px] overflow-auto rounded-xl border bg-background p-5" dangerouslySetInnerHTML={{ __html: previewHtml }} />

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {error && <p className="mr-auto text-xs text-destructive">{error}</p>}
                <Button onClick={save} disabled={building} className="bg-primary text-primary-foreground">
                  {building ? <><Loader2 className="mr-1.5 size-4 animate-spin" /> Packing…</> : <><Download className="mr-1.5 size-4" /> Download .epub</>}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p><b>Converted on your device.</b> The PDF is read in your browser and the EPUB is packed there too — nothing is uploaded, stored, or seen by anyone but you.</p>
      </div>
      {status === 'done' && src?.hasText && <KeepGoing exclude="/pdf-to-epub" title="Do more, privately" />}

      <style jsx>{`
        .epub-preview :global(h1){font-size:1.4rem;font-weight:700;margin:.6em 0 .3em;line-height:1.2}
        .epub-preview :global(h2){font-size:1.2rem;font-weight:700;margin:.6em 0 .3em}
        .epub-preview :global(h3){font-size:1.05rem;font-weight:600;margin:.6em 0 .3em}
        .epub-preview :global(p){margin:.5em 0;line-height:1.65}
        .epub-preview :global(ul),.epub-preview :global(ol){margin:.5em 0 .5em 1.4em}
        .epub-preview :global(li){margin:.15em 0}
        .epub-preview :global(table){border-collapse:collapse;margin:.6em 0;font-size:.9em;display:block;overflow-x:auto}
        .epub-preview :global(th),.epub-preview :global(td){border:1px solid hsl(var(--border));padding:.35em .6em;text-align:left}
        .epub-preview :global(th){background:hsl(var(--muted));font-weight:600}
        .epub-preview :global(figure){margin:.9em 0;text-align:center}
        .epub-preview :global(img){max-width:100%;height:auto;border-radius:6px;border:1px solid hsl(var(--border))}
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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
