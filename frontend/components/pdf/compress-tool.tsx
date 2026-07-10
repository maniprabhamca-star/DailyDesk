'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap, Shrink, CheckCircle2, Coffee, Sparkles, Type, Eye, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';
import { Card, CardContent } from '@/components/ui/card';
import type { PDFRawStream as RawStream } from 'pdf-lib';
import { encodeJpeg } from '@/lib/mozjpeg';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { formatDuration } from '@/lib/format';
import { PdfDone } from '@/components/app/pdf-done';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { ResultDock } from '@/components/app/result-dock';
import { openPdf, renderPage, dprTarget, getPdfjs, pdfDocOptions, yieldToLoop, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { subsetFonts } from '@/lib/pdf-fontgut';
import { stripDocMetadata } from '@/lib/pdf-sanitize';
import { PageStrip } from '@/components/pdf/page-strip';
import { BeforeAfter } from '@/components/pdf/before-after';
import { SavingsRing } from '@/components/app/savings-ring';
import { BigFileHint } from '@/components/app/big-file-hint';

// Uint8Array from pdf-lib/file APIs can be typed as ArrayBufferLike-backed; wrap
// to a fresh ArrayBuffer-backed copy so it satisfies the strict BlobPart type.
function part(bytes: Uint8Array): BlobPart {
  return new Uint8Array(bytes);
}

type Level = 'light' | 'recommended' | 'strong' | 'maximum';

// DPI-aware: we read how big each image is actually displayed on the page and
// downsample it to the level's target DPI — so images shown small get shrunk
// hard (no visible loss) while images shown large stay sharp. `maxDim` is only
// a safe fallback cap for images whose on-page size we can't determine. Vector
// text/graphics are NEVER touched, so the document stays crisp + selectable.
// dpi/quality/maxDim drive the SURGICAL pass (photos on text pages — kept gentle
// so those stay sharp). rasterDpi/rasterQ drive the SCAN-PAGE rasterizer, which
// is much more aggressive because scanned pages dominate file size.
// rasterFrac: when a scan declares an inflated page size (1px drawn per pt →
// the "DPI" reads as ~72 and a DPI-based target would UPSCALE the stored image),
// we instead shrink relative to the stored pixels — rasterFrac × source, never
// above the source resolution. Harness-proven on a real 27MB JPEG-2000 book:
// recommended (0.5 × source, q0.52) → ~58% smaller with crisp, readable output.
const LEVELS: Record<Level, { dpi: number; maxDim: number; quality: number; rasterDpi: number; rasterQ: number; rasterFrac: number; title: string; sub: string }> = {
  light: { dpi: 200, maxDim: 2400, quality: 82, rasterDpi: 130, rasterQ: 0.68, rasterFrac: 0.8, title: 'Light', sub: 'Best quality' },
  recommended: { dpi: 150, maxDim: 1800, quality: 74, rasterDpi: 100, rasterQ: 0.52, rasterFrac: 0.5, title: 'Recommended', sub: 'Best balance' },
  strong: { dpi: 110, maxDim: 1200, quality: 60, rasterDpi: 68, rasterQ: 0.4, rasterFrac: 0.42, title: 'Strong', sub: 'Smaller' },
  // "maximum" forces a full rebuild (rasterizes every image-heavy page) for the
  // last few MB — slower, so we tell the user to be patient.
  maximum: { dpi: 96, maxDim: 1000, quality: 52, rasterDpi: 60, rasterQ: 0.37, rasterFrac: 0.36, title: 'Maximum', sub: 'Squeeze harder' },
};
const MAX_RASTER = 4000; // clamp rasterized scan-page long edge (memory safety)
const RASTER_FLOOR_PX = 1100; // readability floor when shrinking relative to source

// ---- DPI awareness: find each image's on-page display size (in points) ------
// Track the CTM through a page's content stream and record the largest display
// size for every image XObject. Pure string scan — no extra libraries.
const NAME_START = /[A-Za-z'"*]/, NUM_START = /[-+.\d]/, NUM_CHAR = /[-+.\dEe]/, OP_CHAR = /[A-Za-z\d'"*]/, NAME_STOP = /[\s/<>[\]()%]/;

function concatMatrix(ctm: number[], m: number[]): number[] {
  const [A, B, C, D, E, F] = m, [a, b, c, d, e, f] = ctm;
  return [A * a + B * c, A * b + B * d, C * a + D * c, C * b + D * d, E * a + F * c + e, E * b + F * d + f];
}

// Scans a page's content stream: records each image's max on-page display size
// (for DPI-aware surgical sizing) AND returns the largest single image AREA seen
// on the page (pt²) so the caller can tell a "scanned" page (one big image) from
// a real text page.
function scanContent(content: string, nameToTag: Map<string, string>, sizes: Map<string, number>): number {
  let i = 0; const n = content.length; let ctm = [1, 0, 0, 1, 0, 0]; const stack: number[][] = []; let ops: number[] = []; let lastName: string | null = null;
  let maxArea = 0;
  while (i < n) {
    const ch = content[i];
    if (ch === '%') { while (i < n && content[i] !== '\n' && content[i] !== '\r') i++; continue; }
    if (ch === '(') { let dp = 1; i++; while (i < n && dp > 0) { if (content.charCodeAt(i) === 92) { i += 2; continue; } if (content[i] === '(') dp++; else if (content[i] === ')') dp--; i++; } ops = []; continue; }
    if (ch === '<' && content[i + 1] === '<') { i += 2; while (i < n && !(content[i] === '>' && content[i + 1] === '>')) i++; i += 2; ops = []; continue; }
    if (ch === '<') { i++; while (i < n && content[i] !== '>') i++; i++; continue; }
    if (ch === '/') { let j = i + 1; while (j < n && !NAME_STOP.test(content[j])) j++; lastName = content.slice(i, j); i = j; continue; }
    if (NUM_START.test(ch)) { let j = i; while (j < n && NUM_CHAR.test(content[j])) j++; ops.push(parseFloat(content.slice(i, j))); i = j; continue; }
    if (NAME_START.test(ch)) {
      let j = i; while (j < n && OP_CHAR.test(content[j])) j++; const op = content.slice(i, j); i = j;
      if (op === 'q') stack.push(ctm.slice());
      else if (op === 'Q') ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (op === 'cm' && ops.length >= 6) ctm = concatMatrix(ctm, ops.slice(-6));
      else if (op === 'Do' && lastName) { const tag = nameToTag.get(lastName); if (tag) { const sx = Math.hypot(ctm[0], ctm[1]), sy = Math.hypot(ctm[2], ctm[3]); const disp = Math.max(sx, sy); if (disp > (sizes.get(tag) || 0)) sizes.set(tag, disp); const area = sx * sy; if (area > maxArea) maxArea = area; } }
      else if (op === 'BI') { const ei = content.indexOf('EI', i); i = ei < 0 ? n : ei + 2; }
      ops = []; continue;
    }
    i++;
  }
  return maxArea;
}

async function inflateDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null;
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

// Reverse PNG row predictors (DecodeParms /Predictor >= 10) so FlateDecode image
// samples become plain raster rows. Word/Office PDFs often store screenshots
// this way. Returns null on any inconsistency (caller then skips the image).
function pngUnfilter(data: Uint8Array, columns: number, rows: number, colors: number): Uint8Array | null {
  const stride = columns * colors;
  if (data.length < (stride + 1) * rows) return null;
  const out = new Uint8Array(stride * rows);
  let p = 0;
  for (let y = 0; y < rows; y++) {
    const ft = data[p++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const raw = data[p++];
      const a = x >= colors ? out[row + x - colors] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= colors && y > 0 ? out[prev + x - colors] : 0;
      let v: number;
      if (ft === 0) v = raw;
      else if (ft === 1) v = raw + a;
      else if (ft === 2) v = raw + b;
      else if (ft === 3) v = raw + ((a + b) >> 1);
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      out[row + x] = v & 255;
    }
  }
  return out;
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Quick, honest classification of a PDF (no rendering) so we can set an honest
// expectation BEFORE compressing — instead of a misleading numeric estimate.
type Kind = 'scan' | 'image' | 'text';
type Classified = { kind: Kind; p1StoredPx: number };
// Reject a promise if it hasn't settled within `ms` — a watchdog so a stuck
// pdf.js worker (corrupt page, out-of-memory) can never hang the whole job
// forever. Timeouts are deliberately generous: normal parsing/rendering finishes
// far sooner, so legitimate (even very large, slow) files never trip them.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new DOMException('Timed out', 'TimeoutError')), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e as Error); });
  });
}

