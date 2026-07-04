'use client';

import { formatDuration } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, X, Download, Loader2, Images, FileImage, CheckCircle2, RotateCcw, Info, Zap, BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { KeepMoving } from '@/components/app/keep-moving';
import { setHandoff, takeHandoff } from '@/lib/handoff';
import { getPdfjs, pdfDocOptions, yieldToLoop } from '@/lib/pdf-render';
import { extractEmbeddedImages, type RawImage } from '@/lib/pdf-extract-images';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

type Result = {
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  ext: 'jpg' | 'png';
  original: boolean; // true = byte-for-byte original JPEG from inside the PDF
  alpha: boolean; // transparency preserved → show on a checkerboard
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Checkerboard behind transparent PNGs so the preserved alpha is visible.
const checker = {
  backgroundImage:
    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
} as const;

// Encode decoded RGBA pixels as a lossless PNG via canvas.
async function rgbaToPng(im: Extract<RawImage, { kind: 'rgba' }>): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = im.width;
  canvas.height = im.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(im.data, im.width, im.height), 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

// Recover images the pdf-lib pass couldn't decode (JPEG 2000, CCITT/JBIG2 fax
// scans, palette/CMYK colorspaces) by letting pdf.js decode them — it handles
// every PDF image format (WASM decoders). Dimension matching is deliberately
// inverted: anything whose dims match an ALREADY-extracted image is skipped (no
// duplicates), everything else is taken up to the number of known leftovers.
// (JPX streams can report different dims than the PDF dict, so matching the
// leftovers' dims directly would miss them.) Photographic recoveries encode as
// high-quality JPG (a lossless PNG of a scan is 5-10× the bytes for nothing —
// the source was lossy already); 1-bit fax pages and anything with real
// transparency stay PNG, where PNG is genuinely smaller/faithful.
async function recoverViaPdfjs(
  data: Uint8Array,
  budget: number,
  handledDims: Set<string>,
  onProgress: (done: number, total: number) => void,
): Promise<Array<{ blob: Blob; width: number; height: number; ext: 'jpg' | 'png' }>> {
  const out: Array<{ blob: Blob; width: number; height: number; ext: 'jpg' | 'png'; pageNo: number }> = [];
  const pdfjs = await getPdfjs();
  // PARALLEL DOC POOL (same pattern as Compress): image decode happens inside
  // each pdf.js document's OWN worker, so opening a few documents over copies
  // of the bytes multiplies decode throughput across cores — the fix for
  // "3 minutes on a 116-page scanned book". Memory-bounded like Compress.
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const POOL_MAX_BYTES = 96 * 1024 * 1024;
  // Fresh copies — pdf.js may transfer the buffer to its worker (detaching it).
  const firstTask = pdfjs.getDocument(pdfDocOptions(data.slice()));
  const firstDoc = await firstTask.promise;
  const numPages = firstDoc.numPages;
  const poolSize = Math.max(1, Math.min(4, cores - 1, data.length <= POOL_MAX_BYTES ? 4 : 1, numPages));
  const tasks = [firstTask, ...Array.from({ length: poolSize - 1 }, () => pdfjs.getDocument(pdfDocOptions(data.slice())))];
  const docs = [firstDoc, ...(await Promise.all(tasks.slice(1).map((t) => t.promise)))];
  try {
    const total = budget;
    const seen = new Set<string>(); // objId strings are identical across the doc copies
    let cursor = 0;
    const drain = async (doc: (typeof docs)[number]): Promise<void> => {
      for (;;) {
        const n = ++cursor;
        if (n > numPages || out.length >= budget) return;
      try {
        const page = await doc.getPage(n);
        const ops = await page.getOperatorList();
        for (let i = 0; i < ops.fnArray.length && out.length < budget; i++) {
          const fn = ops.fnArray[i];
          if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat) continue;
          const objId = ops.argsArray[i][0] as string;
          if (seen.has(objId)) continue;
          seen.add(objId);
          // Decoded image data arrives from the worker ASYNCHRONOUSLY — often
          // after getOperatorList() has already resolved — so the synchronous
          // objs.get(id) throws "not resolved yet". The callback form waits for
          // the transfer; the timeout guards against an image that never lands.
          type PdfImg = { bitmap?: ImageBitmap; data?: Uint8ClampedArray; width?: number; height?: number; kind?: number };
          const img = await new Promise<PdfImg | null>((resolve) => {
            const store = objId.startsWith('g_') ? page.commonObjs : page.objs;
            let settled = false;
            const t = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 15000);
            try {
              store.get(objId, (v: unknown) => { if (!settled) { settled = true; clearTimeout(t); resolve(v as PdfImg); } });
            } catch { clearTimeout(t); if (!settled) { settled = true; resolve(null); } }
          });
          if (!img || !img.width || !img.height) continue;
          if (img.width < 24 || img.height < 24) continue; // same junk filter as the engine
          if (handledDims.has(`${img.width}x${img.height}`)) continue; // already extracted at original quality

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          const bilevel = img.kind === 1; // 1bpp fax/stencil — PNG territory
          if (img.bitmap) {
            ctx.drawImage(img.bitmap, 0, 0);
          } else if (img.data) {
            // pdf.js ImageKind: 1 = grayscale 1bpp (bit-packed), 2 = RGB 24bpp, 3 = RGBA 32bpp
            const px = new Uint8ClampedArray(img.width * img.height * 4);
            const src = img.data;
            if (img.kind === 3) px.set(src);
            else if (img.kind === 2) {
              for (let p = 0, s = 0; p < px.length; p += 4) { px[p] = src[s++]; px[p + 1] = src[s++]; px[p + 2] = src[s++]; px[p + 3] = 255; }
            } else if (bilevel) {
              const stride = Math.ceil(img.width / 8);
              for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                  const bit = (src[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
                  const v = bit ? 255 : 0;
                  const p = (y * img.width + x) * 4;
                  px[p] = v; px[p + 1] = v; px[p + 2] = v; px[p + 3] = 255;
                }
              }
            } else continue;
            ctx.putImageData(new ImageData(px, img.width, img.height), 0, 0);
          } else continue;

          // Real transparency anywhere → PNG keeps it; otherwise photos → JPG.
          const pixels = ctx.getImageData(0, 0, img.width, img.height);
          let hasAlpha = false;
          for (let p = 3; p < pixels.data.length; p += 4) {
            if (pixels.data[p] < 255) { hasAlpha = true; break; }
          }
          let blob: Blob | null;
          let ext: 'jpg' | 'png';
          if (bilevel || hasAlpha) {
            ext = 'png';
            blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
          } else {
            // Native encoder, not mozjpeg: recovered scans are full-page images
            // and native is ~15× faster (same call Compress makes for scan
            // pages) — the other big piece of the 3-minute-book fix.
            ext = 'jpg';
            blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
          }
          canvas.width = 0;
          canvas.height = 0;
          if (blob) {
            out.push({ blob, width: img.width, height: img.height, ext, pageNo: n });
            onProgress(out.length, total);
          }
          await yieldToLoop();
        }
        page.cleanup();
      } catch {
        // page failed — keep going, recovery is best-effort
      }
      await yieldToLoop();
      }
    };
    await Promise.all(docs.map((d) => drain(d)));
  } finally {
    for (const t of tasks) { try { void t.destroy(); } catch { /* ignore */ } }
  }
  // The pool drains pages out of order — restore document order for naming.
  out.sort((a, b) => a.pageNo - b.pageNo);
  return out;
}

