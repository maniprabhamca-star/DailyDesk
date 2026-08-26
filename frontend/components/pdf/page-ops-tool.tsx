'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Upload, FileText, X, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { useFileSession } from '@/lib/editor-session';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import {
  halvePages, pagesPerSheet, resizePages, pageSizeSummary,
  PAPER, type PaperName, type Orientation,
} from '@/lib/pdf-pages';

// One shell for the four page-geometry tools. They share everything except the
// options panel and the one function that does the work, so they share this and
// differ in a config object — rather than four files that drift apart the first
// time the dropzone or the size gate changes.

const PAPERS = Object.keys(PAPER) as PaperName[];
const selectCls = 'rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary';

type Ctx = {
  bytes: Uint8Array;
  file: File;
  setNote: (s: string | null) => void;
};

function Shell({
  href, label, cta, suffix, options, run, hint,
}: {
  href: string;
  label: string;
  cta: string;
  suffix: string;
  options: ReactNode;
  run: (ctx: Ctx) => Promise<Uint8Array>;
  hint?: string;
}) {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<PdfHandle | null>(null);

  useFileSession(href.replace(/\W/g, ''), file, (f) => load(f));
  const tooBig = !!file && !canProcessSize(file.size, plan);

  function load(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError(wrongTypeError(f.name)); return; }
    setError(null); setDone(null); setNote(null); setFile(f);
    void openPdf(f).then(async (h) => {
      if (handleRef.current) void handleRef.current.destroy();
      handleRef.current = h;
      setPageCount(h.numPages);
      try { setPreview(await renderPage(h, 0, dprTarget(320))); } catch { setPreview(null); }
    }).catch(() => { /* preview optional */ });
  }

  useEffect(() => () => { if (handleRef.current) void handleRef.current.destroy(); }, []);

  function reset() {
    setFile(null); setDone(null); setError(null); setNote(null); setPreview(null); setPageCount(0);
    if (handleRef.current) { void handleRef.current.destroy(); handleRef.current = null; }
  }

  async function go() {
    if (!file || busy) return;
    setBusy(true); setError(null);
    const t0 = performance.now();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const out = await run({ bytes, file, setNote });
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      const name = file.name.replace(/\.pdf$/i, '') + suffix + '.pdf';
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
      download(blob, name);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That PDF could not be processed. If it is password-protected, unlock it first.');
    } finally {
      setBusy(false);
    }
  }

  // The note explains what just happened — that text is still selectable, or
  // that rasterizing cannot be undone. It used to be rendered only in the
  // pre-run view, so setting it during run() and then switching to the result
  // screen meant nobody ever read it. It belongs with the result.
  if (done) {
    return (
      <div>
        {note && <p className="mb-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">{note}</p>}
        <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref={href} fromLabel={label} onStartOver={reset} />
      </div>
    );
  }

  if (!file) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <Upload className="size-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" aria-label="Choose a PDF file" className="dd-file-input" onChange={(e) => { load(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        {error && <div className="mt-3 w-full"><UploadError error={error} /></div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        {pageCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">{pageCount} page{pageCount === 1 ? '' : 's'}</span>}
        <button onClick={reset} aria-label="Remove file" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>

      {tooBig && (
        <UpgradeNotice fileName={file.name} sizeText={fmtBytes(file.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { reset(); inputRef.current?.click(); }} />
      )}

      <div className="rounded-xl border bg-card p-4">{options}</div>

      {note && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{note}</p>}

      {preview && (
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="mb-2 text-xs text-muted-foreground">Page 1 as it is now</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="Page 1 preview" className="mx-auto max-h-72 rounded-md border bg-white shadow-sm" />
        </div>
      )}

      {error && <UploadError error={error} />}

      <Button className="w-full" size="lg" onClick={() => void go()} disabled={busy || tooBig}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        {busy ? 'Working…' : cta}
      </Button>
    </div>
  );
}

// ---- 1. Halve pages ---------------------------------------------------------
export function HalvePagesTool() {
  const [axis, setAxis] = useState<'vertical' | 'horizontal'>('vertical');
  const [rtl, setRtl] = useState(false);
  return (
    <Shell
      href="/split-pages-in-half" label="Split pages in half" cta="Split every page in half" suffix="-split"
      hint="Scanned a book? Each sheet holds two pages — this separates them"
      options={
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Cut</span>
            <select className={selectCls} value={axis} onChange={(e) => setAxis(e.target.value as 'vertical' | 'horizontal')}>
              <option value="vertical">Down the middle (book spread)</option>
              <option value="horizontal">Across the middle (stacked slips)</option>
            </select>
          </label>
          {axis === 'vertical' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
              <span>Right-to-left book (Arabic, Hebrew, manga)</span>
            </label>
          )}
        </div>
      }
      run={async ({ bytes, setNote }) => {
        const out = await halvePages(bytes, { axis, rightToLeft: rtl });
        setNote('Every page became two. Text stays selectable — nothing was turned into an image.');
        return out;
      }}
    />
  );
}

// ---- 2. Pages per sheet (N-up) ---------------------------------------------
export function PagesPerSheetTool() {
  const [per, setPer] = useState<2 | 4 | 6 | 8 | 9 | 16>(2);
  const [paper, setPaper] = useState<PaperName>('A4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [border, setBorder] = useState(true);
  return (
    <Shell
      href="/pages-per-sheet" label="Pages per sheet" cta="Put pages on one sheet" suffix="-n-up"
      hint="Print a long document short — several pages on every sheet"
      options={
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Pages per sheet</span>
            <select className={selectCls} value={per} onChange={(e) => setPer(Number(e.target.value) as 2)}>
              {[2, 4, 6, 8, 9, 16].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Sheet size</span>
            <select className={selectCls} value={paper} onChange={(e) => setPaper(e.target.value as PaperName)}>
              {PAPERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Orientation</span>
            <select className={selectCls} value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
              <option value="auto">Match the pages</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
            <span>Draw a light frame around each page</span>
          </label>
        </div>
      }
      run={async ({ bytes, setNote }) => {
        const out = await pagesPerSheet(bytes, { per, paper, orientation, marginPt: 18, gapPt: 10, border });
        setNote(`Laid out ${per} pages per sheet on ${paper}. Everything stays vector — it will print sharp.`);
        return out;
      }}
    />
  );
}

// ---- 3. Change / unify page size -------------------------------------------
export function PageSizeTool() {
  const [mode, setMode] = useState<'preset' | 'unify'>('unify');
  const [paper, setPaper] = useState<PaperName>('A4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  return (
    <Shell
      href="/change-pdf-page-size" label="Change page size" cta="Apply page size" suffix="-resized"
      hint="One size for every page — or make a mixed-up document consistent"
      options={
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">What to do</span>
            <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value as 'preset' | 'unify')}>
              <option value="unify">Make every page match the most common size</option>
              <option value="preset">Set a specific size</option>
            </select>
          </label>
          {mode === 'preset' && (
            <>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Size</span>
                <select className={selectCls} value={paper} onChange={(e) => setPaper(e.target.value as PaperName)}>
                  {PAPERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Orientation</span>
                <select className={selectCls} value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                  <option value="auto">Match each page</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
            </>
          )}
        </div>
      }
      run={async ({ bytes, setNote }) => {
        const before = await pageSizeSummary(bytes);
        const out = await resizePages(bytes, { mode, paper, orientation });
        setNote(before.length > 1
          ? `This file had ${before.length} different page sizes (${before.slice(0, 3).map((b) => `${b.label} ×${b.count}`).join(', ')}). Content was scaled to fit and centred — nothing cropped.`
          : 'Content was scaled to fit and centred — nothing cropped.');
        return out;
      }}
    />
  );
}

// ---- 4. Rasterize -----------------------------------------------------------
export function RasterizeTool() {
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(80);
  const [grayscale, setGrayscale] = useState(false);
  return (
    <Shell
      href="/rasterize-pdf" label="Rasterize PDF" cta="Flatten to images" suffix="-flat"
      hint="Turn every page into a picture — nothing left to select, copy or edit"
      options={
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Detail</span>
            <select className={selectCls} value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
              <option value={96}>96 DPI — screen</option>
              <option value={150}>150 DPI — good print</option>
              <option value={200}>200 DPI — sharp print</option>
              <option value={300}>300 DPI — archival (large)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">Quality</span>
            <span className="flex flex-1 items-center gap-2">
              <input type="range" min={40} max={95} step={5} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" />
              <span className="w-9 text-right tabular-nums text-xs">{quality}%</span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
            <span>Greyscale</span>
          </label>
        </div>
      }
      run={async ({ file, setNote }) => {
        const { PDFDocument } = await import('pdf-lib');
        const handle = await openPdf(file);
        try {
          const out = await PDFDocument.create();
          for (let i = 0; i < handle.numPages; i++) {
            const page = await handle.doc.getPage(i + 1);
            const vp1 = page.getViewport({ scale: 1 });
            const scale = dpi / 72;
            const vp = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
            const cx = canvas.getContext('2d');
            if (!cx) throw new Error('This browser ran out of room to render the page.');
            cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
            // intent:'print' — a background tab never finishes a screen-intent
            // render, which is how this hung before (see the pdf.js gotchas).
            await page.render({ canvas, viewport: vp, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
            if (grayscale) {
              const id = cx.getImageData(0, 0, canvas.width, canvas.height);
              const d = id.data;
              for (let p = 0; p < d.length; p += 4) {
                const g = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
                d[p] = d[p + 1] = d[p + 2] = g;
              }
              cx.putImageData(id, 0, 0);
            }
            const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality / 100));
            canvas.width = canvas.height = 0;
            if (!blob) throw new Error('This browser ran out of memory rendering a page. Try a lower DPI.');
            const img = await out.embedJpg(await blob.arrayBuffer());
            // Keep the original page size in points so it still prints correctly.
            const p = out.addPage([vp1.width, vp1.height]);
            p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
          }
          setNote(`Every page is now a ${dpi} DPI image${grayscale ? ' in greyscale' : ''}. Text can no longer be selected, copied or searched — which is the point, but it is not reversible.`);
          return await out.save();
        } finally {
          void handle.destroy();
        }
      }}
    />
  );
}