async function classifyPdf(file: File): Promise<Classified | null> {
  try {
    const { PDFDocument, PDFName, PDFRawStream, PDFArray } = await import('pdf-lib');
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
    const ctx = doc.context;
    let imageBytes = 0;
    for (const [, obj] of ctx.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream && String(obj.dict.get(PDFName.of('Subtype'))) === '/Image') imageBytes += (obj.contents as Uint8Array).length;
    }
    const pages = doc.getPages();
    const dec = new TextDecoder('latin1');
    let scanCount = 0;
    // Page 1's largest stored image long edge — drives the honest pre-run
    // quality preview (same never-upscale target math as the real raster pass).
    let p1StoredPx = 0;
    try {
      const res1 = pages[0]?.node.Resources();
      const xo = res1 ? (res1.lookup(PDFName.of('XObject')) as { keys?: () => unknown[]; get?: (k: unknown) => unknown } | undefined) : undefined;
      if (xo && typeof xo.keys === 'function') {
        for (const k of xo.keys()) {
          const o = ctx.lookup(xo.get!(k) as never);
          if (o instanceof PDFRawStream && String(o.dict.get(PDFName.of('Subtype'))) === '/Image') {
            const px = Math.max(Number(o.dict.get(PDFName.of('Width'))) || 0, Number(o.dict.get(PDFName.of('Height'))) || 0);
            if (px > p1StoredPx) p1StoredPx = px;
          }
        }
      }
    } catch { /* preview falls back to DPI target */ }
    for (const page of pages) {
      const res = page.node.Resources();
      const xobjs = res ? (res.lookup(PDFName.of('XObject')) as { keys?: () => unknown[]; get?: (k: unknown) => unknown } | undefined) : undefined;
      if (!xobjs || typeof xobjs.keys !== 'function') continue;
      const nameToTag = new Map<string, string>();
      for (const k of xobjs.keys()) { const r = xobjs.get!(k) as { tag?: string } | undefined; if (r?.tag) nameToTag.set(String(k), r.tag); }
      if (nameToTag.size === 0) continue;
      const contents = page.node.Contents();
      const streams: unknown[] = [];
      if (contents instanceof PDFArray) for (const r of contents.asArray()) streams.push(ctx.lookup(r));
      else if (contents) streams.push(contents);
      let text = '';
      for (const s of streams) {
        if (!(s instanceof PDFRawStream)) continue;
        if (s.dict.get(PDFName.of('DecodeParms'))) { text = ''; break; }
        const f = s.dict.get(PDFName.of('Filter'));
        const fs2 = f ? String(f) : '';
        let b: Uint8Array | null = s.contents as Uint8Array;
        if (fs2 === '/FlateDecode') b = await inflateDeflate(b);
        else if (fs2) b = null;
        if (b) text += dec.decode(b);
      }
      if (text) {
        const maxArea = scanContent(text, nameToTag, new Map());
        const { width, height } = page.getSize();
        if (width > 0 && height > 0 && maxArea >= 0.7 * width * height) scanCount++;
      }
    }
    const kind: Kind = pages.length > 0 && scanCount / pages.length >= 0.4 ? 'scan'
      : imageBytes / Math.max(1, file.size) >= 0.3 ? 'image' : 'text';
    return { kind, p1StoredPx };
  } catch {
    return null;
  }
}

const KIND_MSG: Record<Kind, string> = {
  scan: 'Looks like a scanned document — Strong or Maximum can shrink it a lot.',
  image: 'Image-heavy — good compression available. Strong gives the smallest size.',
  text: 'Mostly text — limited room to shrink (images are what compress most).',
};

