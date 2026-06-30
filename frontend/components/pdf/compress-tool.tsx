'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap, Shrink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PDFRawStream as RawStream } from 'pdf-lib';
import { encodeJpeg } from '@/lib/mozjpeg';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';

// Uint8Array from pdf-lib/file APIs can be typed as ArrayBufferLike-backed; wrap
// to a fresh ArrayBuffer-backed copy so it satisfies the strict BlobPart type.
function part(bytes: Uint8Array): BlobPart {
  return new Uint8Array(bytes);
}

type Level = 'light' | 'recommended' | 'strong';

// DPI-aware: we read how big each image is actually displayed on the page and
// downsample it to the level's target DPI — so images shown small get shrunk
// hard (no visible loss) while images shown large stay sharp. `maxDim` is only
// a safe fallback cap for images whose on-page size we can't determine. Vector
// text/graphics are NEVER touched, so the document stays crisp + selectable.
const LEVELS: Record<Level, { dpi: number; maxDim: number; quality: number; title: string; sub: string }> = {
  light: { dpi: 200, maxDim: 2400, quality: 82, title: 'Light', sub: 'Best quality' },
  recommended: { dpi: 150, maxDim: 1800, quality: 74, title: 'Recommended', sub: 'Best balance' },
  strong: { dpi: 96, maxDim: 1200, quality: 60, title: 'Strong', sub: 'Smallest size' },
};

// ---- DPI awareness: find each image's on-page display size (in points) ------
// Track the CTM through a page's content stream and record the largest display
// size for every image XObject. Pure string scan — no extra libraries.
const NAME_START = /[A-Za-z'"*]/, NUM_START = /[-+.\d]/, NUM_CHAR = /[-+.\dEe]/, OP_CHAR = /[A-Za-z\d'"*]/, NAME_STOP = /[\s/<>[\]()%]/;

function concatMatrix(ctm: number[], m: number[]): number[] {
  const [A, B, C, D, E, F] = m, [a, b, c, d, e, f] = ctm;
  return [A * a + B * c, A * b + B * d, C * a + D * c, C * b + D * d, E * a + F * c + e, E * b + F * d + f];
}

function scanContent(content: string, nameToTag: Map<string, string>, sizes: Map<string, number>) {
  let i = 0; const n = content.length; let ctm = [1, 0, 0, 1, 0, 0]; const stack: number[][] = []; let ops: number[] = []; let lastName: string | null = null;
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
      else if (op === 'Do' && lastName) { const tag = nameToTag.get(lastName); if (tag) { const disp = Math.max(Math.hypot(ctm[0], ctm[1]), Math.hypot(ctm[2], ctm[3])); if (disp > (sizes.get(tag) || 0)) sizes.set(tag, disp); } }
      else if (op === 'BI') { const ei = content.indexOf('EI', i); i = ei < 0 ? n : ei + 2; }
      ops = []; continue;
    }
    i++;
  }
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
  const [done, setDone] = useState<{ blob: Blob; name: string; before: number; after: number; optimized: boolean } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

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
    setFile(f);
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
  }

  async function run() {
    if (!file) { setError('Add a PDF first.'); return; }
    setBusy(true);
    setError(null);
    setDone(null);
    const before = file.size;
    try {
      const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray } = await import('pdf-lib');
      const original = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(original, { ignoreEncryption: true });
      const ctx = doc.context;
      const { dpi, maxDim, quality } = LEVELS[level];

      // DPI awareness (best-effort): read each image's on-page display size by
      // tracking the CTM through every page's content stream. Falls back to the
      // maxDim cap for any image we can't locate, so it's always safe.
      const displaySizes = new Map<string, number>(); // image ref tag -> max display long-edge (pt)
      try {
        const dec = new TextDecoder('latin1');
        for (const page of doc.getPages()) {
          const res = page.node.Resources();
          const xobjs = res ? (res.lookup(PDFName.of('XObject')) as { keys?: () => unknown[]; get?: (k: unknown) => unknown } | undefined) : undefined;
          if (!xobjs || typeof xobjs.keys !== 'function') continue;
          const nameToTag = new Map<string, string>();
          for (const k of xobjs.keys()) {
            const r = xobjs.get!(k) as { tag?: string } | undefined;
            if (r && r.tag) nameToTag.set(String(k), r.tag);
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
          if (text) scanContent(text, nameToTag, displaySizes);
        }
      } catch { /* DPI awareness is best-effort; the maxDim cap below stays safe */ }

      // Collect embedded JPEG images (safe to recompress). Everything else is left untouched.
      const isJpegImage = (obj: unknown): boolean => {
        if (!(obj instanceof PDFRawStream)) return false;
        const d = obj.dict;
        if (String(d.get(PDFName.of('Subtype'))) !== '/Image') return false;
        if (String(d.get(PDFName.of('Filter'))) !== '/DCTDecode') return false; // single JPEG filter only
        if (d.get(PDFName.of('ImageMask'))) return false;
        return true;
      };

      const images = ctx.enumerateIndirectObjects().filter(([, obj]) => isJpegImage(obj));
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

          const bmp = await decodeJpeg(raw);
          // DPI-aware target: shrink to what the image's on-page size needs at the
          // chosen DPI; fall back to the maxDim cap when its placement is unknown.
          const dispPt = displaySizes.get((ref as unknown as { tag: string }).tag);
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

      const out = await doc.save({ useObjectStreams: true });
      const after = out.length;
      const name = `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`;

      // Don't auto-download: compression can take seconds, which expires the
      // click's "user gesture" and makes Chrome stall the download as a stuck
      // .crdownload. Instead we show the result and let the user click Download
      // (a fresh gesture the browser always honours).
      if (after >= before) {
        // Never hand back a bigger file — if we couldn't beat the original, keep it.
        const blob = new Blob([part(original)], { type: 'application/pdf' });
        setDone({ blob, name: `${file.name.replace(/\.pdf$/i, '')}.pdf`, before, after: before, optimized: true });
        return;
      }

      const blob = new Blob([part(out)], { type: 'application/pdf' });
      setDone({ blob, name, before, after, optimized: recompressed === 0 });
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
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Compression level</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" /> Smart, DPI-aware — only images bigger than they’re shown get shrunk. Text stays sharp and selectable.</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> {progress && progress.total > 0 ? `Compressing image ${progress.done}/${progress.total}…` : 'Compressing…'}</> : <><Shrink className="size-4" /> Compress PDF</>}
          </Button>
        )}

        {done && (
          <div ref={doneRef} className="mt-2 scroll-mt-20">
            {done.optimized ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
                <p className="mt-1.5 text-sm font-semibold">Already well optimized</p>
                <p className="text-xs text-muted-foreground">This PDF is about as small as it’ll get without hurting quality — your original ({fmt(done.before)}) is ready below.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">−{saved}%</p>
                <p className="mt-1 text-sm font-medium">{fmt(done.before)} → {fmt(done.after)}</p>
                <p className="text-xs text-muted-foreground">Text stayed crisp and selectable — only the images were shrunk.</p>
              </div>
            )}
            <Button className="mt-3 w-full" size="lg" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download {done.optimized ? 'PDF' : 'compressed PDF'}</Button>
            <Button variant="outline" className="mt-2 w-full" onClick={clear}>Compress another</Button>
            <PdfDone blob={done.blob} name={done.name} currentHref="/compress-pdf" fromLabel="Compress PDF" hideBanner />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
