'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Stamp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';

// Watermark PDF — stamp text across every page, 100% in the browser (pdf-lib).
// Live preview: page 1 is re-stamped and re-rendered whenever a setting changes,
// so users see exactly what they'll get before touching Download.

type Position = 'diagonal' | 'center' | 'tiled';
type Tone = 'gray' | 'red' | 'blue' | 'black';
const TONES: Record<Tone, { rgb: [number, number, number]; label: string; chip: string }> = {
  gray: { rgb: [0.45, 0.45, 0.5], label: 'Gray', chip: '#9ca3af' },
  red: { rgb: [0.86, 0.15, 0.15], label: 'Red', chip: '#dc2626' },
  blue: { rgb: [0.15, 0.39, 0.92], label: 'Blue', chip: '#2563eb' },
  black: { rgb: [0.1, 0.1, 0.1], label: 'Black', chip: '#111827' },
};
type Size = 'small' | 'medium' | 'large';
const SIZES: Record<Size, { frac: number; label: string }> = {
  small: { frac: 0.07, label: 'Small' },
  medium: { frac: 0.11, label: 'Medium' },
  large: { frac: 0.16, label: 'Large' },
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Settings = { text: string; position: Position; tone: Tone; size: Size; opacity: number };

// Stamp every page (or just the first, for the live preview) and return the bytes.
async function stamp(src: File | Blob, s: Settings, firstPageOnly = false): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(new Uint8Array(await src.arrayBuffer()), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const [r, g, b] = TONES[s.tone].rgb;
  const color = rgb(r, g, b);
  const text = s.text.trim() || 'CONFIDENTIAL';
  const pages = firstPageOnly ? doc.getPages().slice(0, 1) : doc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(10, Math.min(width, height) * SIZES[s.size].frac);
    const tw = font.widthOfTextAtSize(text, fontSize);
    const th = font.heightAtSize(fontSize);
    if (s.position === 'tiled') {
      // Diagonal tiles across the page, generous spacing so content stays readable.
      const stepX = tw + fontSize * 3;
      const stepY = th + fontSize * 4;
      for (let y = -stepY; y < height + stepY; y += stepY) {
        for (let x = -stepX; x < width + stepX; x += stepX) {
          page.drawText(text, { x, y, size: fontSize, font, color, opacity: s.opacity, rotate: degrees(30) });
        }
      }
    } else {
      const rot = s.position === 'diagonal' ? 45 : 0;
      const rad = (rot * Math.PI) / 180;
      // Center the rotated baseline: offset from page center by half the text
      // vector, then drop by half the cap height.
      const cx = width / 2 - (tw / 2) * Math.cos(rad) + (th / 2) * Math.sin(rad) * 0.5;
      const cy = height / 2 - (tw / 2) * Math.sin(rad) - (th / 2) * Math.cos(rad) * 0.5;
      page.drawText(text, { x: cx, y: cy, size: fontSize, font, color, opacity: s.opacity, rotate: degrees(rot) });
    }
  }
  return doc.save();
}

export function WatermarkTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [settings, setSettings] = useState<Settings>({ text: 'CONFIDENTIAL', position: 'diagonal', tone: 'gray', size: 'medium', opacity: 0.18 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewHandle = useRef<PdfHandle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live preview: debounce, stamp page 1 only, render it. Best-effort — the
  // download path doesn't depend on it (pdf.js may be unavailable; pdf-lib isn't).
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setPreviewBusy(true);
    const t = setTimeout(async () => {
      try {
        const bytes = await stamp(file, settings, true);
        if (cancelled) return;
        const h = await openPdf(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
        if (cancelled) { void h.destroy(); return; }
        const p = await renderPage(h, 0, dprTarget(420, 2.2, 1400));
        if (!cancelled) setPreview(p);
        // Handle owns the blob URL cache — swap after the render resolves.
        if (previewHandle.current) void previewHandle.current.destroy();
        previewHandle.current = h;
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [file, settings]);

  useEffect(() => () => { if (previewHandle.current) void previewHandle.current.destroy(); }, []);

  function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setError(null);
    setTooBig(null);
    setDone(null);
    setPreview(null);
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
    setTooBig(null);
    setError(null);
    setDone(null);
    setHandoffNote(null);
    setPreview(null);
    if (previewHandle.current) { void previewHandle.current.destroy(); previewHandle.current = null; }
  }

  async function apply() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const out = await stamp(file, settings);
      const name = `${file.name.replace(/\.pdf$/i, '')}-watermarked.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not watermark the PDF.');
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setDone(null); setSettings((cur) => ({ ...cur, [k]: v })); };

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        {handoffNote && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
            <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
          </p>
        )}

        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Stamp text across every page — with a live preview</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
            {/* Live preview */}
            <div className="relative flex items-center justify-center rounded-xl border bg-muted/30 p-4">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="Watermark preview — page 1" className="max-h-[26rem] rounded-md border bg-white object-contain shadow-md" />
              ) : (
                <div className="flex h-64 w-44 items-center justify-center rounded-md border bg-white"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
              {previewBusy && preview && <span className="absolute right-3 top-3"><Loader2 className="size-4 animate-spin text-muted-foreground" /></span>}
            </div>

            {/* Controls */}
            <div className="min-w-0">
              <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={clear}><X className="size-4" /></Button>
              </div>

              <label className="mt-4 block text-sm font-medium" htmlFor="wm-text">Watermark text</label>
              <input
                id="wm-text"
                value={settings.text}
                onChange={(e) => set('text', e.target.value)}
                maxLength={60}
                placeholder="CONFIDENTIAL"
                className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />

              <p className="mt-4 text-sm font-medium">Position</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {([['diagonal', 'Diagonal'], ['center', 'Straight'], ['tiled', 'Tiled']] as Array<[Position, string]>).map(([id, label]) => (
                  <button key={id} onClick={() => set('position', id)} aria-pressed={settings.position === id}
                    className={`rounded-xl border px-2 py-2 text-center text-sm font-medium transition-all ${settings.position === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Color</p>
                  <div className="mt-1.5 flex gap-2">
                    {(Object.keys(TONES) as Tone[]).map((t) => (
                      <button key={t} onClick={() => set('tone', t)} aria-label={TONES[t].label} aria-pressed={settings.tone === t}
                        className={`size-7 rounded-full border-2 transition-all ${settings.tone === t ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                        style={{ backgroundColor: TONES[t].chip }} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Size</p>
                  <div className="mt-1.5 flex gap-2">
                    {(Object.keys(SIZES) as Size[]).map((s) => (
                      <button key={s} onClick={() => set('size', s)} aria-pressed={settings.size === s}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${settings.size === s ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                        {SIZES[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mt-4 block text-sm font-medium" htmlFor="wm-opacity">Opacity · {Math.round(settings.opacity * 100)}%</label>
              <input
                id="wm-opacity"
                type="range" min={5} max={60} step={1}
                value={Math.round(settings.opacity * 100)}
                onChange={(e) => set('opacity', Number(e.target.value) / 100)}
                className="dd-range mt-1.5 w-full"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Stamping…</> : <><Stamp className="size-4" /> Watermark & download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} currentHref="/watermark-pdf" fromLabel="Watermark PDF" />}
      </CardContent>
    </Card>
  );
}