// Decode an embedded JPEG (DCTDecode stream bytes are a complete JPEG bitstream).
async function decodeJpeg(bytes: Uint8Array): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  const blob = new Blob([part(bytes)], { type: 'image/jpeg' });
  if (typeof createImageBitmap === 'function') {
    return (await createImageBitmap(blob)) as ImageBitmap;
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('decode'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CompressTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [level, setLevel] = useState<Level>('recommended');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // A "Preparing…" label for the window BEFORE per-page progress can start —
  // loading a big file and (for scans) opening the pdf.js render pool takes a
  // few seconds with no page count yet, so the button never sits on a bare spinner.
  const [prep, setPrep] = useState<string | null>(null);
  // The staged prep labels only surface once processing has run past a short
  // delay — quick/small files finish before it and never flash the messages;
  // only files slow enough to actually make you wait ever show them.
  const [prepReady, setPrepReady] = useState(false);
  const prepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false); // cooperative cancel — the compress loops check it
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; before: number; after: number; optimized: boolean; note: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [p1StoredPx, setP1StoredPx] = useState(0);
  // Live pre-run quality preview: page 1 rendered exactly as the raster pass
  // would produce it at the selected level (scan files only — that's where
  // quality actually changes; text/vector content is never touched).
  const [levelPreview, setLevelPreview] = useState<RenderedPage | null>(null);
  const [levelPreviewBusy, setLevelPreviewBusy] = useState(false);
  // Multi-page preview state: one pdf.js handle for the original, one for the
  // compressed result (opened only when there's a real before/after to show).
  const [srcHandle, setSrcHandle] = useState<PdfHandle | null>(null);
  const [outHandle, setOutHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selPage, setSelPage] = useState(0);
  const [previewPage, setPreviewPage] = useState<RenderedPage | null>(null); // load screen + optimized result
  const [beforePage, setBeforePage] = useState<RenderedPage | null>(null);
  const [afterPage, setAfterPage] = useState<RenderedPage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Open the original file once (reused for every page render). Replaces any prior
  // handle. Preview is best-effort — failure just leaves the strip/preview empty.
  function openSource(f: File) {
    openPdf(f)
      .then((h) => { setSrcHandle((prev) => { if (prev) void prev.destroy(); return h; }); setPageCount(h.numPages); setSelPage(0); })
      .catch(() => { /* preview is optional */ });
  }

  // Open the compressed result for the "after" side, but only when there's a
  // genuine size win to show (skip the no-op "already optimized" case).
  useEffect(() => {
    if (done && !done.optimized) {
      let cancelled = false;
      openPdf(done.blob)
        .then((h) => { if (cancelled) { void h.destroy(); return; } setOutHandle((prev) => { if (prev) void prev.destroy(); return h; }); })
        .catch(() => { /* fall back to single preview */ });
      return () => { cancelled = true; };
    }
    setOutHandle((prev) => { if (prev) void prev.destroy(); return null; });
  }, [done]);

  // Render the selected page on demand into the right slot(s), cancelling any
  // in-flight render when the page or screen changes. Cached, so revisits are instant.
  useEffect(() => {
    const ac = new AbortController();
    const long = dprTarget(440, 2.8, 2000);
    // Don't blank the current image while the next page renders — that caused a
    // layout jump + flicker on page switch. Keep the old image until the new one
    // resolves, then swap (cached pages swap instantly). Stale renders are dropped
    // via the abort signal.
    if (done && !done.optimized) {
      if (srcHandle) renderPage(srcHandle, selPage, long, ac.signal).then((p) => { if (!ac.signal.aborted) setBeforePage(p); }).catch(() => {});
      if (outHandle) renderPage(outHandle, selPage, long, ac.signal).then((p) => { if (!ac.signal.aborted) setAfterPage(p); }).catch(() => {});
    } else if (srcHandle) {
      renderPage(srcHandle, selPage, long, ac.signal).then((p) => { if (!ac.signal.aborted) setPreviewPage(p); }).catch(() => {});
    }
    return () => ac.abort();
  }, [srcHandle, outHandle, selPage, done]);

  // When compression finishes, keep the view where the user left it — UNLESS the
  // result ends up off-screen. The taller pre-compress UI (preview + level cards)
  // unmounts on done, so the page suddenly shrinks; if the user was scrolled down,
  // their position can now land on the footer with the result above the fold.
  // Double-rAF so we measure AFTER that reflow, then only step in if the dock
  // isn't visible at all (bring it to the top; otherwise never move).
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      const el = doneRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Already sitting near the top of the viewport → leave it. Otherwise (it
      // drifted above the fold when the taller UI unmounted, or sits below) bring
      // it up to the top so the result — not the footer — is what you land on.
      // Instant (not smooth): a smooth scroll gets fought by the before/after
      // images loading in mid-animation and nets to nothing.
      if (top < 8 || top > 140) el.scrollIntoView({ block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [done]);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      // Wrong format? Don't dead-end — point to the right DiemDesk tool.
      setError(wrongTypeError(f.name));
      return;
    }
    // Free plan: cap single-file size (soft gate, works offline via cached plan).
    // Compression QUALITY stays free for everyone — only scale (size) is gated.
    if (!canProcessSize(f.size, plan)) {
      setError(null);
      setTooBig({ name: f.name, size: f.size });
      return;
    }
    setError(null);
    setTooBig(null);
    setDone(null);
    setKind(null);
    setP1StoredPx(0);
    setPreviewPage(null);
    setSelPage(0);
    setPageCount(0);
    setFile(f);
    openSource(f);
    void classifyPdf(f).then((m) => { setKind(m?.kind ?? null); setP1StoredPx(m?.p1StoredPx ?? 0); });
  }
  function pick(files: FileList | null) { loadOne(files?.[0]); }

  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) {
      setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`);
      loadOne(pdf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    setFile(null);
    setTooBig(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setProgress(null);
    setKind(null);
    setP1StoredPx(0);
    setSelPage(0);
    setPageCount(0);
    setPreviewPage(null);
    setBeforePage(null);
    setAfterPage(null);
    setLevelPreview((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    setSrcHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setOutHandle((prev) => { if (prev) void prev.destroy(); return null; });
  }

  // Pre-run quality preview (scan files): render page 1 at the SELECTED level's
  // real raster target + JPEG quality — the same math the compressor uses, so
  // what you see is what you get. Debounced on level switches.
  useEffect(() => {
    setLevelPreview((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
    if (!srcHandle || kind !== 'scan' || done || busy) return;
    let cancelled = false;
    setLevelPreviewBusy(true);
    const t = setTimeout(async () => {
      try {
        const lv = LEVELS[level];
        const page = await srcHandle.doc.getPage(1);
        const vp1 = page.getViewport({ scale: 1 });
        const pageLongPt = Math.max(vp1.width, vp1.height);
        const dpiTargetPx = (lv.rasterDpi / 72) * pageLongPt;
        const fracCapPx = p1StoredPx > 0 ? Math.min(p1StoredPx, Math.max(lv.rasterFrac * p1StoredPx, RASTER_FLOOR_PX)) : Infinity;
        const targetPx = Math.min(MAX_RASTER, dpiTargetPx, fracCapPx);
        const vp = page.getViewport({ scale: targetPx / pageLongPt });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
        const cx = canvas.getContext('2d');
        if (!cx) return;
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport: vp, background: 'rgba(255,255,255,1)', intent: 'print' }).promise;
        const q01 = Math.max(0.32, Math.min(0.9, lv.rasterQ));
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q01));
        const w = canvas.width, h = canvas.height;
        canvas.width = 0; canvas.height = 0;
        if (!cancelled && blob) setLevelPreview({ url: URL.createObjectURL(blob), w, h });
      } catch { /* preview is optional */ } finally {
        if (!cancelled) setLevelPreviewBusy(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcHandle, kind, level, done, busy, p1StoredPx]);

  // Free pdf.js handles (and their cached page bitmaps) on unmount.
  useEffect(() => () => {
    setSrcHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setOutHandle((prev) => { if (prev) void prev.destroy(); return null; });
  }, []);

  function cancelRun() {
    cancelRef.current = true; // the next loop iteration bails; finally clears busy
  }
  async function run(forceArg = false, levelArg?: Level) {
    if (!file) { setError('Add a PDF first.'); return; }
    const useLevel: Level = levelArg ?? level;
    const force = forceArg || useLevel === 'maximum';
    const prevDone = done; // so "Squeeze harder" can never REPLACE a smaller result
    cancelRef.current = false;
    setBusy(true);
    setPrep('Preparing your PDF…');
    setPrepReady(false);
    if (prepTimerRef.current) clearTimeout(prepTimerRef.current);
    prepTimerRef.current = setTimeout(() => setPrepReady(true), 700); // only show staged labels if it's actually slow
    setError(null);
    setDone(null);
    const before = file.size;
    const startedAt = performance.now();
    try {
      const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray } = await import('pdf-lib');
      const original = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(original, { ignoreEncryption: true });
      const ctx = doc.context;
      const { dpi, maxDim, quality, rasterDpi, rasterQ, rasterFrac } = LEVELS[useLevel];

      // DPI awareness (best-effort): read each image's on-page display size by
      // tracking the CTM through every page's content stream. Falls back to the
      // maxDim cap for any image we can't locate, so it's always safe.
      const displaySizes = new Map<string, number>(); // image ref tag -> max display long-edge (pt)
      const scanPages = new Set<number>(); // page indices that are "a big image" (a scan)
      const rasterTargetPx = new Map<number, number>(); // page index -> raster long-edge target (px)
      const scanImageTags = new Set<string>(); // image tags on scan pages — skip in the surgical pass (they get rasterized anyway)
      try {
        const dec = new TextDecoder('latin1');
        const pages = doc.getPages();
        for (let pi = 0; pi < pages.length; pi++) {
          if (cancelRef.current) throw new DOMException('Cancelled', 'AbortError');
          setPrep(`Analyzing page ${pi + 1} of ${pages.length}…`);
          if (pi % 2 === 1) await yieldToLoop(); // let the message tick + keep Cancel responsive
          const page = pages[pi];
          const res = page.node.Resources();
          const xobjs = res ? (res.lookup(PDFName.of('XObject')) as { keys?: () => unknown[]; get?: (k: unknown) => unknown } | undefined) : undefined;
          if (!xobjs || typeof xobjs.keys !== 'function') continue;
          const nameToTag = new Map<string, string>();
          let maxStoredPx = 0; // largest image pixel dimension on this page
          for (const k of xobjs.keys()) {
            const r = xobjs.get!(k);
            const tag = (r as { tag?: string } | undefined)?.tag;
            if (!tag) continue;
            nameToTag.set(String(k), tag);
            try {
              const o = ctx.lookup(r as never);
              if (o instanceof PDFRawStream) {
                const px = Math.max(Number(o.dict.get(PDFName.of('Width'))) || 0, Number(o.dict.get(PDFName.of('Height'))) || 0);
                if (px > maxStoredPx) maxStoredPx = px;
              }
            } catch { /* ignore */ }
          }
          if (nameToTag.size === 0) continue;
          const contents = page.node.Contents();
          const streams: unknown[] = [];
          if (contents instanceof PDFArray) for (const r of contents.asArray()) streams.push(ctx.lookup(r));
          else if (contents) streams.push(contents);
          let text = '';
          for (const s of streams) {
            if (!(s instanceof PDFRawStream)) continue;
            if (s.dict.get(PDFName.of('DecodeParms'))) { text = ''; break; } // predictor — skip page, stay safe
            const filter = s.dict.get(PDFName.of('Filter'));
            const fstr = filter ? String(filter) : '';
            let bytes: Uint8Array | null = s.contents as Uint8Array;
            if (fstr === '/FlateDecode') bytes = await inflateDeflate(bytes);
            else if (fstr) bytes = null; // other content filters — skip this stream
            if (bytes) text += dec.decode(bytes);
          }
          if (text) {
            const maxArea = scanContent(text, nameToTag, displaySizes);
            const { width, height } = page.getSize();
            const pageLongPt = Math.max(width, height);
            // Target long edge if we rasterize this page = the SMALLER of two
            // caps, so both always apply:
            //  - DPI cap: the level's rasterDpi over the page's point size.
            //  - Fraction-of-source cap: rasterFrac × stored px (readability
            //    floor, never above source). Matters for scans that declare
            //    inflated page sizes (1 px per pt → "DPI" reads as ~72), where
            //    the DPI cap alone lands near full resolution and a JPEG can't
            //    beat the stored JPEG-2000. Taking min() of both keeps levels
            //    MONOTONIC: a stronger level always targets ≤ px and ≤ quality,
            //    so Maximum can never come out bigger than Recommended.
            const dpiTargetPx = (rasterDpi / 72) * pageLongPt;
            const fracCapPx = maxStoredPx > 0 ? Math.min(maxStoredPx, Math.max(rasterFrac * maxStoredPx, RASTER_FLOOR_PX)) : Infinity;
            const targetPx = Math.min(dpiTargetPx, fracCapPx);
            // Only rasterize when it's a REAL pixel reduction of the stored
            // image — re-encoding at ~the same size wastes minutes and can even
            // grow the file (e.g. JPEG 2000 beats same-res JPEG). "Squeeze
            // harder" (force) rasterizes any big-image page regardless.
            const worthIt = maxStoredPx > 0 && targetPx <= maxStoredPx * 0.87;
            if (width > 0 && height > 0 && maxArea >= 0.7 * width * height && (force || worthIt)) {
              scanPages.add(pi);
              rasterTargetPx.set(pi, targetPx);
              nameToTag.forEach((tag) => scanImageTags.add(tag));
            }
          }
        }
      } catch { /* best-effort; surgical + safe fallbacks below still work */ }

      // Collect embedded images we can safely recompress. Two kinds:
      //  - 'jpeg' (DCTDecode): decode + downsample + re-encode (photo path).
      //  - 'flate' (FlateDecode, 8-bit RGB/Gray, no transparency): PNG-style
      //    screenshots that Word/Office PDFs embed LOSSLESSLY — converting them
      //    to JPEG is the big win on everyday office documents (the class of
      //    file where competitors were beating us). Anything else is untouched.
      const imageKind = (obj: unknown): 'jpeg' | 'flate' | null => {
        if (!(obj instanceof PDFRawStream)) return null;
        const d = obj.dict;
        if (String(d.get(PDFName.of('Subtype'))) !== '/Image') return null;
        if (d.get(PDFName.of('ImageMask'))) return null;
        const filter = String(d.get(PDFName.of('Filter')));
        if (filter === '/DCTDecode') return 'jpeg';
        if (filter === '/FlateDecode') {
          if (d.get(PDFName.of('SMask')) || d.get(PDFName.of('Mask'))) return null; // keep transparency intact
          if (Number(d.get(PDFName.of('BitsPerComponent'))) !== 8) return null;
          return 'flate';
        }
        return null;
      };

      // Resolve a FlateDecode image's channel count (3 = RGB, 1 = Gray) — only
      // the colorspaces we can convert faithfully; anything exotic is skipped.
      const flateChannels = (d: RawStream['dict']): 3 | 1 | null => {
        try {
          const cs = ctx.lookup(d.get(PDFName.of('ColorSpace')));
          const s = String(cs);
          if (s === '/DeviceRGB') return 3;
          if (s === '/DeviceGray') return 1;
          if (cs instanceof PDFArray && String(cs.get(0)) === '/ICCBased') {
            const icc = ctx.lookup(cs.get(1));
            const n = icc instanceof PDFRawStream ? Number(icc.dict.get(PDFName.of('N'))) : NaN;
            if (n === 3) return 3;
            if (n === 1) return 1;
          }
        } catch { /* fall through */ }
        return null;
      };

      // Decode a FlateDecode image to ImageData (handles PNG predictors).
      const decodeFlate = async (obj: RawStream): Promise<ImageData | null> => {
        const d = obj.dict;
        const w = Number(d.get(PDFName.of('Width')));
        const h = Number(d.get(PDFName.of('Height')));
        const channels = flateChannels(d);
        if (!w || !h || !channels) return null;
        const inflated = await inflateDeflate(obj.contents as Uint8Array);
        if (!inflated) return null;
        let samples: Uint8Array | null = inflated;
        const parmsObj = ctx.lookup(d.get(PDFName.of('DecodeParms')));
        if (parmsObj) {
          const get = (k: string) => Number((parmsObj as RawStream['dict']).get?.(PDFName.of(k)) ?? NaN);
          const predictor = get('Predictor');
          if (Number.isNaN(predictor) || predictor === 1) { /* no prediction */ }
          else if (predictor >= 10) {
            const colors = get('Colors') || channels;
            const columns = get('Columns') || w;
            samples = pngUnfilter(inflated, columns, h, colors);
          } else return null; // TIFF predictor — rare, skip
        }
        if (!samples || samples.length < w * h * channels) return null;
        const img = new ImageData(w, h);
        const px = img.data;
        for (let i = 0, s = 0; i < w * h; i++) {
          if (channels === 3) { px[i * 4] = samples[s++]; px[i * 4 + 1] = samples[s++]; px[i * 4 + 2] = samples[s++]; }
          else { const g = samples[s++]; px[i * 4] = g; px[i * 4 + 1] = g; px[i * 4 + 2] = g; }
          px[i * 4 + 3] = 255;
        }
        return img;
      };

      // Skip images that sit on scan pages — those pages get rasterized whole, so
      // recompressing their images first is wasted (slow) work.
      const images = ctx.enumerateIndirectObjects().filter(([ref, obj]) => imageKind(obj) !== null && !scanImageTags.has((ref as unknown as { tag: string }).tag));
      setProgress({ done: 0, total: images.length });
      if (images.length > 0) setPrep(null); // real per-image progress takes over

      let recompressed = 0;
      for (let i = 0; i < images.length; i++) {
        if (cancelRef.current) throw new DOMException('Cancelled', 'AbortError');
        const [ref, rawObj] = images[i];
        const obj = rawObj as RawStream;
        try {
          const d = obj.dict;
          const kind = imageKind(obj);
          const w = Number(d.get(PDFName.of('Width')));
          const h = Number(d.get(PDFName.of('Height')));
          const raw = obj.contents as Uint8Array;
          if (!w || !h || raw.length < 1024) continue; // tiny — not worth it

          const dispPt = displaySizes.get((ref as unknown as { tag: string }).tag);
          const longPx = Math.max(w, h);
          // At/below target dims: only worth re-encoding when the stored JPEG is
          // lavish (bytes-per-pixel says ~q85+, which is how Word/Office embed
          // them) — and then only accepted on a REAL win (≥15% smaller below),
          // so efficient files never churn through generational re-encodes for
          // crumbs. Harness-proven on the JobberDealer office file: one skipped
          // 804×391 banner alone was 17KB of the gap to Smallpdf.
          let atTarget = false;
          if (kind === 'jpeg' && !force) {
            atTarget = dispPt ? longPx <= (dispPt / 72) * dpi * 1.15 : longPx <= maxDim;
            if (atTarget && raw.length / (w * h) <= 0.1) continue; // stored efficiently — skip
          }
          if (kind === 'flate' && (w * h < 100 * 100 || raw.length < 2048)) continue; // icons/logos: keep pixel-perfect

          // Decode by kind → pixels on a canvas.
          let src: CanvasImageSource & { width: number; height: number; close?: () => void };
          if (kind === 'jpeg') {
            src = await decodeJpeg(raw);
          } else {
            const img = await decodeFlate(obj);
            if (!img) continue;
            if (typeof createImageBitmap === 'function') {
              src = await createImageBitmap(img);
            } else {
              // Older browsers: draw via a temp canvas (a canvas is a CanvasImageSource).
              const t = document.createElement('canvas');
              t.width = img.width; t.height = img.height;
              t.getContext('2d')?.putImageData(img, 0, 0);
              src = t;
            }
          }

          // DPI-aware target: shrink to what the image's on-page size needs at the
          // chosen DPI; fall back to the maxDim cap when its placement is unknown.
          const targetLong = dispPt ? Math.max(64, Math.ceil((dispPt / 72) * dpi)) : maxDim;
          const scale = Math.min(1, targetLong / Math.max(w, h));
          const nw = Math.max(1, Math.round(w * scale));
          const nh = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = nw; canvas.height = nh;
          const cx = canvas.getContext('2d');
          if (!cx) { src.close?.(); continue; }
          cx.fillStyle = '#ffffff';
          cx.fillRect(0, 0, nw, nh);
          cx.drawImage(src, 0, 0, nw, nh);
          src.close?.();
          const imageData = cx.getImageData(0, 0, nw, nh);
          // Screenshots (flate) get a gentler quality: sharp UI text matters more
          // than a few extra KB, and they're small to begin with.
          const outBlob = await encodeJpeg(imageData, kind === 'flate' ? Math.max(quality, 80) : quality);
          const outBytes = new Uint8Array(await outBlob.arrayBuffer());
          canvas.width = 0; canvas.height = 0;

          if (outBytes.length < (atTarget ? raw.length * 0.85 : raw.length)) {
            const ns = PDFRawStream.of(d, outBytes);
            ns.dict.set(PDFName.of('Width'), PDFNumber.of(nw));
            ns.dict.set(PDFName.of('Height'), PDFNumber.of(nh));
            ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
            ns.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
            ns.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
            ns.dict.delete(PDFName.of('DecodeParms'));
            ns.dict.delete(PDFName.of('Decode'));
            ctx.assign(ref, ns);
            recompressed++;
          }
        } catch {
          // leave this image untouched on any error
        }
        setProgress({ done: i + 1, total: images.length });
        await yieldToLoop(); // keep UI responsive (not throttled in background tabs)
      }

      // FONT PASS (lossless — runs at every level): slim embedded fonts by
      // emptying unused glyph outlines. Often the biggest win on office PDFs
      // (fonts can be >50% of the file). Safe by construction + heavily
      // guarded — see lib/pdf-fontgut.ts. Best-effort.
      let fontsSlimmed = 0;
      // Skip font-slimming when the document is overwhelmingly scans — fonts are
      // a negligible fraction of a scanned book, so parsing them all is time
      // spent for almost no size win. Text/office PDFs (where fonts can be >50%)
      // still get the full pass.
      const totalPages = doc.getPageCount();
      const mostlyScans = totalPages > 0 && scanPages.size >= totalPages * 0.6;
      if (!mostlyScans) {
        setPrep('Slimming fonts…');
        try {
          fontsSlimmed = await subsetFonts(doc, original);
        } catch { /* best-effort — never blocks the rest of the pipeline */ }
      }

      // METADATA PASS (lossless, every level): drop the Info dictionary, XMP
      // packet, embedded page thumbnails and /PieceInfo — free bytes (XMP alone
      // is 3-20KB on office files) and a privacy win (author names, editing
      // history). The document renders identically. Best-effort.
      let metaRemoved = 0;
      try {
        metaRemoved = await stripDocMetadata(doc);
      } catch { /* best-effort */ }

      // Hybrid pass: re-render SCANNED (text-light) pages at the target DPI and
      // re-encode them — this handles images in ANY format (the big win for
      // scanned books), while real TEXT pages are kept as-is so their text stays
      // crisp and selectable. Best-effort: if pdf.js can't load the file we fall
      // back to the surgical-only result.
      let outBytes: Uint8Array;
      let rasterized = 0;
      let copied = 0;
      if (scanPages.size === 0) {
        // No page needs rasterizing — skip pdf.js entirely so efficient files
        // finish near-instantly (just the surgical result + structural save).
        outBytes = await doc.save({ useObjectStreams: true });
      } else try {
        // Scanned doc: opening the render pool (copies of a big file, parsed in
        // parallel workers) runs before the first page renders — show the page
        // count so the wait reads as "Preparing 116 pages…", not a dead spinner.
        setPrep(`Preparing ${doc.getPageCount()} page${doc.getPageCount() === 1 ? '' : 's'}…`);
        const pdfjs = await getPdfjs();
        // PARALLEL RASTER POOL: image decode (the dominant cost on scanned
        // books, e.g. JPEG-2000 pages) happens inside each pdf.js document's
        // OWN worker — so opening a few documents over copies of the same bytes
        // multiplies decode throughput across CPU cores. Memory-bounded: extra
        // workers only when the file is small enough to afford the copies.
        const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
        const POOL_MAX_BYTES = 96 * 1024 * 1024;
        const poolSize = Math.max(1, Math.min(4, cores - 1, original.length <= POOL_MAX_BYTES ? 4 : 1, scanPages.size));
        const tasks = Array.from({ length: poolSize }, () => pdfjs.getDocument(pdfDocOptions(original.slice())));
        // Watchdog: if opening the pool ever stalls on a bad file, tear the
        // workers down and fall through to the surgical-only result instead of
        // hanging. 90s is far beyond any normal parse.
        const jsDocs = await withTimeout(Promise.all(tasks.map((t) => t.promise)), 90000)
          .catch((e) => { for (const t of tasks) { try { void t.destroy(); } catch { /* ignore */ } } throw e; });
        try {
          const pageCount = doc.getPageCount();
          const outDoc = await PDFDocument.create();
          setProgress({ done: 0, total: pageCount });
          setPrep(null); // pool is open — per-page progress takes over now
          const q01 = Math.max(0.32, Math.min(0.9, rasterQ));

          // Phase 1 — render every flagged scan page through the pool (out of
          // order), buffering the JPEG bytes (≈ the output size, so bounded).
          // Pages NOT flagged are copied untouched in phase 2 — already-efficient
          // files skip rendering entirely and finish in seconds.
          const scanList = Array.from(scanPages).sort((a, b) => a - b);
          const renderedPages = new Map<number, { jpg: Uint8Array; w: number; h: number }>();
          let cursor = 0;
          let progressed = 0;
          const drain = async (jsDoc: (typeof jsDocs)[number]): Promise<void> => {
            for (;;) {
              if (cursor >= scanList.length) return;
              const idx = scanList[cursor++];
              try {
                const jp = await jsDoc.getPage(idx + 1);
                const vp1 = jp.getViewport({ scale: 1 });
                const pageLongPt = Math.max(vp1.width, vp1.height);
                // Per-page target from the analysis pass (never upscales the
                // source image); DPI-derived fallback, clamped for memory safety.
                const targetPx = Math.min(MAX_RASTER, rasterTargetPx.get(idx) ?? (rasterDpi / 72) * pageLongPt);
                const vp = jp.getViewport({ scale: targetPx / pageLongPt });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
                const cx = canvas.getContext('2d');
                if (cx) {
                  cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
                  // intent:'print' = no rAF pacing, so compression keeps running
                  // even if the user switches to another tab mid-job.
                  // Per-page watchdog: one stuck page can't hang the whole job —
                  // cancel it after 45s and let phase 2 copy it untouched.
                  const rt = jp.render({ canvas, viewport: vp, background: 'rgba(255,255,255,1)', intent: 'print' });
                  await withTimeout(rt.promise, 45000).catch((e) => { try { rt.cancel(); } catch { /* ignore */ } throw e; });
                  // Native JPEG (not mozjpeg): scan pages are already downsampled,
                  // and native is ~15x faster — 100+ page books finish fast.
                  const jpgBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q01));
                  if (jpgBlob) renderedPages.set(idx, { jpg: new Uint8Array(await jpgBlob.arrayBuffer()), w: vp1.width, h: vp1.height });
                }
                canvas.width = 0; canvas.height = 0;
                jp.cleanup(); // drop the worker's decoded-image cache as we go
              } catch { /* this page falls back to an untouched copy in phase 2 */ }
              progressed++;
              setProgress({ done: Math.min(progressed, pageCount), total: pageCount });
              await yieldToLoop(); // not throttled in background tabs
            }
          };
          await Promise.all(jsDocs.map((d) => drain(d)));

          // Phase 2 — assemble in page order: rasterized pages get their JPEG,
          // everything else (incl. any render failure) is copied untouched.
          for (let i = 0; i < pageCount; i++) {
            const r = renderedPages.get(i);
            let placed = false;
            if (r) {
              try {
                const img = await outDoc.embedJpg(r.jpg);
                const p = outDoc.addPage([r.w, r.h]);
                p.drawImage(img, { x: 0, y: 0, width: r.w, height: r.h });
                rasterized++; placed = true;
              } catch { /* fall through and copy the page untouched */ }
              renderedPages.delete(i); // free buffered bytes as we go
            }
            if (!placed) {
              try { const [cp] = await outDoc.copyPages(doc, [i]); outDoc.addPage(cp); copied++; } catch { /* unrenderable page — skip */ }
              progressed++;
              setProgress({ done: Math.min(progressed, pageCount), total: pageCount });
            }
            if (i % 8 === 7) await yieldToLoop();
          }
          // The rebuilt document gets pdf-lib's own default Info — clean it too.
          try { await stripDocMetadata(outDoc); } catch { /* best-effort */ }
          outBytes = await outDoc.save({ useObjectStreams: true });
        } finally {
          for (const t of tasks) { try { void t.destroy(); } catch { /* ignore */ } }
        }
      } catch {
        outBytes = await doc.save({ useObjectStreams: true }); // surgical-only fallback
      }

      const after = outBytes.length;
      const name = `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`;
      const secs = (performance.now() - startedAt) / 1000;
      const took = formatDuration(secs);
      const savedFrac = before > 0 ? 1 - after / before : 0;

      // "Already optimized" only when we genuinely couldn't shrink it (<1%).
      // Otherwise show the real saving — even a smaller file from restructuring
      // alone (object streams) is a real win we should NOT hide.
      if (savedFrac < 0.01) {
        const blob = new Blob([part(original)], { type: 'application/pdf' });
        const note = (rasterized === 0 && recompressed === 0 && fontsSlimmed === 0 ? 'Nothing left to shrink' : 'Already near-optimal') + ` · ${took}`;
        setDone({ blob, name: `${file.name.replace(/\.pdf$/i, '')}.pdf`, before, after: before, optimized: true, note });
        return;
      }

      const note = [
        rasterized > 0 ? `${rasterized} scanned page${rasterized === 1 ? '' : 's'} rebuilt` : '',
        recompressed > 0 ? `${recompressed} image${recompressed === 1 ? '' : 's'} recompressed` : '',
        fontsSlimmed > 0 ? `${fontsSlimmed} font${fontsSlimmed === 1 ? '' : 's'} slimmed` : '',
        metaRemoved > 0 ? 'metadata cleaned' : '',
        rasterized === 0 && recompressed === 0 && fontsSlimmed === 0 && metaRemoved === 0 ? 'Repacked smaller — text untouched' : '',
      ].filter(Boolean).join(' · ') + ` · ${took}`;
      // "Squeeze harder" must never hand back a BIGGER file than the last result.
      if (prevDone && after >= prevDone.after) {
        setDone({ ...prevDone, note: `Already at the smallest — that setting couldn’t beat ${fmtBytes(prevDone.after)}.` });
        return;
      }
      const blob = new Blob([part(outBytes)], { type: 'application/pdf' });
      setDone({ blob, name, before, after, optimized: false, note });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // cancelled — quiet
      setError(e instanceof Error ? e.message : 'Could not compress the PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
      setPrep(null);
      if (prepTimerRef.current) { clearTimeout(prepTimerRef.current); prepTimerRef.current = null; }
      setPrepReady(false);
    }
  }

  const saved = done && done.before > done.after ? Math.round(100 * (1 - done.after / done.before)) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        {/* Always mounted so the file picker works from the dropzone AND the size-limit notice. */}
        {/* value reset: browsers only fire change when the selection differs, so
            re-picking the same file after "Compress another" would do nothing */}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        {file && <BigFileHint bytes={file.size} threshold={400 * 1024 * 1024} />}
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
            <p className="text-xs text-muted-foreground">Shrinks images, keeps text crisp and selectable</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
        ) : (
          <div>
            {/* Big preview of the selected page + multi-page thumbnail strip */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-center">
                {previewPage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewPage.url} alt={`Page ${selPage + 1} preview`} className="max-h-96 rounded-md border bg-white shadow-md sm:max-h-[26rem]" />
                ) : (
                  <div className="flex h-48 w-36 items-center justify-center rounded-md border bg-white"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                )}
              </div>
              <PageStrip handle={srcHandle} count={pageCount} selected={selPage} onSelect={setSelPage} className="mt-3" />
            </div>
            {/* File chip */}
            <div className="mt-3 flex items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)}{kind ? ` · ${kind === 'scan' ? 'scanned document' : kind === 'image' ? 'image-heavy' : 'mostly text'}` : ''}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
            </div>
          </div>
        )}

        {file && !done && kind && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /> {KIND_MSG[kind]}
          </p>
        )}

        {file && !done && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Compression level</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {(Object.keys(LEVELS) as Level[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setLevel(k)}
                  aria-pressed={level === k}
                  className={`rounded-xl border px-2 py-2.5 text-center transition-all ${level === k ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'}`}
                >
                  <span className="block text-sm font-semibold">{LEVELS[k].title}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">{LEVELS[k].sub}</span>
                </button>
              ))}
            </div>
            {level === 'maximum' ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600"><Coffee className="size-3.5 shrink-0" /> Maximum rebuilds every image-heavy page for the smallest size — on big files this can take a few minutes, so grab a coffee. ☕ (Best for scans/photos; won’t shrink text-only PDFs.)</p>
            ) : (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" /> Smart, DPI-aware — only images bigger than they’re shown get shrunk. Text stays sharp and selectable.</p>
            )}

            {/* Live quality preview (scans): page 1 exactly as this level will
                produce it — judge with your eyes BEFORE compressing. No fake
                size estimates, ever. */}
            {kind === 'scan' && (levelPreview || levelPreviewBusy) && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  Quality preview — “{LEVELS[level].title}”
                  {levelPreviewBusy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                </p>
                <BeforeAfter
                  before={previewPage}
                  after={levelPreview}
                  beforeLabel="Original"
                  afterLabel={LEVELS[level].title}
                  loading={!previewPage || !levelPreview}
                />
              </div>
            )}
          </div>
        )}

        {error && <UploadError error={error} />}

        {file && !done && (
          busy ? (
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" size="lg" disabled><Loader2 className="size-4 animate-spin" /> {prepReady && prep ? prep : progress && progress.total > 0 ? `Compressing ${progress.done}/${progress.total}…` : 'Compressing…'}</Button>
              <Button size="lg" variant="outline" onClick={cancelRun}><X className="size-4" /> Cancel</Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" size="lg" onClick={() => run()}>
              <Shrink className="size-4" /> Compress PDF
            </Button>
          )
        )}

        {done && (
          <div ref={doneRef} className="mt-2 scroll-mt-20">
            {/* Action-first dock — result + Download at the TOP, details fold below. */}
            <ResultDock
              savedPct={done.optimized ? undefined : saved}
              before={fmt(done.before)}
              after={fmt(done.after)}
              title={done.optimized ? 'Already well optimized' : 'Compressed — quality preserved'}
              note={done.note}
              onDownload={() => download(done.blob, done.name)}
              downloadLabel={done.optimized ? 'Download PDF' : 'Download compressed'}
              secondary={<Button variant="outline" size="sm" onClick={() => { setDone(null); setSelPage(0); }}><RefreshCw className="size-4" /> Try another level</Button>}
            />
            <div className="mt-3" />
            {done.optimized ? (
              <>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <p className="text-xs text-muted-foreground">About as small as it gets without hurting quality — you can still squeeze a bit more at lower quality.</p>
                  <Button variant="outline" size="sm" onClick={() => run(true, 'maximum')} disabled={busy}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> Squeezing…</> : <><Shrink className="size-4" /> Squeeze harder (slower)</>}
                  </Button>
                </div>
                <div className="mt-3 rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-center">
                    {previewPage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewPage.url} alt={`Page ${selPage + 1} preview`} className="max-h-96 rounded-md border bg-white shadow-md sm:max-h-[26rem]" />
                    ) : (
                      <div className="flex h-48 w-36 items-center justify-center rounded-md border bg-white"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                    )}
                  </div>
                  <PageStrip handle={srcHandle} count={pageCount} selected={selPage} onSelect={setSelPage} className="mt-3" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <BeforeAfter before={beforePage} after={afterPage} beforeLabel={fmt(done.before)} afterLabel={fmt(done.after)} loading={!beforePage || !afterPage} />
                </div>
                <PageStrip handle={srcHandle} count={pageCount} selected={selPage} onSelect={setSelPage} className="mt-3" />
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Type className="size-3.5 text-emerald-500" /> Text stays selectable</span>
                  <span className="flex items-center gap-1"><Eye className="size-3.5 text-emerald-500" /> No visible quality loss</span>
                  <span className="flex items-center gap-1"><Lock className="size-3.5 text-emerald-500" /> Never uploaded</span>
                </div>
              </>
            )}
            {/* Download + "Try another level" now live in the ResultDock at the top. */}
            <Button variant="outline" className="mt-4 w-full border-primary/40 font-medium text-primary shadow-sm hover:bg-primary/5" onClick={clear}>
              <Upload className="size-4" /> Start over with a new file
            </Button>
            <PdfDone blob={done.blob} name={done.name} currentHref="/compress-pdf" fromLabel="Compress PDF" hideBanner />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
