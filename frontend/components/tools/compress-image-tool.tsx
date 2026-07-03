'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileImage, X, Download, Loader2, Shrink, CheckCircle2, Type, Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { encodeJpeg } from '@/lib/mozjpeg';
import { downloadBlob as download } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { BigFileHint } from '@/components/app/big-file-hint';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { BeforeAfter } from '@/components/pdf/before-after';
import { SavingsRing } from '@/components/app/savings-ring';

// Compress Image — 100% on-device. Decode → optional downscale → re-encode with
// mozjpeg (same WASM encoder as PDF→JPG; graceful native-canvas fallback). Never
// returns a bigger file. Transparency flattens to white (JPEG has no alpha) —
// the UI says so up front for PNGs.

type Level = 'light' | 'recommended' | 'strong';
const LEVELS: Record<Level, { q: number; title: string; sub: string }> = {
  light: { q: 82, title: 'Light', sub: 'Best quality' },
  recommended: { q: 72, title: 'Recommended', sub: 'Best balance' },
  strong: { q: 55, title: 'Strong', sub: 'Smallest' },
};

type Resize = 'original' | '2560' | '1920' | '1280';
const RESIZES: Array<{ id: Resize; label: string; sub: string }> = [
  { id: 'original', label: 'Original size', sub: 'Keep dimensions' },
  { id: '2560', label: 'Max 2560 px', sub: '4K screens' },
  { id: '1920', label: 'Max 1920 px', sub: 'Full HD · web' },
  { id: '1280', label: 'Max 1280 px', sub: 'Email · chat' },
];

// Safety clamp (never-hang rule): gigantic photos are decoded but drawn at most
// at this long edge — a 100-megapixel canvas would OOM low-RAM phones.
const HARD_MAX_DIM = 8000;

