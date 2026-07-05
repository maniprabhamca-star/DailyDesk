'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, X, Download, Loader2, Stamp, Zap, Type as TypeIcon, Image as ImageIcon, Bold, Italic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { takeHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { parseRanges } from '@/lib/page-ranges';
import { rewritePdf } from '@/lib/pdf-rewrite';
import type { StampCore, StampLayer } from '@/lib/pdf-stamp';
import { FAMILIES, loadFontBytes, type Family } from '@/lib/fonts';
import { FontSelect } from '@/components/app/font-select';

// Watermark PDF — text OR logo/image stamps, 100% in the browser (pdf-lib), with
// a LIVE first-page preview that updates as every setting changes. Feature set
// meets/exceeds iLovePDF: 9-position anchor grid + tiled mosaic, rotation, font
// family with bold/italic, color, size, opacity, page range, PNG logos with
// transparency preserved.

type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
type Position = Anchor | 'tiled';
type Tone = 'gray' | 'red' | 'blue' | 'black';
const TONES: Record<Tone, { rgb: [number, number, number]; label: string; chip: string }> = {
  gray: { rgb: [0.45, 0.45, 0.5], label: 'Gray', chip: '#9ca3af' },
  red: { rgb: [0.86, 0.15, 0.15], label: 'Red', chip: '#dc2626' },
  blue: { rgb: [0.15, 0.39, 0.92], label: 'Blue', chip: '#2563eb' },
  black: { rgb: [0.1, 0.1, 0.1], label: 'Black', chip: '#111827' },
};

const ROTATIONS = [0, 30, 45, 90] as const;

// pdf-lib's StandardFonts values, kept as plain strings so the apply path can
// name a built-in font for the worker without importing pdf-lib up front.
const STANDARD_NAMES: Partial<Record<Family, [string, string, string, string]>> = {
  helvetica: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
  times: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
  courier: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'],
};

type Settings = {
  mode: 'text' | 'image';
  text: string;
  family: Family;
  bold: boolean;
  italic: boolean;
  tone: Tone;
  sizeFrac: number; // text size as a fraction of the page's short edge
  opacity: number;
  position: Position;
  rotation: (typeof ROTATIONS)[number];
  layer: StampLayer; // 'under' = watermark behind the page content
  range: string; // '' = every page
  imageBytes: Uint8Array | null;
  imageIsPng: boolean;
  imageScale: number; // fraction of page width
};

