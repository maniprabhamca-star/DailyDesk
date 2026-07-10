'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, X, Download, Loader2, ImageIcon, FileImage, CheckCircle2, RotateCcw, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseRanges } from '@/components/pdf/split-tool';
import { encodeJpeg } from '@/lib/mozjpeg';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { KeepMoving } from '@/components/app/keep-moving';
import { setHandoff, takeHandoff } from '@/lib/handoff';
import { getPdfjs, pdfDocOptions, yieldToLoop } from '@/lib/pdf-render';
import { BeforeAfter } from '@/components/pdf/before-after';

type Format = 'jpg' | 'png';
type Preset = 'standard' | 'high' | 'max';

// One smart preset bundles render DPI + mozjpeg quality so users can't pick a
// slow/huge combo. 200 DPI is the pro sweet spot — fully captures fine print
// from embedded scans while staying small and encoding in well under a second.
// (600 DPI was removed: 9× the pixels, no extra real detail, and it froze browsers.)
const PRESET: Record<Preset, { dpi: number; q: number; title: string; sub: string }> = {
  standard: { dpi: 150, q: 78, title: 'Standard', sub: 'Smaller · faster' },
  high: { dpi: 200, q: 82, title: 'High', sub: 'Sharp · recommended' },
  max: { dpi: 300, q: 90, title: 'Maximum', sub: 'Print · archival' },
};
const MAX_DIM = 5000; // clamp very large pages (Letter@300dpi = 2550×3300; A3@300 ≈ 4960)
const PREVIEW_CAP = 3000; // bound the single-page live preview (still keeps the DPI presets visibly distinct)

type Result = { name: string; blob: Blob; url: string; page: number };

// Minimal structural shape of a pdf.js page — just what the preview render uses.
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport: (o: { scale: number }) => PdfViewport;
  render: (o: { canvas: HTMLCanvasElement; viewport: PdfViewport; background: string; intent: string }) => { promise: Promise<void> };
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const inputCls =
  'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none focus:border-primary';

// A selectable option card (premium radio-style tile).
function OptionCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ImageIcon;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