export function ExtractImagesTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [originals, setOriginals] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function revoke(rs: Result[]) {
    rs.forEach((r) => URL.revokeObjectURL(r.url));
  }
  useEffect(() => () => revoke(results), [results]);

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
      setError('Please choose a PDF file.');
      return;
    }
    // Free plan: cap single-file size (soft gate, works offline via cached plan).
    if (!canProcessSize(f.size, plan)) {
      setError(null);
      setTooBig({ name: f.name, size: f.size });
      return;
    }
    setTooBig(null);
    setError(null);
    setEmpty(false);
    setResults((prev) => { revoke(prev); return []; });
    setBusy(true);
    try {
      const { PDFDocument } = await import('pdf-lib'); // light: page count only
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      setFile(f);
      setPageCount(doc.getPageCount());
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
    setEmpty(false);
    setError(null);
    setPhase(null);
    setElapsed(null);
    setOriginals(0);
  }

  // "Keep moving": carry the extracted images straight into JPG→PDF.
  function combineIntoPdf() {
    const files = results.map((r) => new File([r.blob], r.name, { type: r.blob.type || 'image/jpeg' }));
    setHandoff({ files, from: 'Extract images' });
    router.push('/jpg-to-pdf');
  }

  async function run() {
    if (!file) {
      setError('Add a PDF first.');
      return;
    }
    setBusy(true);
    setError(null);
    setEmpty(false);
    setResults((prev) => { revoke(prev); return []; });
    try {
      const t0 = performance.now();
      setPhase('Scanning the PDF for embedded images…');
      const data = new Uint8Array(await file.arrayBuffer());
      let step = 0;
      const outcome = await extractEmbeddedImages(data, async () => {
        step++;
        if (step % 3 === 0) await yieldToLoop(); // keep the page responsive
      });

      const base = file.name.replace(/\.pdf$/i, '');
      const out: Result[] = [];
      let origCount = 0;
      setPhase(`Saving ${outcome.images.length} image${outcome.images.length === 1 ? '' : 's'}…`);
      for (const im of outcome.images) {
        if (im.kind === 'jpeg') {
          const blob = new Blob([new Uint8Array(im.bytes)], { type: 'image/jpeg' });
          out.push({ name: '', blob, url: URL.createObjectURL(blob), width: im.width, height: im.height, ext: 'jpg', original: true, alpha: false });
          origCount++;
        } else {
          const blob = await rgbaToPng(im);
          if (blob) out.push({ name: '', blob, url: URL.createObjectURL(blob), width: im.width, height: im.height, ext: 'png', original: false, alpha: im.hasAlpha });
        }
        await yieldToLoop();
      }

      // Recover what pdf-lib couldn't decode (JPX/CCITT/JBIG2/palette images)
      // through pdf.js — scans and faxes land here.
      if (outcome.unhandled.length > 0) {
        setPhase(`Decoding ${outcome.unhandled.length} advanced image${outcome.unhandled.length === 1 ? '' : 's'} (0/${outcome.unhandled.length})…`);
        const handledDims = new Set(out.map((r) => `${r.width}x${r.height}`));
        const recovered = await recoverViaPdfjs(data, outcome.unhandled.length, handledDims, (done, total) =>
          setPhase(`Decoding ${total} advanced image${total === 1 ? '' : 's'} (${done}/${total})…`),
        );
        for (const r of recovered) {
          out.push({ name: '', blob: r.blob, url: URL.createObjectURL(r.blob), width: r.width, height: r.height, ext: r.ext, original: false, alpha: false });
        }
      }

      if (out.length === 0) {
        setEmpty(true);
        return;
      }
      const pad = String(out.length).length;
      out.forEach((r, i) => {
        r.name = `${base}-image-${String(i + 1).padStart(pad, '0')}.${r.ext}`;
      });
      setOriginals(origCount);
      setElapsed((performance.now() - t0) / 1000);
      setResults(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg && msg.length < 120 ? `Could not extract images: ${msg}` : 'Could not extract images from this PDF.');
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  async function downloadAll() {
    if (results.length === 0) return;
    if (results.length === 1) {
      download(results[0].blob, results[0].name);
      return;
    }
    const base = (file?.name || 'images').replace(/\.pdf$/i, '');
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
                <p className="text-sm font-semibold">Done — {results.length} image{results.length === 1 ? '' : 's'} extracted</p>
                <p className="text-xs text-muted-foreground">
                  {originals > 0 ? `${originals} original JPG${originals === 1 ? '' : 's'} · ` : ''}
                  {fmt(totalBytes)} total{elapsed != null ? ` · ${formatDuration(elapsed)}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clear}><RotateCcw className="size-4" /> New PDF</Button>
              <Button size="sm" onClick={downloadAll}>
                <Download className="size-4" /> {results.length === 1 ? 'Download' : 'Download all (.zip)'}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((r, i) => (
              <div key={i} className="group overflow-hidden rounded-xl border bg-card">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted/40 p-2" style={r.alpha ? checker : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={`Extracted image ${i + 1}`} className="max-h-full max-w-full rounded shadow-sm" loading="lazy" />
                  <span className={`absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${r.original ? 'bg-emerald-500/90' : r.ext === 'png' ? 'bg-sky-500/90' : 'bg-slate-500/90'}`}>
                    {r.original ? <><BadgeCheck className="size-3" /> Original JPG</> : r.ext === 'png' ? 'PNG · lossless' : 'JPG'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t p-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{r.width}×{r.height}</p>
                    <p className="text-[11px] text-muted-foreground">{fmt(r.blob.size)}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Download image ${i + 1}`} onClick={() => download(r.blob, r.name)}>
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
                fromIcon: Images,
                toIcon: FileText,
                toName: 'JPG to PDF',
                label: 'Combine into a PDF',
                blurb: `Send all ${results.length} image${results.length === 1 ? '' : 's'} straight into JPG → PDF — already loaded, no re-upload.`,
                onClick: combineIntoPdf,
              },
            ]}
          />

          <KeepGoing exclude="/extract-images-from-pdf" />
        </CardContent>
      </Card>
    );
  }

  // ---- Upload view --------------------------------------------------------
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
            <p className="text-xs text-muted-foreground">Pulls out the actual pictures inside — photos as original JPGs, graphics as lossless PNGs</p>
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
        {/* Input stays mounted so the upgrade notice's "choose another" works. */}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

        {empty && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-sky-500/10 px-3 py-2 text-sm text-sky-700 dark:text-sky-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              No embedded images found — this PDF looks like pure text or vector graphics. If you want a picture of each <em>page</em> instead,
              use <Link href="/pdf-to-jpg" className="font-medium underline">PDF to JPG</Link>.
            </span>
          </p>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !tooBig && (
          <>
            <p className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <FileImage className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Photos stored as JPEG come out <span className="font-medium text-foreground">byte-for-byte original</span> — the exact image that was
                placed in the PDF, not a screenshot of the page. Graphics and screenshots come out as lossless PNGs, transparency preserved.
              </span>
            </p>
            <Button className="mt-4 w-full" size="lg" onClick={run} disabled={busy}>
              {busy ? (
                <><Loader2 className="size-4 animate-spin" /> {phase || 'Extracting…'}</>
              ) : (
                <><Images className="size-4" /> Extract images</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
