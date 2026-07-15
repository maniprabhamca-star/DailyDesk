'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, X, Download, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Search, LayoutGrid, ShieldCheck, ArrowRight, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { BigFileHint } from '@/components/app/big-file-hint';
import { KeepGoing } from '@/components/app/keep-going';
import { openPdf, renderPage, useLazyPageThumb, dprTarget, type PdfHandle } from '@/lib/pdf-render';
import { setHandoff, useFileHandoff } from '@/lib/file-handoff';

// "Do more" targets — hand the OPEN file to a tool with no re-upload. Free tools
// carry the file (each reads it via useFileHandoff); Pro tools are badged and
// route to the tool (gated) or pricing until they're wired + purchasable.
type DoMore = { label: string; href: string; color: string; pro?: string };
const DO_MORE: DoMore[] = [
  { label: 'Compress', href: '/compress-pdf', color: '#0d9488' },
  { label: 'Split', href: '/split-pdf', color: '#d97706' },
  { label: 'Sign', href: '/sign-pdf', color: '#7c3aed' },
  { label: 'Fill form', href: '/fill-pdf-form', color: '#2563eb' },
  { label: 'Watermark', href: '/watermark-pdf', color: '#0f766e' },
  { label: 'Rotate', href: '/rotate-pdf', color: '#0284c7' },
  { label: 'Reorder', href: '/reorder-pdf', color: '#9333ea' },
  { label: 'Delete pages', href: '/delete-pages-from-pdf', color: '#dc2626' },
  { label: 'To Word', href: '/pdf-to-word', color: '#1d4ed8' },
  { label: 'Redact', href: '/redact-pdf', color: '#475569', pro: 'Pro' },
  { label: 'To Excel', href: '/pricing', color: '#15803d', pro: 'Pro' },
  { label: 'OCR', href: '/ocr-pdf', color: '#0284c7', pro: 'Pro' },
  { label: 'Summarize', href: '/pricing', color: '#7c3aed', pro: 'Pro · AI' },
];