// Compact resolution tile (three across, fits 375px wide).
function ResCard({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
      }`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-[11px] leading-tight text-muted-foreground">{sub}</span>
    </button>
  );
}

export function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<Format>('jpg');
  const [preset, setPreset] = useState<Preset>('high');
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  // Live quality preview (JPG target): one page rendered at the selected DPI +
  // mozjpeg quality, next to the lossless render — judge sharpness before you
  // convert the whole document.
  const [beforePrev, setBeforePrev] = useState<{ url: string; w: number; h: number } | null>(null);
  const [afterPrev, setAfterPrev] = useState<{ url: string; w: number; h: number } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewDocRef = useRef<{ doc: { getPage: (n: number) => Promise<PdfPage>; numPages: number }; destroy: () => Promise<void> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // "Keep moving": carry the converted images straight into JPG→PDF, no re-upload.
  function combineIntoPdf() {
    const files = results.map((r) => new File([r.blob], r.name, { type: r.blob.type || 'image/jpeg' }));
    setHandoff({ files, from: 'PDF to JPG' });
    router.push('/jpg-to-pdf');
  }

  // Revoke any object URLs we created for thumbnails when they change or on unmount.
  function revoke(rs: Result[]) {
    rs.forEach((r) => URL.revokeObjectURL(r.url));
  }
  useEffect(() => () => revoke(results), [results]);

  function clearPreview() {
    setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    setAfterPrev((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
  }

  // Open a pdf.js handle for the live preview once per file (the full convert
  // still opens its own throwaway handle). Loading the engine here is fine — the
  // user has already committed a file and is choosing options.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await getPdfjs();
        const task = pdfjs.getDocument(pdfDocOptions(new Uint8Array(await file.arrayBuffer())));
        const doc = await task.promise;
        if (cancelled) { try { await task.destroy(); } catch { /* ignore */ } return; }
        previewDocRef.current = { doc: doc as unknown as { getPage: (n: number) => Promise<PdfPage>; numPages: number }, destroy: () => task.destroy() };
      } catch { /* preview is optional */ }
    })();
    return () => {
      cancelled = true;
      const d = previewDocRef.current;
      previewDocRef.current = null;
      if (d) void d.destroy().catch(() => {});
    };
  }, [file]);

  // Debounced single-page quality preview (JPG only — PNG is lossless, nothing to
  // compare). Renders the first selected page at the chosen DPI, then shows the
  // lossless render vs the mozjpeg-encoded result at the preset's quality.
  useEffect(() => {
    if (!file || format !== 'jpg' || pageCount === 0) { clearPreview(); return; }
    let cancelled = false;
    setPreviewBusy(true);
    const t = setTimeout(async () => {
      try {
        const handle = previewDocRef.current;
        if (!handle) { setPreviewBusy(false); return; }
        let n = 1;
        try { n = parseRanges(ranges, pageCount)[0] || 1; } catch { n = 1; }
        const page = await handle.doc.getPage(n);
        const { dpi, q } = PRESET[preset];
        let s = dpi / 72;
        let viewport = page.getViewport({ scale: s });
        const longEdge = Math.max(viewport.width, viewport.height);
        const cap = Math.min(MAX_DIM, PREVIEW_CAP);
        if (longEdge > cap) { s = (s * cap) / longEdge; viewport = page.getViewport({ scale: s }); }
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) { setPreviewBusy(false); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
        if (cancelled) { canvas.width = 0; canvas.height = 0; return; }
        const w = canvas.width, h = canvas.height;
        const beforeBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
        const imageData = ctx.getImageData(0, 0, w, h);
        let afterBlob: Blob | null;
        try { afterBlob = await encodeJpeg(imageData, q); }
        catch { afterBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q / 100)); }
        canvas.width = 0; canvas.height = 0;
        if (cancelled) return;
        if (beforeBlob) setBeforePrev((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(beforeBlob), w, h }; });
        if (afterBlob) setAfterPrev((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(afterBlob), w, h }; });
      } catch { /* preview is optional */ } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, format, preset, ranges, pageCount]);

  // Release preview URLs on unmount.
  useEffect(() => () => clearPreview(), []);

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
    setError(null);
    setResults((prev) => { revoke(prev); return []; });
    setSkipped([]);
    setBusy(true);
    try {
      const { PDFDocument } = await import('pdf-lib'); // light: page count only
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const count = doc.getPageCount();
      setFile(f);
      setPageCount(count);
      setRanges(`1-${count}`);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setResults((prev) => { revoke(prev); return []; });
    setFile(null);
    setPageCount(0);
    setRanges('');
    setSkipped([]);
    setError(null);
    setProgress(null);
    setElapsed(null);
    clearPreview();
  }

  function startOver() {
    // Keep settings, clear the file + results so the user can convert another PDF.
    clear();
  }

  function cancelRun() {
    cancelRef.current = true; // the per-page loop bails on its next iteration
  }
  async function run() {
    if (!file) {
      setError('Add a PDF first.');
      return;
    }
    cancelRef.current = false;
    setBusy(true);
    setError(null);
    setSkipped([]);
    setResults((prev) => { revoke(prev); return []; });
    try {
      const pdfjs = await getPdfjs(); // heavy engine — load only on convert
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument(pdfDocOptions(data));
      const doc = await loadingTask.promise;
      try {
        const total = doc.numPages;
        const pages = parseRanges(ranges, total); // 1-based, may throw
        const base = file.name.replace(/\.pdf$/i, '');
        const pad = String(total).length;
        const out: Result[] = [];
        const fails: number[] = [];
        const { dpi, q } = PRESET[preset];
        const t0 = performance.now();
        let done = 0;
        setProgress({ done: 0, total: pages.length });

        // Lean by design: one mozjpeg codec on the main thread, one page at a
        // time, freeing each canvas immediately. No workers, no extra WASM
        // copies — minimal footprint on the user's device. Progressive encoding
        // is off, so each page encodes ~2× faster with identical sharpness.
        for (const n of pages) {
          if (cancelRef.current) throw new DOMException('Cancelled', 'AbortError');
          try {
            const page = await doc.getPage(n);
            let s = dpi / 72; // scale from target DPI
            let viewport = page.getViewport({ scale: s });
            const longEdge = Math.max(viewport.width, viewport.height);
            if (longEdge > MAX_DIM) {
              s = (s * MAX_DIM) / longEdge; // clamp huge pages
              viewport = page.getViewport({ scale: s });
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('no-canvas');
            // White background first — JPEG has no alpha, so transparent areas would go black.
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // intent:'print' = no rAF pacing, so conversion keeps running even if
            // the user switches to another tab mid-job.
            await page.render({ canvas, viewport, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;

            let blob: Blob | null;
            if (format === 'png') {
              blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
            } else {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              try {
                blob = await encodeJpeg(imageData, q);
              } catch {
                // mozjpeg unavailable in this browser → browser encoder, never break.
                blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
              }
            }
            canvas.width = 0;
            canvas.height = 0; // free the canvas immediately
            if (!blob) throw new Error('no-blob');
            out.push({ name: `${base}-page-${String(n).padStart(pad, '0')}.${format}`, blob, url: URL.createObjectURL(blob), page: n });
          } catch {
            fails.push(n);
          }
          done++;
          setProgress({ done, total: pages.length });
          await yieldToLoop(); // yield so progress repaints (not throttled in background tabs)
        }

        if (out.length === 0) {
          throw new Error('None of the selected pages could be converted.');
        }
        setElapsed((performance.now() - t0) / 1000);
        setResults(out);
        setSkipped(fails.sort((a, b) => a - b));
      } finally {
        try { await loadingTask.destroy(); } catch { /* ignore */ }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { /* cancelled — quiet */ }
      else {
        const msg = e instanceof Error ? e.message : '';
        if (/password/i.test(msg)) setError('This PDF is password-protected. Remove the password first, then convert.');
        else setError(msg && msg.length < 120 ? `Could not convert: ${msg}` : 'Could not convert the PDF.');
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function downloadAll() {
    if (results.length === 0) return;
    if (results.length === 1) {
      download(results[0].blob, results[0].name);
      return;
    }
    const base = (file?.name || 'pages').replace(/\.pdf$/i, '');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    results.forEach((r) => zip.file(r.name, r.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    download(zipBlob, `${base}-images.zip`);
  }

  // ---- Results view -------------------------------------------------------
  if (results.length > 0) {
    const totalBytes = results.reduce((a, r) => a + r.blob.size, 0);
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold">Done — {results.length} image{results.length === 1 ? '' : 's'} ready</p>
                <p className="text-xs text-muted-foreground">
                  {format.toUpperCase()} · {PRESET[preset].dpi} DPI · {fmt(totalBytes)} total{elapsed != null ? ` · ${formatDuration(elapsed)}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={startOver}><RotateCcw className="size-4" /> New PDF</Button>
              <Button size="sm" onClick={downloadAll}>
                <Download className="size-4" /> {results.length === 1 ? 'Download' : 'Download all (.zip)'}
              </Button>
            </div>
          </div>

          {skipped.length > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Page{skipped.length === 1 ? '' : 's'} {skipped.join(', ')} couldn’t be rendered and {skipped.length === 1 ? 'was' : 'were'} skipped.</span>
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((r) => (
              <div key={r.page} className="group overflow-hidden rounded-xl border bg-card">
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-muted/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={`Page ${r.page}`} className="max-h-full max-w-full rounded shadow-sm" loading="lazy" />
                </div>
                <div className="flex items-center justify-between gap-2 border-t p-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">Page {r.page}</p>
                    <p className="text-[11px] text-muted-foreground">{fmt(r.blob.size)}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Download page ${r.page}`} onClick={() => download(r.blob, r.name)}>
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <KeepMoving
            actions={[
              {
                count: results.length,
                fromIcon: ImageIcon,
                toIcon: FileText,
                toName: 'JPG to PDF',
                label: 'Combine into a PDF',
                blurb: `Send all ${results.length} image${results.length === 1 ? '' : 's'} straight into JPG → PDF — already loaded, no re-upload.`,
                onClick: combineIntoPdf,
              },
            ]}
          />

          <KeepGoing exclude="/pdf-to-jpg" />
        </CardContent>
      </Card>
    );
  }

  // ---- Upload + options view ---------------------------------------------
  return (
    <Card>
      <CardContent className="p-5">
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Each page becomes a high-resolution JPG or PNG image</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
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

        {file && (
          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Image format</p>
              <div className="grid grid-cols-2 gap-3">
                <OptionCard active={format === 'jpg'} onClick={() => setFormat('jpg')} icon={ImageIcon} title="JPG" desc="Studio-grade mozjpeg — sharp & small" />
                <OptionCard active={format === 'png'} onClick={() => setFormat('png')} icon={FileImage} title="PNG" desc="Lossless — absolute sharpest, zero artifacts" />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Quality</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <ResCard active={preset === 'standard'} onClick={() => setPreset('standard')} title={`${PRESET.standard.title} · ${PRESET.standard.dpi} DPI`} sub={PRESET.standard.sub} />
                <ResCard active={preset === 'high'} onClick={() => setPreset('high')} title={`${PRESET.high.title} · ${PRESET.high.dpi} DPI`} sub={PRESET.high.sub} />
                <ResCard active={preset === 'max'} onClick={() => setPreset('max')} title={`${PRESET.max.title} · ${PRESET.max.dpi} DPI`} sub={PRESET.max.sub} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Pages to convert</label>
              <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" inputMode="numeric" />
              <p className="mt-1.5 text-xs text-muted-foreground">This PDF has {pageCount} page{pageCount === 1 ? '' : 's'}. One image per page; download each one or all of them as a ZIP.</p>
            </div>

            {/* Live quality preview — the first selected page at this exact DPI +
                quality, lossless vs. JPG, so you can zoom in before converting
                the whole document. PNG output is lossless, so no preview there. */}
            {format === 'jpg' && (beforePrev || afterPrev || previewBusy) && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  Quality preview — {PRESET[preset].title} · {PRESET[preset].dpi} DPI
                  {previewBusy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                </p>
                <BeforeAfter
                  before={beforePrev}
                  after={afterPrev}
                  beforeCaption="Lossless"
                  afterCaption={`JPG · ${PRESET[preset].dpi} DPI`}
                  beforeLabel="PNG render"
                  afterLabel={`Quality ${PRESET[preset].q}`}
                  loading={!afterPrev}
                  zoomHint="Hover to zoom into the fine print before you convert"
                />
              </div>
            )}
          </div>
        )}

        {error && <UploadError error={error} />}

        {file && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> {progress ? `Converting ${progress.done}/${progress.total}…` : 'Converting…'}</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={run}>
              <Download className="size-4" /> Convert to {format.toUpperCase()}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
