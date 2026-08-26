'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Layers, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { useFileSession } from '@/lib/editor-session';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { parseRanges } from '@/lib/page-ranges';

// Overlay PDF — stamp one PDF on top of (or behind) another, entirely in the
// browser. The use that justifies it: company letterhead behind an invoice, a
// pre-printed form background, a DRAFT/PAID stamp page. Those are exactly the
// documents nobody wants to upload, which is why doing it on-device matters
// more here than on most tools.
//
// Watermark already handles text and images. This is the case Watermark cannot
// do: the stamp is itself a PDF, with its own vectors, fonts and transparency.

type Placement = 'front' | 'behind';
type Fit = 'fit' | 'actual';
type Repeat = 'first' | 'match';

export function OverlayTool() {
  const plan = usePlan();
  const [base, setBase] = useState<File | null>(null);
  const [stamp, setStamp] = useState<File | null>(null);
  const [placement, setPlacement] = useState<Placement>('front');
  const [fit, setFit] = useState<Fit>('fit');
  const [repeat, setRepeat] = useState<Repeat>('first');
  const [opacity, setOpacity] = useState(100);
  const [rangeText, setRangeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);

  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);

  useFileSession('overlay', base, (f) => loadBase(f));

  const tooBig = !!base && !canProcessSize(base.size, plan);

  function isPdf(f: File) {
    return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  }

  function loadBase(f?: File) {
    if (!f) return;
    if (!isPdf(f)) { setError(wrongTypeError(f.name)); return; }
    setError(null); setDone(null); setBase(f);
    openPdf(f)
      .then((h) => { setHandle((prev) => { if (prev) void prev.destroy(); return h; }); setPageCount(h.numPages); })
      .catch(() => { /* preview is optional — the apply path re-reads the file */ });
  }

  function loadStamp(f?: File) {
    if (!f) return;
    if (!isPdf(f)) { setError(wrongTypeError(f.name)); return; }
    setError(null); setDone(null); setStamp(f);
  }

  useEffect(() => () => { if (handle) void handle.destroy(); }, [handle]);

  // First page of the base file, so there is something to look at while the
  // options are chosen. The real proof is the result, not a simulated preview:
  // compositing here would be a second implementation of the apply path and a
  // second chance to disagree with it.
  useEffect(() => {
    if (!handle) { setPreview(null); return; }
    let dead = false;
    void renderPage(handle, 0, dprTarget(360))
      .then((p) => { if (!dead) setPreview(p); })
      .catch(() => { if (!dead) setPreview(null); });
    return () => { dead = true; };
  }, [handle]);

  function reset() {
    setBase(null); setStamp(null); setDone(null); setError(null); setPreview(null);
    setHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setPageCount(0);
  }

  async function run() {
    if (!base || !stamp || busy) return;
    setBusy(true); setError(null);
    const t0 = performance.now();
    try {
      const { PDFDocument } = await import('pdf-lib');
      const baseDoc = await PDFDocument.load(new Uint8Array(await base.arrayBuffer()), { ignoreEncryption: true });
      const stampDoc = await PDFDocument.load(new Uint8Array(await stamp.arrayBuffer()), { ignoreEncryption: true });

      const basePages = baseDoc.getPages();
      const stampCount = stampDoc.getPageCount();
      if (!stampCount) throw new Error('That overlay PDF has no pages.');

      // Which base pages get stamped. Empty = all.
      const wanted = rangeText.trim()
        ? new Set(parseRanges(rangeText, basePages.length))
        : null;

      const alpha = Math.max(0, Math.min(1, opacity / 100));

      if (placement === 'front') {
        // Draw the stamp over each selected page, in place.
        const embedded = await baseDoc.embedPdf(stampDoc, Array.from({ length: stampCount }, (_, i) => i));
        basePages.forEach((page, i) => {
          if (wanted && !wanted.has(i)) return;
          const ep = embedded[repeat === 'match' ? i % stampCount : 0];
          const { width: pw, height: ph } = page.getSize();
          const box = fit
            ? placeFit(ep.width, ep.height, pw, ph, fit)
            : { x: 0, y: 0, width: ep.width, height: ep.height };
          page.drawPage(ep, { ...box, opacity: alpha });
        });
        const out = await baseDoc.save();
        finish(out, t0);
        return;
      }

      // Behind: a page's content cannot be pushed down in place, so the output
      // is rebuilt — stamp first, then the original page over it.
      const outDoc = await PDFDocument.create();
      const embStamp = await outDoc.embedPdf(stampDoc, Array.from({ length: stampCount }, (_, i) => i));
      const embBase = await outDoc.embedPdf(baseDoc, basePages.map((_, i) => i));
      basePages.forEach((page, i) => {
        const { width: pw, height: ph } = page.getSize();
        const p = outDoc.addPage([pw, ph]);
        if (!wanted || wanted.has(i)) {
          const ep = embStamp[repeat === 'match' ? i % stampCount : 0];
          const box = placeFit(ep.width, ep.height, pw, ph, fit);
          p.drawPage(ep, { ...box, opacity: alpha });
        }
        const bp = embBase[i];
        p.drawPage(bp, { x: 0, y: 0, width: pw, height: ph });
      });
      const out = await outDoc.save();
      finish(out, t0);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That file could not be overlaid. If it is password-protected, unlock it first.');
    } finally {
      setBusy(false);
    }
  }

  function finish(bytes: Uint8Array, t0: number) {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    const name = (base?.name || 'document.pdf').replace(/\.pdf$/i, '') + '-overlaid.pdf';
    setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    download(blob, name);
  }

  // Centre the stamp and scale it down to fit, never up — blowing a small stamp
  // up to page size is almost never what a letterhead wants.
  function placeFit(sw: number, sh: number, pw: number, ph: number, mode: Fit) {
    if (mode === 'actual') return { x: (pw - sw) / 2, y: (ph - sh) / 2, width: sw, height: sh };
    const k = Math.min(pw / sw, ph / sh);
    const w = sw * k, h = sh * k;
    return { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h };
  }

  const selectCls = 'rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary';

  if (done) {
    return <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/overlay-pdf" fromLabel="Overlay PDF" onStartOver={reset} />;
  }

  return (
    <div>
      {!base ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); loadBase(e.dataTransfer.files?.[0]); }}
          onClick={() => baseInput.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop the PDF you want stamped, or click to choose</p>
          <p className="text-xs text-muted-foreground">Then add the PDF to lay over it — a letterhead, a background, a stamp page</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          <input ref={baseInput} type="file" accept="application/pdf,.pdf" aria-label="Choose the PDF to stamp" className="dd-file-input" onChange={(e) => { loadBase(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{base.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{pageCount ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</span>
            <button onClick={reset} aria-label="Remove file" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </div>

          {tooBig && (
            <UpgradeNotice
              fileName={base.name}
              sizeText={fmtBytes(base.size)}
              limitText={fmtBytes(FREE_MAX_BYTES)}
              onReset={() => { reset(); baseInput.current?.click(); }}
            />
          )}

          {/* The overlay file */}
          {!stamp ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); loadStamp(e.dataTransfer.files?.[0]); }}
              onClick={() => stampInput.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.03] p-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.06]"
            >
              <Layers className="size-6 text-primary" />
              <p className="mt-2 text-sm font-medium">Now add the overlay PDF</p>
              <p className="text-xs text-muted-foreground">Its first page is used unless you choose page-for-page below</p>
              <input ref={stampInput} type="file" accept="application/pdf,.pdf" aria-label="Choose the overlay PDF" className="dd-file-input" onChange={(e) => { loadStamp(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2 text-sm">
              <Layers className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">Overlay: {stamp.name}</span>
              <button onClick={() => setStamp(null)} aria-label="Remove overlay" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
          )}

          {/* Options */}
          <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Layer</span>
              <select className={selectCls} value={placement} onChange={(e) => setPlacement(e.target.value as Placement)}>
                <option value="front">On top of the page</option>
                <option value="behind">Behind the page</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Size</span>
              <select className={selectCls} value={fit} onChange={(e) => setFit(e.target.value as Fit)}>
                <option value="fit">Scale to fit the page</option>
                <option value="actual">Keep its own size, centred</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Which overlay page</span>
              <select className={selectCls} value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                <option value="first">First page on every page</option>
                <option value="match">Page for page</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Pages</span>
              <input
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="All pages"
                aria-label="Pages to stamp"
                className="w-36 rounded-md border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="col-span-full flex items-center gap-3 text-sm">
              <span className="shrink-0 text-muted-foreground">Opacity</span>
              <input type="range" min={10} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" />
              <span className="w-10 shrink-0 text-right tabular-nums">{opacity}%</span>
            </label>
          </div>

          {placement === 'behind' && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              Behind only shows through where the page is actually transparent. Many PDFs paint a solid
              white rectangle first — on those, use <b>On top of the page</b> with a lower opacity instead.
            </p>
          )}

          {preview && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Page 1 of the file you are stamping</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt="Page 1 preview" className="mx-auto max-h-80 rounded-md border bg-white shadow-sm" />
            </div>
          )}

          {error && <UploadError error={error} />}

          <Button className="w-full" size="lg" onClick={() => void run()} disabled={!stamp || busy || tooBig}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {busy ? 'Overlaying…' : 'Overlay PDF'}
          </Button>
          {!stamp && <p className="text-center text-xs text-muted-foreground">Add the overlay PDF to continue</p>}
        </div>
      )}
    </div>
  );
}
