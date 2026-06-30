'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap, Shrink, CheckCircle2, Coffee, Sparkles, Type, Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PDFRawStream as RawStream } from 'pdf-lib';
import { encodeJpeg } from '@/lib/mozjpeg';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { ResultActions } from '@/components/app/result-actions';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { BeforeAfter } from '@/components/pdf/before-after';
import { SavingsRing } from '@/components/app/savings-ring';

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
const LEVELS: Record<Level, { dpi: number; maxDim: number; quality: number; rasterDpi: number; rasterQ: number; title: string; sub: string }> = {
  light: { dpi: 200, maxDim: 2400, quality: 82, rasterDpi: 130, rasterQ: 0.68, title: 'Light', sub: 'Best quality' },
  recommended: { dpi: 150, maxDim: 1800, quality: 74, rasterDpi: 100, rasterQ: 0.52, title: 'Recommended', sub: 'Best balance' },
  strong: { dpi: 110, maxDim: 1200, quality: 60, rasterDpi: 68, rasterQ: 0.4, title: 'Strong', sub: 'Smaller' },
  // "maximum" forces a full rebuild (rasterizes every image-heavy page) for the
  // last few MB — slower, so we tell the user to be patient.
  maximum: { dpi: 96, maxDim: 1000, quality: 52, rasterDpi: 60, rasterQ: 0.37, title: 'Maximum', sub: 'Squeeze harder' },
};
const MAX_RASTER = 4000; // clamp rasterized scan-page long edge (memory safety)

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

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Quick, honest classification of a PDF (no rendering) so we can set an honest
// expectation BEFORE compressing — instead of a misleading numeric estimate.
type Kind = 'scan' | 'image' | 'text';
async function classifyPdf(file: File): Promise<Kind | null> {
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
    if (pages.length > 0 && scanCount / pages.length >= 0.4) return 'scan';
    if (imageBytes / Math.max(1, file.size) >= 0.3) return 'image';
    return 'text';
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
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<Level>('recommended');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; before: number; after: number; optimized: boolean; note: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
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
    if (done && !done.optimized) {
      setBeforePage(null); setAfterPage(null);
      if (srcHandle) renderPage(srcHandle, selPage, long, ac.signal).then(setBeforePage).catch(() => {});
      if (outHandle) renderPage(outHandle, selPage, long, ac.signal).then(setAfterPage).catch(() => {});
    } else if (srcHandle) {
      setPreviewPage(null);
      renderPage(srcHandle, selPage, long, ac.signal).then(setPreviewPage).catch(() => {});
    }
    return () => ac.abort();
  }, [srcHandle, outHandle, selPage, done]);

  // Bring the result + Download button into view when compression finishes.
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [done]);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setDone(null);
    setKind(null);
    setPreviewPage(null);
    setSelPage(0);
    setPageCount(0);
    setFile(f);
    openSource(f);
    void classifyPdf(f).then(setKind);
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
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setProgress(null);
    setKind(null);
    setSelPage(0);
    setPageCount(0);
    setPreviewPage(null);
    setBeforePage(null);
    setAfterPage(null);
    setSrcHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setOutHandle((prev) => { if (prev) void prev.destroy(); return null; });
  }

  // Free pdf.js handles (and their cached page bitmaps) on unmount.
  useEffect(() => () => {
    setSrcHandle((prev) => { if (prev) void prev.destroy(); return null; });
    setOutHandle((prev) => { if (prev) void prev.destroy(); return null; });
  }, []);

  async function run(forceArg = false) {
    if (!file) { setError('Add a PDF first.'); return; }
    const force = forceArg || level === 'maximum';
    setBusy(true);
    setError(null);
    setDone(null);
    const before = file.size;
    const startedAt = performance.now();
    try {
      const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray } = await import('pdf-lib');
      const original = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(original, { ignoreEncryption: true });
      const ctx = doc.context;
      const { dpi, maxDim, quality, rasterDpi, rasterQ } = LEVELS[level];

      // DPI awareness (best-effort): read each image's on-page display size by
      // tracking the CTM through every page's content stream. Falls back to the
      // maxDim cap for any image we can't locate, so it's always safe.
      const displaySizes = new Map<string, number>(); // image ref tag -> max display long-edge (pt)
      const scanPages = new Set<number>(); // page indices that are "a big image" (a scan)
      const scanImageTags = new Set<string>(); // image tags on scan pages — skip in the surgical pass (they get rasterized anyway)
      try {
        const dec = new TextDecoder('latin1');
        const pages = doc.getPages();
        for (let pi = 0; pi < pages.length; pi++) {
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
            const pageLongIn = Math.max(width, height) / 72;
            const storedDpi = pageLongIn > 0 ? maxStoredPx / pageLongIn : 0;
            // A scanned page (one big image) is only worth rasterizing if its
            // image is clearly higher-res than the target — otherwise re-rendering
            // wastes minutes for almost nothing (an already-efficient file just
            // isn't compressible, exactly what Smallpdf/iLovePDF show: ~1%).
            // Normally only rasterize when the image is clearly higher-res than
            // target (worth the time). "Squeeze harder" (force) rasterizes any
            // big-image page, even for a small extra gain.
            if (width > 0 && height > 0 && maxArea >= 0.7 * width * height && (force || storedDpi >= rasterDpi * 1.5)) {
              scanPages.add(pi);
              nameToTag.forEach((tag) => scanImageTags.add(tag));
            }
          }
        }
      } catch { /* best-effort; surgical + safe fallbacks below still work */ }

      // Collect embedded JPEG images (safe to recompress). Everything else is left untouched.
      const isJpegImage = (obj: unknown): boolean => {
        if (!(obj instanceof PDFRawStream)) return false;
        const d = obj.dict;
        if (String(d.get(PDFName.of('Subtype'))) !== '/Image') return false;
        if (String(d.get(PDFName.of('Filter'))) !== '/DCTDecode') return false; // single JPEG filter only
        if (d.get(PDFName.of('ImageMask'))) return false;
        return true;
      };

      // Skip images that sit on scan pages — those pages get rasterized whole, so
      // recompressing their images first is wasted (slow) work.
      const images = ctx.enumerateIndirectObjects().filter(([ref, obj]) => isJpegImage(obj) && !scanImageTags.has((ref as unknown as { tag: string }).tag));
      setProgress({ done: 0, total: images.length });

      let recompressed = 0;
      for (let i = 0; i < images.length; i++) {
        const [ref, rawObj] = images[i];
        const obj = rawObj as RawStream;
        try {
          const d = obj.dict;
          const w = Number(d.get(PDFName.of('Width')));
          const h = Number(d.get(PDFName.of('Height')));
          const raw = obj.contents as Uint8Array;
          if (!w || !h || raw.length < 1024) continue; // tiny — not worth it

          // Fast skip: if the image is already at/below the target resolution it
          // won't shrink, so don't waste time decoding + re-encoding it. This is
          // what keeps already-efficient files fast (seconds, not minutes).
          const dispPt = displaySizes.get((ref as unknown as { tag: string }).tag);
          const longPx = Math.max(w, h);
          if (!force) {
            if (dispPt) { if (longPx <= (dispPt / 72) * dpi * 1.15) continue; }
            else if (longPx <= maxDim) continue;
          }

          const bmp = await decodeJpeg(raw);
          // DPI-aware target: shrink to what the image's on-page size needs at the
          // chosen DPI; fall back to the maxDim cap when its placement is unknown.
          const targetLong = dispPt ? Math.max(64, Math.ceil((dispPt / 72) * dpi)) : maxDim;
          const scale = Math.min(1, targetLong / Math.max(w, h));
          const nw = Math.max(1, Math.round(w * scale));
          const nh = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = nw; canvas.height = nh;
          const cx = canvas.getContext('2d');
          if (!cx) { (bmp as ImageBitmap).close?.(); continue; }
          cx.fillStyle = '#ffffff';
          cx.fillRect(0, 0, nw, nh);
          cx.drawImage(bmp as CanvasImageSource, 0, 0, nw, nh);
          (bmp as ImageBitmap).close?.();
          const imageData = cx.getImageData(0, 0, nw, nh);
          const outBlob = await encodeJpeg(imageData, quality);
          const outBytes = new Uint8Array(await outBlob.arrayBuffer());
          canvas.width = 0; canvas.height = 0;

          if (outBytes.length < raw.length) {
            const ns = PDFRawStream.of(d, outBytes);
            ns.dict.set(PDFName.of('Width'), PDFNumber.of(nw));
            ns.dict.set(PDFName.of('Height'), PDFNumber.of(nh));
            ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
            ns.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
            ns.dict.delete(PDFName.of('DecodeParms'));
            ns.dict.delete(PDFName.of('Decode'));
            ctx.assign(ref, ns);
            recompressed++;
          }
        } catch {
          // leave this image untouched on any error
        }
        setProgress({ done: i + 1, total: images.length });
        await new Promise((r) => setTimeout(r, 0)); // keep UI responsive
      }

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
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const task = pdfjs.getDocument({ data: original.slice() });
        const jsDoc = await task.promise;
        try {
          const pageCount = doc.getPageCount();
          const outDoc = await PDFDocument.create();
          setProgress({ done: 0, total: pageCount });
          const q01 = Math.max(0.32, Math.min(0.9, rasterQ));
          for (let i = 0; i < pageCount; i++) {
            let placed = false;
            try {
              // Only rasterize pages flagged worth it (a big, high-res image).
              // Everything else is copied untouched — so already-efficient files
              // finish in seconds instead of re-rendering every page for nothing.
              if (scanPages.has(i)) {
                const jp = await jsDoc.getPage(i + 1);
                const vp1 = jp.getViewport({ scale: 1 });
                let s = rasterDpi / 72;
                let vp = jp.getViewport({ scale: s });
                const longEdge = Math.max(vp.width, vp.height);
                if (longEdge > MAX_RASTER) { s = (s * MAX_RASTER) / longEdge; vp = jp.getViewport({ scale: s }); }
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
                const cx = canvas.getContext('2d');
                if (cx) {
                  cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
                  await jp.render({ canvasContext: cx, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
                  // Native JPEG (not mozjpeg): scan pages are already downsampled,
                  // and native is ~15x faster — 100+ page books finish in seconds.
                  const jpgBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q01));
                  canvas.width = 0; canvas.height = 0;
                  if (jpgBlob) {
                    const img = await outDoc.embedJpg(new Uint8Array(await jpgBlob.arrayBuffer()));
                    const p = outDoc.addPage([vp1.width, vp1.height]);
                    p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
                    rasterized++; placed = true;
                  }
                }
              }
            } catch { /* fall through and copy the page untouched */ }
            if (!placed) { try { const [cp] = await outDoc.copyPages(doc, [i]); outDoc.addPage(cp); copied++; } catch { /* unrenderable page — skip */ } }
            setProgress({ done: i + 1, total: pageCount });
            await new Promise((r) => setTimeout(r, 0));
          }
          outBytes = await outDoc.save({ useObjectStreams: true });
        } finally {
          try { await task.destroy(); } catch { /* ignore */ }
        }
      } catch {
        outBytes = await doc.save({ useObjectStreams: true }); // surgical-only fallback
      }

      const after = outBytes.length;
      const name = `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`;
      const secs = (performance.now() - startedAt) / 1000;
      const took = secs < 60 ? `${Math.round(secs)}s` : `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
      const savedFrac = before > 0 ? 1 - after / before : 0;

      // "Already optimized" only when we genuinely couldn't shrink it (<1%).
      // Otherwise show the real saving — even a smaller file from restructuring
      // alone (object streams) is a real win we should NOT hide.
      if (savedFrac < 0.01) {
        const blob = new Blob([part(original)], { type: 'application/pdf' });
        const note = (rasterized === 0 && recompressed === 0 ? 'No shrinkable images found' : 'Already near-optimal') + ` · ${took}`;
        setDone({ blob, name: `${file.name.replace(/\.pdf$/i, '')}.pdf`, before, after: before, optimized: true, note });
        return;
      }

      const note = [
        rasterized > 0 ? `${rasterized} scanned page${rasterized === 1 ? '' : 's'} rebuilt` : '',
        recompressed > 0 ? `${recompressed} image${recompressed === 1 ? '' : 's'} recompressed` : '',
        rasterized === 0 && recompressed === 0 ? 'Repacked smaller — text untouched' : '',
      ].filter(Boolean).join(' · ') + ` · ${took}`;
      const blob = new Blob([part(outBytes)], { type: 'application/pdf' });
      setDone({ blob, name, before, after, optimized: false, note });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compress the PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const saved = done && done.before > done.after ? Math.round(100 * (1 - done.after / done.before)) : 0;

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
            <p className="text-xs text-muted-foreground">Shrinks images, keeps text crisp and selectable</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files)} />
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
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={() => run()} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> {progress && progress.total > 0 ? `Compressing ${progress.done}/${progress.total}…` : 'Compressing…'}</> : <><Shrink className="size-4" /> Compress PDF</>}
          </Button>
        )}

        {done && (
          <div ref={doneRef} className="mt-2 scroll-mt-20">
            {done.optimized ? (
              <>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
                  <p className="mt-1.5 text-sm font-semibold">Already well optimized</p>
                  <p className="text-xs text-muted-foreground">This PDF is about as small as it’ll get without hurting quality — your original ({fmt(done.before)}) is ready below. You can still squeeze out a bit more at lower quality.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => run(true)} disabled={busy}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> Squeezing…</> : <><Shrink className="size-4" /> Squeeze harder (slower)</>}
                  </Button>
                </div>
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{done.note}</p>
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
                <SavingsRing savedPct={saved} beforeLabel={fmt(done.before)} afterLabel={fmt(done.after)} note={done.note} />
                <div className="mt-4">
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
            <Button className="mt-3 w-full" size="lg" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download {done.optimized ? 'PDF' : 'compressed PDF'}</Button>
            <ResultActions blob={done.blob} name={done.name} />
            <Button variant="outline" className="mt-2 w-full" onClick={clear}>Compress another</Button>
            <PdfDone blob={done.blob} name={done.name} currentHref="/compress-pdf" fromLabel="Compress PDF" hideBanner />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
