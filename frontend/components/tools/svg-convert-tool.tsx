'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Download, Loader2, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { convertSvg, readSvgSize, sanitizeSvg, type SvgFormat, type SvgResult } from '@/lib/svg-convert';

const PRESETS = [0.5, 1, 2, 4];

export function SvgConvertTool({ defaultFormat = 'png' }: { defaultFormat?: SvgFormat }) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState('');
  const [size, setSize] = useState<{ width: number; height: number; fromViewBox: boolean } | null>(null);
  const [format, setFormat] = useState<SvgFormat>(defaultFormat);
  const [width, setWidth] = useState(0);
  const [quality, setQuality] = useState(0.92);
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SvgResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!source) return null;
    return URL.createObjectURL(new Blob([sanitizeSvg(source)], { type: 'image/svg+xml;charset=utf-8' }));
  }, [source]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function load(f?: File) {
    if (!f) return;
    if (!/\.svg$/i.test(f.name) && !f.type.includes('svg')) { setError('Please choose an .svg file.'); return; }
    setError(null);
    setResult(null);
    const text = await f.text();
    const s = readSvgSize(text);
    if (!s) { setError('That file doesn’t look like an SVG — no <svg> tag with a size or viewBox in it.'); return; }
    setFile(f);
    setSource(text);
    setSize(s);
    setWidth(Math.round(s.width));
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await convertSvg(file, source, { format, width, quality, transparent });
      setResult(res);
      downloadBlob(res.blob, res.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert that SVG.');
    } finally {
      setBusy(false);
    }
  }

  function reset() { setFile(null); setSource(''); setSize(null); setResult(null); setError(null); }

  const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
  const height = size ? Math.round(width * (size.height / size.width)) : 0;

  if (!file || !size) {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void load(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop an SVG</span>
          <span className="mt-1 text-sm text-muted-foreground">
            {defaultFormat === 'pdf' ? 'out as a PDF sized to the drawing — on your device, never uploaded' : 'out as PNG, JPG or PDF at any size — on your device, never uploaded'}
          </span>
          <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose SVG</span>
        </button>
        <input ref={inputRef} type="file" accept=".svg,image/svg+xml" className="dd-file-input" onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}
        <PrivacyNote />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <ImageIcon className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file.name}>{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {Math.round(size.width)} × {Math.round(size.height)}{size.fromViewBox ? ' (from viewBox)' : ''}
          </span>
          <button onClick={reset} aria-label="Remove file" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
          <div
            className="flex min-h-[200px] items-center justify-center rounded-xl border p-4"
            style={transparent && format === 'png'
              ? { backgroundImage: 'linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%),linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px' }
              : { background: '#fff' }}
          >
            {previewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl} alt="Your SVG" className="max-h-[260px] max-w-full object-contain" />
            )}
          </div>

          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Output</span>
              <div className="inline-flex overflow-hidden rounded-lg border">
                {(['png', 'jpg', 'pdf'] as SvgFormat[]).map((f) => (
                  <button key={f} onClick={() => { setFormat(f); setResult(null); }}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase ${format === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {format === 'pdf' ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                The page takes the drawing’s own size — {Math.round(size.width)} × {Math.round(size.height)} points — so nothing is stretched onto A4.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Width in pixels</span>
                  <input type="number" min={1} max={8000} value={width}
                    onChange={(e) => { setResult(null); setWidth(Math.max(1, Math.min(8000, Number(e.target.value) || 1))); }}
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((m) => (
                    <button key={m} onClick={() => { setResult(null); setWidth(Math.round(size.width * m)); }}
                      className="rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                      {m}×
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Output: {width} × {height} px</p>
              </>
            )}

            {format === 'png' && (
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={transparent} onChange={(e) => { setResult(null); setTransparent(e.target.checked); }} className="size-4 accent-primary" />
                Transparent background
              </label>
            )}
            {format === 'jpg' && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Quality {Math.round(quality * 100)}%</span>
                <input type="range" min={40} max={100} value={Math.round(quality * 100)}
                  onChange={(e) => { setResult(null); setQuality(Number(e.target.value) / 100); }} className="w-full accent-primary" />
                <span className="text-[11px] text-muted-foreground">JPG has no transparency — the background is filled white.</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          <span className="text-xs text-muted-foreground">Rendered by your own browser — nothing is uploaded.</span>
          <Button onClick={() => void run()} disabled={busy} className="ml-auto bg-primary text-primary-foreground">
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />}
            Download {format.toUpperCase()}
          </Button>
        </div>

        {error && <p className="border-t px-4 py-2.5 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="mx-4 mb-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
            <ImageIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm"><b>{result.name}</b> — {result.width} × {result.height} · {fmtBytes(result.blob.size)}</span>
            <button onClick={() => downloadBlob(result.blob, result.name)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              <Download className="size-4" /> Download again
            </button>
          </div>
        )}
      </div>

      <PrivacyNote />
      {result && <KeepGoing title="Do more, privately" />}
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Rendered on your device.</b> Your browser draws the SVG and encodes the image here — the file is never uploaded, and any script inside it is stripped before anything is drawn.</p>
    </div>
  );
}