const isImage = (f: File) => /image\/(jpeg|png|webp)/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function decode(f: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(f); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(f);
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

export function CompressImageTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [level, setLevel] = useState<Level>('recommended');
  const [resize, setResize] = useState<Resize>('original');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [srcDims, setSrcDims] = useState<{ w: number; h: number } | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; before: number; after: number; url: string; w: number; h: number; optimized: boolean; secs: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [done]);

  // Free object URLs on unmount.
  useEffect(() => () => {
    setSrcUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setDone((d) => { if (d) URL.revokeObjectURL(d.url); return null; });
  }, []);

  function loadOne(f?: File) {
    if (!f) return;
    if (!isImage(f)) { setError('Please choose a JPG, PNG, or WebP image.'); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setError(null);
    setTooBig(null);
    setDone((d) => { if (d) URL.revokeObjectURL(d.url); return null; });
    setSrcUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); });
    setSrcDims(null);
    setFile(f);
    // Read dimensions for the info line (best-effort).
    void decode(f).then((bmp) => {
      setSrcDims({ w: bmp.width, h: bmp.height });
      (bmp as ImageBitmap).close?.();
    }).catch(() => { /* info only */ });
  }
  function pick(files: FileList | null) { loadOne(files?.[0] ?? undefined); }

  function clear() {
    setFile(null);
    setTooBig(null);
    setError(null);
    setSrcDims(null);
    setSrcUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setDone((d) => { if (d) URL.revokeObjectURL(d.url); return null; });
  }

  async function run() {
    if (!file) { setError('Add an image first.'); return; }
    setBusy(true);
    setError(null);
    setDone((d) => { if (d) URL.revokeObjectURL(d.url); return null; });
    const t0 = performance.now();
    try {
      const bmp = await decode(file);
      const maxDim = Math.min(resize === 'original' ? HARD_MAX_DIM : parseInt(resize, 10), HARD_MAX_DIM);
      const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const cx = canvas.getContext('2d');
      if (!cx) throw new Error('Your browser blocked canvas access.');
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
      cx.fillStyle = '#ffffff'; // JPEG has no alpha — flatten transparency to white
      cx.fillRect(0, 0, w, h);
      cx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
      (bmp as ImageBitmap).close?.();

      let blob: Blob;
      try {
        blob = await encodeJpeg(cx.getImageData(0, 0, w, h), LEVELS[level].q);
      } catch {
        // mozjpeg unavailable in this browser → native encoder, never a dead end.
        blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', LEVELS[level].q / 100));
      }
      canvas.width = 0; canvas.height = 0;

      // Never hand back a bigger file: if we couldn't beat the original (and the
      // user didn't ask for a resize), return the original untouched.
      if (blob.size >= file.size && scale === 1) {
        setDone({ blob: file, name: file.name, before: file.size, after: file.size, url: URL.createObjectURL(file), w, h, optimized: true, secs: (performance.now() - t0) / 1000 });
        return;
      }
      const name = `${file.name.replace(/\.(jpe?g|png|webp)$/i, '')}-compressed.jpg`;
      setDone({ blob, name, before: file.size, after: blob.size, url: URL.createObjectURL(blob), w, h, optimized: false, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compress the image.');
    } finally {
      setBusy(false);
    }
  }

  const saved = done && done.before > done.after ? Math.round(100 * (1 - done.after / done.before)) : 0;
  const isPng = !!file && (/image\/png/.test(file.type) || /\.png$/i.test(file.name));

  return (
    <>
      <Card>
        <CardContent className="p-5">
          {/* value reset: browsers only fire change when the selection differs */}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
          {file && <BigFileHint bytes={file.size} threshold={500 * 1024 * 1024} />}

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
              <p className="mt-2 text-sm font-medium">Drop a JPG, PNG, or WebP here, or click to choose</p>
              <p className="text-xs text-muted-foreground">Shrinks the file — your photo never leaves your browser</p>
            </div>
          ) : (
            <div>
              {/* Preview + file chip */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {srcUrl && <img src={srcUrl} alt="Your image" className="max-h-80 rounded-md border bg-white object-contain shadow-md" />}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-600 dark:bg-orange-950/40"><FileImage className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(file.size)}{srcDims ? ` · ${srcDims.w}×${srcDims.h}px` : ''}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
              </div>
              {isPng && !done && (
                <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  PNG in, JPG out — that’s where the big savings come from. Transparent areas become white.
                </p>
              )}
            </div>
          )}

          {file && !done && (
            <>
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Quality</p>
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
              </div>
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Dimensions</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  {RESIZES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setResize(r.id)}
                      aria-pressed={resize === r.id}
                      className={`rounded-xl border px-2 py-2.5 text-center transition-all ${resize === r.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'}`}
                    >
                      <span className="block text-sm font-semibold">{r.label}</span>
                      <span className="block text-[11px] leading-tight text-muted-foreground">{r.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          {file && !done && (
            <Button className="mt-5 w-full" size="lg" onClick={run} disabled={busy}>
              {busy ? <><Loader2 className="size-4 animate-spin" /> Compressing…</> : <><Shrink className="size-4" /> Compress image</>}
            </Button>
          )}

          {done && (
            <div ref={doneRef} className="mt-2 scroll-mt-20">
              {done.optimized ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
                  <p className="mt-1.5 text-sm font-semibold">Already well optimized</p>
                  <p className="text-xs text-muted-foreground">This image is about as small as it’ll get at this quality — your original ({fmt(done.before)}) is ready below. Try Strong, or a smaller size, to squeeze further.</p>
                </div>
              ) : (
                <>
                  <SavingsRing savedPct={saved} beforeLabel={fmt(done.before)} afterLabel={fmt(done.after)} note={`${done.w}×${done.h}px JPG · ${done.secs.toFixed(1)}s`} />
                  <div className="mt-4">
                    <BeforeAfter
                      before={srcUrl && srcDims ? { url: srcUrl, w: srcDims.w, h: srcDims.h } : null}
                      after={{ url: done.url, w: done.w, h: done.h }}
                      beforeLabel={fmt(done.before)}
                      afterLabel={fmt(done.after)}
                      loading={!srcUrl}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Type className="size-3.5 text-emerald-500" /> mozjpeg — pro-grade encoder</span>
                    <span className="flex items-center gap-1"><Eye className="size-3.5 text-emerald-500" /> Compare before you save</span>
                    <span className="flex items-center gap-1"><Lock className="size-3.5 text-emerald-500" /> Never uploaded</span>
                  </div>
                </>
              )}
              <Button className="mt-3 w-full" size="lg" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download {done.optimized ? 'image' : 'compressed image'}</Button>
              <Button variant="outline" className="mt-2 w-full" onClick={clear}>Compress another</Button>
            </div>
          )}
        </CardContent>
      </Card>
      {done && <div className="mt-8"><KeepGoing exclude="/compress-image" /></div>}
    </>
  );
}
