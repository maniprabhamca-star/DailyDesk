'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Zap, Shrink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PDFRawStream as RawStream } from 'pdf-lib';
import { encodeJpeg } from '@/lib/mozjpeg';
import { takeHandoff } from '@/lib/handoff';
import { PdfDone } from '@/components/app/pdf-done';

// Uint8Array from pdf-lib/file APIs can be typed as ArrayBufferLike-backed; wrap
// to a fresh ArrayBuffer-backed copy so it satisfies the strict BlobPart type.
function part(bytes: Uint8Array): BlobPart {
  return new Uint8Array(bytes);
}

type Level = 'light' | 'recommended' | 'strong';

// Each level = how far we downsample embedded images + the mozjpeg quality.
// Vector text/graphics are NEVER touched, so the document stays crisp + selectable.
const LEVELS: Record<Level, { maxDim: number; quality: number; title: string; sub: string }> = {
  light: { maxDim: 2200, quality: 82, title: 'Light', sub: 'Best quality' },
  recommended: { maxDim: 1600, quality: 74, title: 'Recommended', sub: 'Best balance' },
  strong: { maxDim: 1000, quality: 60, title: 'Strong', sub: 'Smallest size' },
};

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
      const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = await import('pdf-lib');
      const original = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(original, { ignoreEncryption: true });
      const ctx = doc.context;
      const { maxDim, quality } = LEVELS[level];

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
          const scale = Math.min(1, maxDim / Math.max(w, h));
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

      // Never hand back a bigger file — if we couldn't beat the original, keep it.
      if (after >= before) {
        const blob = new Blob([part(original)], { type: 'application/pdf' });
        download(blob, `${file.name.replace(/\.pdf$/i, '')}.pdf`);
        setDone({ blob, name: `${file.name.replace(/\.pdf$/i, '')}.pdf`, before, after: before, optimized: true });
        return;
      }

      const blob = new Blob([part(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, before, after, optimized: recompressed === 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compress the PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
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
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" /> Text and graphics stay sharp — only images are shrunk.</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> {progress && progress.total > 0 ? `Compressing image ${progress.done}/${progress.total}…` : 'Compressing…'}</> : <><Shrink className="size-4" /> Compress PDF</>}
          </Button>
        )}

        {done && (
          <div className="mt-2">
            {done.optimized ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
                <p className="mt-1.5 text-sm font-semibold">Already well optimized</p>
                <p className="text-xs text-muted-foreground">This PDF is about as small as it’ll get without hurting quality — we kept your original ({fmt(done.before)}).</p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">−{saved}%</p>
                <p className="mt-1 text-sm font-medium">{fmt(done.before)} → {fmt(done.after)}</p>
                <p className="text-xs text-muted-foreground">Text stayed crisp and selectable — only the images were shrunk.</p>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={clear}>Compress another</Button>
              <Button className="flex-1" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download again</Button>
            </div>
            <PdfDone blob={done.blob} name={done.name} currentHref="/compress-pdf" fromLabel="Compress PDF" hideBanner />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