function Thumb({ handle, index, active, onClick }: { handle: PdfHandle; index: number; active: boolean; onClick: () => void }) {
  const { ref, url, failed } = useLazyPageThumb<HTMLButtonElement>(handle, index, 120);
  return (
    <button ref={ref} onClick={onClick}
      className={`relative w-full overflow-hidden rounded-md border bg-card transition ${active ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/40'}`}
      style={{ aspectRatio: '1 / 1.3' }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Page ${index + 1}`} className="size-full object-contain" draggable={false} />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground/40">{failed ? '—' : <Loader2 className="size-4 animate-spin" />}</span>
      )}
      <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[9px] font-semibold text-muted-foreground">{index + 1}</span>
    </button>
  );
}

export function PdfViewerTool() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [pageImg, setPageImg] = useState<{ url: string; w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [thumbsOpen, setThumbsOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<number[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { handle?.destroy?.(); }, [handle]);

  const loadFile = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setError(null); setResults(null); setQuery(''); setPageIdx(0); setZoom(1);
    try {
      const h = await openPdf(f);
      setHandle(h); setNumPages(h.numPages); setFile(f);
      const img = await renderPage(h, 0, dprTarget(760, 2.4, 2400));
      setPageImg({ url: img.url, w: img.w, h: img.h });
    } catch {
      setError('Could not open that PDF. It may be corrupt or password-protected.');
    }
  }, []);

  // Receive a file handed off from another tool.
  useFileHandoff(loadFile);

  // Desktop "Open with" (File Handling API): when the installed PWA is launched
  // to open a .pdf, the OS hands the file in via launchQueue. No service worker
  // needed for this path (that's only required for the Android share sheet).
  useEffect(() => {
    const lq = (window as unknown as { launchQueue?: { setConsumer: (cb: (p: { files?: Array<{ getFile: () => Promise<File> }> }) => void) => void } }).launchQueue;
    if (!lq?.setConsumer) return;
    lq.setConsumer(async (params) => {
      const fh = params.files?.[0];
      if (fh?.getFile) { try { void loadFile(await fh.getFile()); } catch { /* ignore */ } }
    });
  }, [loadFile]);

  const gotoPage = useCallback(async (i: number) => {
    if (!handle || i < 0 || i >= numPages) return;
    setPageIdx(i);
    try { const img = await renderPage(handle, i, dprTarget(760, 2.4, 2400)); setPageImg({ url: img.url, w: img.w, h: img.h }); } catch { /* stale */ }
  }, [handle, numPages]);

  // Text search across pages (pdf.js text content). Debounced.
  useEffect(() => {
    if (!handle || query.trim().length < 2) { setResults(null); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      const hits: number[] = [];
      try {
        for (let i = 1; i <= handle.numPages; i++) {
          if (cancelled) return;
          const page = await handle.doc.getPage(i);
          const tc = await page.getTextContent();
          const text = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').toLowerCase();
          if (text.includes(q)) hits.push(i);
        }
      } catch { /* ignore */ }
      if (!cancelled) { setResults(hits); setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, handle]);

  function reset() {
    handle?.destroy?.(); setHandle(null); setFile(null); setPageImg(null); setNumPages(0);
    setError(null); setResults(null); setQuery('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handOff(item: DoMore) {
    // Free tools consume the file (no re-upload). Pro/coming-soon targets don't
    // consume it yet, so we clear the hand-off to avoid a stale carry-over.
    setHandoff(file && !item.pro ? file : null);
    router.push(item.href);
  }

  const dispW = Math.round(640 * zoom);

  return (
    <div className="mx-auto">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />

      {!file ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-14 text-center transition hover:border-primary/50 hover:bg-muted/30">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Upload className="size-6 text-muted-foreground" /></span>
          <span className="mt-4 text-sm font-medium">Drop a PDF here, or click to open</span>
          <span className="mt-1 text-xs text-muted-foreground">Opens on your device — never uploaded. Then send it straight to any tool.</span>
          {error && <span className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</span>}
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">· {numPages} page{numPages === 1 ? '' : 's'}</span>
            </span>

            <button onClick={() => setThumbsOpen((v) => !v)} title="Thumbnails"
              className={`grid size-8 place-items-center rounded-lg border ${thumbsOpen ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:border-primary hover:text-primary'}`}><LayoutGrid className="size-4" /></button>

            <div className="flex items-center overflow-hidden rounded-lg border">
              <button onClick={() => gotoPage(pageIdx - 1)} disabled={pageIdx === 0} className="grid size-8 place-items-center border-r hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <span className="px-2.5 text-xs tabular-nums text-muted-foreground">{pageIdx + 1} / {numPages}</span>
              <button onClick={() => gotoPage(pageIdx + 1)} disabled={pageIdx === numPages - 1} className="grid size-8 place-items-center border-l hover:bg-muted disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>

            <div className="flex items-center overflow-hidden rounded-lg border">
              <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))} className="grid size-8 place-items-center border-r hover:bg-muted"><ZoomOut className="size-4" /></button>
              <span className="px-2 text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))} className="grid size-8 place-items-center border-l hover:bg-muted"><ZoomIn className="size-4" /></button>
            </div>

            <div className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border bg-background px-2.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in document…" className="h-8 w-full bg-transparent text-sm outline-none" />
              {searching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </div>

            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 md:inline-flex"><ShieldCheck className="size-3.5" /> on your device</span>
            <Button size="sm" onClick={() => download(file, file.name)}><Download className="size-4" /> Download</Button>
            <Button size="sm" variant="ghost" onClick={reset}><X className="size-4" /></Button>
          </div>

          {/* search results row */}
          {results && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-primary/[0.04] px-3 py-2 text-xs">
              {results.length === 0 ? <span className="text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</span> : (
                <>
                  <span className="font-medium text-foreground">{results.length} page{results.length === 1 ? '' : 's'} with matches:</span>
                  {results.slice(0, 30).map((p) => (
                    <button key={p} onClick={() => gotoPage(p - 1)} className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary hover:bg-primary/20">p.{p}</button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* body: thumbnails + page */}
          <div className="flex">
            {thumbsOpen && numPages > 1 && (
              <div className="hidden w-[128px] shrink-0 space-y-2.5 overflow-auto border-r bg-muted/30 p-2.5 sm:block" style={{ maxHeight: 560 }}>
                {Array.from({ length: numPages }, (_, i) => (
                  <Thumb key={i} handle={handle!} index={i} active={i === pageIdx} onClick={() => gotoPage(i)} />
                ))}
              </div>
            )}
            <div className="flex flex-1 justify-center overflow-auto bg-muted/30 p-4 sm:p-6" style={{ maxHeight: 560 }}>
              {pageImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pageImg.url} alt={`Page ${pageIdx + 1}`} draggable={false}
                  className="h-fit rounded-sm border shadow-md" style={{ width: dispW, maxWidth: 'none' }} />
              ) : <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
            </div>
          </div>

          {/* Do more */}
          <div className="border-t px-4 py-3.5">
            <p className="mb-2.5 flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-semibold">Do more with this file</span>
              <span className="text-xs text-muted-foreground">— hands the open PDF straight to a tool, no re-upload</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DO_MORE.map((t) => (
                <button key={t.label} onClick={() => handOff(t)}
                  className="group inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
                  <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                  {t.label}
                  {t.pro && <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{t.pro}</span>}
                  <ArrowRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {file && <div className="mx-auto mt-3 max-w-2xl"><BigFileHint bytes={file.size} weight="light" /></div>}
      <KeepGoing />
    </div>
  );
}