// The geometry-relevant subset of Settings, shaped for lib/pdf-stamp.
function coreOf(s: Settings): StampCore {
  return {
    mode: s.mode, text: s.text, colorRgb: TONES[s.tone].rgb, sizeFrac: s.sizeFrac,
    opacity: s.opacity, position: s.position, rotation: s.rotation, imageScale: s.imageScale, layer: s.layer,
  };
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Stamp page 1 for the LIVE PREVIEW (main thread — fast, one page). The real
// apply runs the SAME shared geometry (lib/pdf-stamp) inside the pdf-rewrite
// worker, so what you preview is exactly what downloads.
async function stamp(src: File | Blob, s: Settings, firstPageOnly = false): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const { stampPages } = await import('@/lib/pdf-stamp');
  const doc = await PDFDocument.load(new Uint8Array(await src.arrayBuffer()), { ignoreEncryption: true });
  const count = doc.getPageCount();
  let pageNums: number[]; // 1-based
  if (firstPageOnly) pageNums = [1];
  else if (s.range.trim()) pageNums = parseRanges(s.range, count);
  else pageNums = Array.from({ length: count }, (_, i) => i + 1);

  let font = null;
  const custom = FAMILIES[s.family]?.files;
  if (custom) {
    try {
      const url = (s.bold && custom.bold) || (s.italic && custom.italic) || custom.regular;
      const bytes = await loadFontBytes(url);
      // Interop-safe: depending on the bundler, the fontkit instance is either
      // the module's default export or the module itself.
      const fkMod = (await import('@pdf-lib/fontkit')) as { default?: unknown };
      doc.registerFontkit((fkMod.default ?? fkMod) as Parameters<typeof doc.registerFontkit>[0]);
      font = await doc.embedFont(bytes, { subset: true });
    } catch {
      // font fetch/embed failed (offline, blocked) — never a dead end
      font = await doc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    const fontName = (STANDARD_NAMES[s.family] ?? STANDARD_NAMES.helvetica!)[(s.bold ? 1 : 0) + (s.italic ? 2 : 0)];
    font = await doc.embedFont(fontName);
  }
  const image = s.mode === 'image' && s.imageBytes
    ? (s.imageIsPng ? await doc.embedPng(s.imageBytes) : await doc.embedJpg(s.imageBytes))
    : null;
  if (s.mode === 'image' && !image) throw new Error('Add a logo image first.');

  stampPages(doc, pageNums, coreOf(s), s.mode === 'text' ? font : null, image);
  return doc.save();
}

const POSITION_LABELS: Record<Anchor, string> = {
  tl: 'Top left', tc: 'Top center', tr: 'Top right',
  ml: 'Middle left', mc: 'Center', mr: 'Middle right',
  bl: 'Bottom left', bc: 'Bottom center', br: 'Bottom right',
};
const ANCHORS: Anchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

export function WatermarkTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [settings, setSettings] = useState<Settings>({
    mode: 'text', text: 'CONFIDENTIAL', family: 'helvetica', bold: true, italic: false,
    tone: 'gray', sizeFrac: 0.11, opacity: 0.18, position: 'mc', rotation: 45, layer: 'over', range: '',
    imageBytes: null, imageIsPng: true, imageScale: 0.35,
  });
  const [imageName, setImageName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewHandle = useRef<PdfHandle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Live preview: debounce, stamp page 1 only, render it. Best-effort — the
  // download path doesn't depend on it.
  useEffect(() => {
    if (!file) return;
    if (settings.mode === 'image' && !settings.imageBytes) return;
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

  function pickLogo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const isPng = /image\/png/.test(f.type) || /\.png$/i.test(f.name);
    const isJpg = /image\/jpeg/.test(f.type) || /\.jpe?g$/i.test(f.name);
    if (!isPng && !isJpg) { setError('Logo must be a PNG or JPG image.'); return; }
    setError(null);
    void f.arrayBuffer().then((buf) => {
      setImageName(f.name);
      set('imageBytes', new Uint8Array(buf));
      set('imageIsPng', isPng);
    });
  }

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
    if (settings.mode === 'image' && !settings.imageBytes) { setError('Add a logo image first.'); return; }
    setBusy(true);
    setError(null);
    setDone(null);
    const t0 = performance.now();
    try {
      if (settings.range.trim()) parseRanges(settings.range, 1e9); // early syntax check w/ big cap
      const s = settings;
      // Resolve the font on the main thread (cached fetch), then hand pdf-lib
      // the whole job in the rewrite WORKER — stamping a huge file no longer
      // freezes the tab. Buffers passed as fresh copies (they get transferred).
      let fontBytes: ArrayBuffer | undefined;
      let standardFont: string | undefined;
      if (s.mode === 'text') {
        const custom = FAMILIES[s.family]?.files;
        if (custom) {
          try {
            const url = (s.bold && custom.bold) || (s.italic && custom.italic) || custom.regular;
            fontBytes = (await loadFontBytes(url)).slice().buffer;
          } catch {
            standardFont = 'Helvetica'; // fetch failed — never a dead end
          }
        } else {
          standardFont = (STANDARD_NAMES[s.family] ?? STANDARD_NAMES.helvetica!)[(s.bold ? 1 : 0) + (s.italic ? 2 : 0)];
        }
      }
      const out = await rewritePdf(file, {
        type: 'watermark',
        opts: {
          ...coreOf(s), range: s.range, fontBytes, standardFont,
          imageBytes: s.imageBytes ? s.imageBytes.slice().buffer : undefined,
          imageIsPng: s.imageIsPng,
        },
      });
      const name = `${file.name.replace(/\.pdf$/i, '')}-watermarked.pdf`;
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not watermark the PDF.');
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof Settings>(k: K, v: Settings[K]) { setDone(null); setSettings((cur) => ({ ...cur, [k]: v })); }

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { pickLogo(e.target.files); e.currentTarget.value = ''; }} />
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
            <p className="text-xs text-muted-foreground">Text or logo watermark — with a live preview</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
            {/* Live preview */}
            <div className="relative flex items-center justify-center rounded-xl border bg-muted/30 p-4">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="Watermark preview — page 1" className="max-h-[30rem] rounded-md border bg-white object-contain shadow-md" />
              ) : (
                <div className="flex h-64 w-44 items-center justify-center rounded-md border bg-white">
                  {settings.mode === 'image' && !settings.imageBytes
                    ? <p className="px-3 text-center text-xs text-muted-foreground">Add a logo to see the preview</p>
                    : <Loader2 className="size-5 animate-spin text-muted-foreground" />}
                </div>
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

              {/* Mode */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {([['text', 'Text', TypeIcon], ['image', 'Logo / image', ImageIcon]] as const).map(([m, label, Icon]) => (
                  <button key={m} onClick={() => set('mode', m)} aria-pressed={settings.mode === m}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium transition-all ${settings.mode === m ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>

              {settings.mode === 'text' ? (
                <>
                  <label className="mt-4 block text-sm font-medium" htmlFor="wm-text">Watermark text</label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="wm-text"
                      value={settings.text}
                      onChange={(e) => set('text', e.target.value)}
                      maxLength={60}
                      placeholder="CONFIDENTIAL"
                      className="w-full min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button onClick={() => set('bold', !settings.bold)} aria-pressed={settings.bold} aria-label="Bold"
                      disabled={!FAMILIES[settings.family].bold}
                      title={!FAMILIES[settings.family].bold ? `${FAMILIES[settings.family].label} has no bold style` : undefined}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${settings.bold ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}><Bold className="size-4" /></button>
                    <button onClick={() => set('italic', !settings.italic)} aria-pressed={settings.italic} aria-label="Italic"
                      disabled={!FAMILIES[settings.family].italic}
                      title={!FAMILIES[settings.family].italic ? `${FAMILIES[settings.family].label} has no italic style` : undefined}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${settings.italic ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}><Italic className="size-4" /></button>
                  </div>
                  <label className="mt-3 block text-sm font-medium">Font family</label>
                  <div className="mt-1.5">
                    <FontSelect
                      value={settings.family}
                      onChange={(f2) => {
                        set('family', f2);
                        if (!FAMILIES[f2].italic && settings.italic) set('italic', false);
                        if (!FAMILIES[f2].bold && settings.bold) set('bold', false);
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}><Upload className="size-4" /> {settings.imageBytes ? 'Change logo' : 'Choose logo (PNG or JPG)'}</Button>
                    {imageName && <span className="truncate text-xs text-muted-foreground">{imageName}</span>}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">PNG transparency is preserved.</p>
                  <label className="mt-3 block text-sm font-medium" htmlFor="wm-scale">Logo size · {Math.round(settings.imageScale * 100)}% of page width</label>
                  <input id="wm-scale" type="range" min={10} max={80} step={1} value={Math.round(settings.imageScale * 100)}
                    onChange={(e) => set('imageScale', Number(e.target.value) / 100)} className="dd-range mt-1.5 w-full" />
                </>
              )}

              {/* Position: 3×3 anchor grid + tiled */}
              <div className="mt-4 flex items-start gap-4">
                <div>
                  <p className="text-sm font-medium">Position</p>
                  <div className="mt-1.5 grid w-max grid-cols-3 gap-1 rounded-lg border bg-card p-1.5">
                    {ANCHORS.map((a) => (
                      <button key={a} onClick={() => set('position', a)} aria-label={POSITION_LABELS[a]} aria-pressed={settings.position === a}
                        className={`size-7 rounded-md border transition-all ${settings.position === a ? 'border-primary bg-primary' : 'border-border bg-muted/40 hover:border-primary/50'}`} />
                    ))}
                  </div>
                  <button onClick={() => set('position', 'tiled')} aria-pressed={settings.position === 'tiled'}
                    className={`mt-2 w-full rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${settings.position === 'tiled' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                    Tiled (mosaic)
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Layer</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {([['over', 'Over content'], ['under', 'Behind content']] as Array<[StampLayer, string]>).map(([l2, label]) => (
                      <button key={l2} onClick={() => set('layer', l2)} aria-pressed={settings.layer === l2}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${settings.layer === l2 ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Behind content keeps text and images fully readable — the watermark shows through the gaps.</p>

                  <p className="mt-3 text-sm font-medium">Rotation</p>
                  <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                    {ROTATIONS.map((r2) => (
                      <button key={r2} onClick={() => set('rotation', r2)} aria-pressed={settings.rotation === r2}
                        className={`rounded-lg border px-1 py-1.5 text-xs font-medium transition-all ${settings.rotation === r2 ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
                        {r2}°
                      </button>
                    ))}
                  </div>
                  {settings.mode === 'text' && (
                    <>
                      <p className="mt-3 text-sm font-medium">Color</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {(Object.keys(TONES) as Tone[]).map((t2) => (
                          <button key={t2} onClick={() => set('tone', t2)} aria-label={TONES[t2].label} aria-pressed={settings.tone === t2}
                            className={`size-6 rounded-full border-2 transition-all ${settings.tone === t2 ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                            style={{ backgroundColor: TONES[t2].chip }} />
                        ))}
                      </div>
                      <label className="mt-3 block text-sm font-medium" htmlFor="wm-size">Text size · {Math.round(settings.sizeFrac * 100)}</label>
                      <input id="wm-size" type="range" min={4} max={30} step={1} value={Math.round(settings.sizeFrac * 100)}
                        onChange={(e) => set('sizeFrac', Number(e.target.value) / 100)} className="dd-range mt-1.5 w-full" />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
                <div>
                  <label className="block text-sm font-medium" htmlFor="wm-opacity">Opacity · {Math.round(settings.opacity * 100)}%</label>
                  <input id="wm-opacity" type="range" min={5} max={100} step={1} value={Math.round(settings.opacity * 100)}
                    onChange={(e) => set('opacity', Number(e.target.value) / 100)} className="dd-range mt-1.5 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium" htmlFor="wm-range">Pages</label>
                  <input id="wm-range" value={settings.range} onChange={(e) => set('range', e.target.value)} placeholder="All"
                    aria-label="Page range, e.g. 1-3, 5. Leave empty for all pages."
                    className="mt-1.5 w-28 rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Pages like “1-3, 7” — leave empty to stamp every page. Preview shows page 1.</p>
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && (
          <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={busy || (settings.mode === 'image' && !settings.imageBytes)}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Stamping…</> : <><Stamp className="size-4" /> Watermark & download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/watermark-pdf" fromLabel="Watermark PDF" />}
      </CardContent>
    </Card>
  );
}
