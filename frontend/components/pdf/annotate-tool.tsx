'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, Highlighter, Pen, Square, Type, Undo2, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

// Annotate PDF — highlight, draw, box and type on a live page preview, then
// flatten the markup onto the original pages with the shared place-image rewrite
// (a transparent full-page PNG per page). 100% on-device: the file and your
// notes never leave the browser. Coordinates are stored as page fractions so the
// on-screen canvas and the high-res export stay pixel-perfect at any size.

type Tool = 'highlight' | 'pen' | 'rect' | 'text';
type Pt = { x: number; y: number };
type Stroke = { kind: 'pen' | 'highlight'; color: string; w: number; pts: Pt[] };
type RectA = { kind: 'rect'; color: string; w: number; a: Pt; b: Pt };
type TextA = { kind: 'text'; color: string; size: number; at: Pt; text: string; font: string; bold: boolean; italic: boolean; underline: boolean };
type Anno = Stroke | RectA | TextA;

const COLORS = ['#facc15', '#ef4444', '#2563eb', '#16a34a', '#7c3aed', '#111827'];

// Text fonts. Web fonts are the same OFL files the watermark tool bundles
// (@font-face in globals.css); the rest are safe system stacks. Text is drawn
// to canvas, so faux bold/italic synthesise fine even where only a regular face
// is loaded — we still await document.fonts.load before rasterising.
const FONTS: { label: string; css: string }[] = [
  { label: 'Sans', css: 'system-ui, sans-serif' },
  { label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', css: 'ui-monospace, "Courier New", monospace' },
  { label: 'Open Sans', css: '"Open Sans", sans-serif' },
  { label: 'Roboto', css: 'Roboto, sans-serif' },
  { label: 'Lato', css: 'Lato, sans-serif' },
  { label: 'Merriweather', css: 'Merriweather, serif' },
  { label: 'Playfair', css: '"Playfair Display", serif' },
  { label: 'Oswald', css: 'Oswald, sans-serif' },
  { label: 'Bebas Neue', css: '"Bebas Neue", sans-serif' },
  { label: 'Comic Neue', css: '"Comic Neue", cursive' },
  { label: 'Pacifico', css: 'Pacifico, cursive' },
];
function fontSpec(fs: number, a: { font: string; bold: boolean; italic: boolean }) {
  return `${a.italic ? 'italic ' : ''}${a.bold ? '700' : '400'} ${fs}px ${a.font}`;
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Weight (1–10 UI) → width as a fraction of the page width, per tool.
function widthFrac(tool: Tool, weight: number) {
  if (tool === 'highlight') return weight * 0.006;
  return weight * 0.0012;
}
function fontFrac(weight: number) { return 0.016 + weight * 0.006; }

// Draw a list of annotations onto ctx sized W×H (used for both the live preview
// and the high-res export — same code, different canvas).
function paint(ctx: CanvasRenderingContext2D, W: number, H: number, list: Anno[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of list) {
    if (a.kind === 'rect') {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(2, a.w * W);
      // A soft shadow gives the outline edge definition on any background, so a
      // light colour (e.g. yellow) doesn't vanish on a white page.
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 2;
      const x = Math.min(a.a.x, a.b.x) * W, y = Math.min(a.a.y, a.b.y) * H;
      ctx.strokeRect(x, y, Math.abs(a.b.x - a.a.x) * W, Math.abs(a.b.y - a.a.y) * H);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else if (a.kind === 'text') {
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'top';
      const fs = Math.max(10, a.size * H);
      const x = a.at.x * W, y = a.at.y * H;
      ctx.font = fontSpec(fs, a);
      // Dark halo behind the glyphs so any colour (incl. yellow) stays legible.
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = Math.max(2, fs * 0.14);
      ctx.strokeText(a.text, x, y);
      ctx.fillStyle = a.color;
      ctx.fillText(a.text, x, y);
      if (a.underline) {
        const tw = ctx.measureText(a.text).width;
        const uy = y + fs * 1.04;
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1, fs * 0.06);
        ctx.beginPath(); ctx.moveTo(x, uy); ctx.lineTo(x + tw, uy); ctx.stroke();
      }
    } else {
      ctx.globalAlpha = a.kind === 'highlight' ? 0.38 : 1;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, a.w * W);
      ctx.beginPath();
      a.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
      if (a.pts.length === 1) ctx.lineTo(a.pts[0].x * W + 0.1, a.pts[0].y * H); // a dot
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function AnnotateTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [tool, setTool] = useState<Tool>('highlight');
  const [color, setColor] = useState(COLORS[0]);
  const [weight, setWeight] = useState(4);
  const [font, setFont] = useState(FONTS[0].css);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [annos, setAnnos] = useState<Record<number, Anno[]>>({});
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [brandName, setBrandName] = useState(false); // opt-in "-diemdesk" filename suffix

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const live = useRef<Stroke | RectA | null>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true); setAnnos({}); setPreview(null);
    try {
      const h = await openPdf(f);
      if (handle) void handle.destroy();
      setHandle(h); setPageCount(h.numPages); setSel(0); setFile(f);
    } catch {
      setError('Could not read that PDF. It may be corrupted or password-protected.');
    } finally { setBusy(false); }
  }
  function pick(files: FileList | null) { void loadOne(files?.[0]); }

  useEffect(() => {
    const h = takeHandoff();
    const pdf = h?.files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (h && pdf) { setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`); void loadOne(pdf); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (handle) void handle.destroy(); }, [handle]);

  // Render the current page for the annotation surface. We intentionally DON'T
  // clear the old preview here — keeping the previous page on screen until the
  // new one is ready stops the surface from collapsing to a spinner and back
  // on every page change (the "flicker/dance"). A fresh file clears preview in
  // loadOne, so the first page still shows a clean loading state.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    void renderPage(handle, sel, dprTarget(560, 2.2, 1700)).then((p) => { if (!cancelled) setPreview(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [handle, sel]);

  // Size the overlay canvas to match the displayed page and repaint.
  const repaint = useCallback(() => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) {
      c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr);
    }
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const list = [...(annos[sel] || [])];
    if (live.current) list.push(live.current);
    paint(ctx, c.width, c.height, list);
  }, [annos, sel]);

  useEffect(() => { repaint(); }, [repaint, preview]);
  useEffect(() => {
    const onResize = () => repaint();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [repaint]);

  // Ctrl/Cmd+Z removes the last annotation on the current page (ignored while
  // typing in the text field or any other input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!file) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, sel]);

  // When the text draft opens, focus its input on the NEXT frame. Focusing
  // during the same click that opened it (autoFocus) let the click steal focus
  // straight back, firing onBlur and closing the empty draft instantly — which
  // looked like "clicking does nothing". Deferring past the click fixes it.
  useEffect(() => {
    if (!textDraft) return;
    const id = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textDraft !== null]);

  // Preload the chosen font (canvas can't paint a web font until it's loaded)
  // and repaint so the live text matches the exported result.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let stale = false;
    document.fonts.load(fontSpec(24, { font, bold, italic })).then(() => { if (!stale) repaint(); }).catch(() => {});
    return () => { stale = true; };
  }, [font, bold, italic, repaint]);

  function frac(e: React.PointerEvent): Pt {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!preview) return;
    const p = frac(e);
    if (tool === 'text') {
      const hit = findTextAt(p);
      if (hit >= 0) {
        // Re-open an existing text to edit/finish it, restoring its style.
        const t = (annos[sel] || [])[hit] as TextA;
        setAnnos((a) => ({ ...a, [sel]: (a[sel] || []).filter((_, i) => i !== hit) }));
        setColor(t.color); setFont(t.font); setBold(t.bold); setItalic(t.italic); setUnderline(t.underline);
        setWeight(Math.min(10, Math.max(1, Math.round((t.size - 0.016) / 0.006))));
        setTextDraft({ x: t.at.x, y: t.at.y, value: t.text });
      } else {
        setTextDraft({ x: p.x, y: p.y, value: '' });
      }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    if (tool === 'rect') live.current = { kind: 'rect', color, w: widthFrac('pen', weight), a: p, b: p };
    else live.current = { kind: tool, color, w: widthFrac(tool, weight), pts: [p] };
    repaint();
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !live.current) return;
    const p = frac(e);
    if (live.current.kind === 'rect') live.current.b = p;
    else live.current.pts.push(p);
    repaint();
  }
  function onUp() {
    if (!drawing.current || !live.current) { drawing.current = false; return; }
    const committed = live.current;
    live.current = null; drawing.current = false;
    // A box needs a real drag — ignore an accidental click (a 0-size box would
    // be invisible and look like "nothing happened"). Pen/highlight taps are
    // kept (they render as a dot).
    if (committed.kind === 'rect' && (Math.abs(committed.b.x - committed.a.x) < 0.006 || Math.abs(committed.b.y - committed.a.y) < 0.006)) { repaint(); return; }
    setAnnos((a) => ({ ...a, [sel]: [...(a[sel] || []), committed] }));
  }

  function commitText() {
    if (textDraft && textDraft.value.trim()) {
      const t: TextA = { kind: 'text', color, size: fontFrac(weight), at: { x: textDraft.x, y: textDraft.y }, text: textDraft.value.trim(), font, bold, italic, underline };
      setAnnos((a) => ({ ...a, [sel]: [...(a[sel] || []), t] }));
    }
    setTextDraft(null);
  }

  // Approximate bounding box of a placed text, for click-to-edit hit testing.
  // size is a fraction of page HEIGHT; width is estimated from character count
  // and converted to a fraction of page WIDTH via the preview aspect ratio.
  function findTextAt(p: Pt): number {
    const list = annos[sel] || [];
    const aspect = preview ? preview.h / preview.w : 1.3;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (a.kind !== 'text') continue;
      const hFrac = a.size * 1.25;
      const wFrac = Math.max(0.03, a.text.length * a.size * 0.55 * aspect);
      if (p.x >= a.at.x - 0.01 && p.x <= a.at.x + wFrac && p.y >= a.at.y - 0.01 && p.y <= a.at.y + hFrac) return i;
    }
    return -1;
  }
  function undo() { setAnnos((a) => ({ ...a, [sel]: (a[sel] || []).slice(0, -1) })); }
  function clearPage() { setAnnos((a) => ({ ...a, [sel]: [] })); }

  const annotatedPages = Object.keys(annos).map(Number).filter((i) => (annos[i] || []).length > 0).sort((x, y) => x - y);

  async function apply() {
    if (!file || !handle || annotatedPages.length === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      // Make sure every custom font used is loaded before we rasterise a page,
      // otherwise the export could fall back to a default face.
      if (typeof document !== 'undefined' && document.fonts) {
        for (const idx of annotatedPages) for (const a of annos[idx]) if (a.kind === 'text') { try { await document.fonts.load(fontSpec(24, a)); } catch { /* ignore */ } }
      }
      let current: File | Blob = file;
      for (const idx of annotatedPages) {
        const rp = await renderPage(handle, idx, dprTarget(1000, 2, 2000));
        const cvs = document.createElement('canvas');
        cvs.width = rp.w; cvs.height = rp.h;
        const ctx = cvs.getContext('2d')!;
        paint(ctx, rp.w, rp.h, annos[idx]);
        const buf = await new Promise<ArrayBuffer>((res, rej) =>
          cvs.toBlob((b) => (b ? b.arrayBuffer().then(res) : rej(new Error('render failed'))), 'image/png'));
        const out = await rewritePdf(current, { type: 'place-image', opts: { pageNo: idx + 1, xFrac: 0, yFrac: 0, wFrac: 1, imageBytes: buf, isPng: true } });
        current = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      }
      const name = `${file.name.replace(/\.pdf$/i, '')}-annotated${brandName ? '-diemdesk' : ''}.pdf`;
      const blob: Blob = current;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the annotated PDF.');
    } finally { setBusy(false); }
  }

  const toolBtn = (id: Tool, icon: React.ReactNode, label: string) => (
    <button key={id} onClick={() => { setTool(id); setTextDraft(null); }} aria-pressed={tool === id}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium transition-all ${tool === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
      {icon} {label}
    </button>
  );

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
            <p className="text-xs text-muted-foreground">Highlight, draw and comment — the document never leaves your device</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setAnnos({}); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid grid-cols-4 gap-2">
                {toolBtn('highlight', <Highlighter className="size-4" />, 'Highlight')}
                {toolBtn('pen', <Pen className="size-4" />, 'Draw')}
                {toolBtn('rect', <Square className="size-4" />, 'Box')}
                {toolBtn('text', <Type className="size-4" />, 'Text')}
              </div>
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} aria-label={`colour ${c}`} aria-pressed={color === c}
                    className={`size-7 rounded-full border-2 ${color === c ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                Size
                <input type="range" min={1} max={10} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="dd-range w-24" />
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" title="Undo (Ctrl+Z)" onClick={undo} disabled={!(annos[sel] || []).length}><Undo2 className="size-4" /> Undo</Button>
                <Button size="sm" variant="outline" onClick={clearPage} disabled={!(annos[sel] || []).length}><Trash2 className="size-4" /> Clear page</Button>
              </div>
            </div>

            {/* Text options — font + bold/italic/underline (Text tool only) */}
            {tool === 'text' && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
                <span className="text-xs font-medium text-muted-foreground">Font</span>
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {FONTS.map((f) => <option key={f.label} value={f.css} style={{ fontFamily: f.css }}>{f.label}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  {([['B', bold, setBold, 'font-bold'], ['I', italic, setItalic, 'italic'], ['U', underline, setUnderline, 'underline']] as const).map(([lbl, on, set, cls]) => (
                    <button
                      key={lbl}
                      onClick={() => set((v) => !v)}
                      aria-pressed={on}
                      className={`size-8 rounded-lg border text-sm ${cls} transition-all ${on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-[11px] text-muted-foreground">Tip: click a placed text to edit it</span>
              </div>
            )}

            {/* Annotation surface */}
            <div className="mt-3 flex items-start justify-center rounded-xl border bg-muted/30 p-3">
              {preview ? (
                <div ref={wrapRef} className="relative inline-block leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={`Page ${sel + 1}`} className="max-h-[34rem] rounded border bg-white shadow-md" draggable={false} />
                  <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 h-full w-full touch-none ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                  />
                  {textDraft && (
                    <input
                      ref={textInputRef}
                      value={textDraft.value}
                      onChange={(e) => setTextDraft((d) => (d ? { ...d, value: e.target.value } : d))}
                      // Enter/Tab place the text and keep you on the page — preventDefault
                      // stops focus jumping to the Save button below.
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitText(); }
                        else if (e.key === 'Escape') { e.preventDefault(); setTextDraft(null); }
                      }}
                      onBlur={commitText}
                      onPointerDown={(e) => e.stopPropagation()}
                      placeholder="Type, then Enter"
                      className="absolute z-10 rounded border-2 border-primary bg-white/95 px-1.5 py-0.5 text-sm shadow-lg outline-none"
                      style={{ left: `${textDraft.x * 100}%`, top: `${textDraft.y * 100}%`, color, fontFamily: font, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', textDecoration: underline ? 'underline' : 'none' }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { setTextDraft(null); setSel(i); }} className="mt-2" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {annotatedPages.length ? `${annotatedPages.length} page${annotatedPages.length === 1 ? '' : 's'} marked up` : 'Pick a tool and mark up the page — everything stays on your device.'}
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={brandName} onChange={(e) => setBrandName(e.target.checked)} className="size-3.5 accent-primary" />
              Add &ldquo;-diemdesk&rdquo; to the file name
            </label>
            <Button className="mt-2 w-full" size="lg" onClick={apply} disabled={busy || annotatedPages.length === 0}>
              {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Highlighter className="size-4" /> Save annotated PDF</>}
            </Button>
          </>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/annotate-pdf" fromLabel="Annotate PDF" />}
      </CardContent>
    </Card>
  );
}
