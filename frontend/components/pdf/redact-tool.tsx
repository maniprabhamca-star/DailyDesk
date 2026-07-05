'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, EyeOff, Undo2, Trash2, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';

// Redact PDF — box out sensitive content on a live page preview, then TRULY
// remove it: every redacted page is rebuilt as a flat image with the boxes
// burned in (so the underlying text is gone, not merely covered), pages you
// don't touch are copied through untouched, and the file's metadata is stripped.
// 100% on-device — the document is never uploaded.

type Pt = { x: number; y: number };
type Box = { a: Pt; b: Pt };
type Style = 'black' | 'white' | 'label';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Draw the redaction boxes onto ctx (W×H). Used for both the on-screen overlay
// (boxes only, over the page <img>) and the export (composited over the raster).
function drawBoxes(ctx: CanvasRenderingContext2D, W: number, H: number, list: Box[], style: Style) {
  for (const b of list) {
    const x = Math.min(b.a.x, b.b.x) * W, y = Math.min(b.a.y, b.b.y) * H;
    const w = Math.abs(b.b.x - b.a.x) * W, h = Math.abs(b.b.y - b.a.y) * H;
    if (w < 1 || h < 1) continue;
    ctx.globalAlpha = 1;
    ctx.fillStyle = style === 'white' ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, w, h);
    if (style === 'white') { ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    if (style === 'label') {
      const fs = Math.max(8, Math.min(h * 0.55, w / (8 * 0.62)));
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('REDACTED', x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
    }
  }
}

export function RedactTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [style, setStyle] = useState<Style>('black');
  const [boxes, setBoxes] = useState<Record<number, Box[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const live = useRef<Box | null>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true); setBoxes({});
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

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setPreview(null);
    void renderPage(handle, sel, dprTarget(560, 2.2, 1700)).then((p) => { if (!cancelled) setPreview(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [handle, sel]);

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
    const list = [...(boxes[sel] || [])];
    if (live.current) list.push(live.current);
    drawBoxes(ctx, c.width, c.height, list, style);
  }, [boxes, sel, style]);

  useEffect(() => { repaint(); }, [repaint, preview]);
  useEffect(() => {
    const onResize = () => repaint();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [repaint]);

  function frac(e: React.PointerEvent): Pt {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!preview) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = frac(e);
    live.current = { a: p, b: p };
    repaint();
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !live.current) return;
    live.current.b = frac(e);
    repaint();
  }
  function onUp() {
    if (!drawing.current || !live.current) { drawing.current = false; return; }
    const b = live.current;
    live.current = null; drawing.current = false;
    // ignore accidental taps (too small to be a real box)
    if (Math.abs(b.b.x - b.a.x) < 0.008 || Math.abs(b.b.y - b.a.y) < 0.008) { repaint(); return; }
    setBoxes((s) => ({ ...s, [sel]: [...(s[sel] || []), b] }));
  }

  function undo() { setBoxes((s) => ({ ...s, [sel]: (s[sel] || []).slice(0, -1) })); }
  function clearPage() { setBoxes((s) => ({ ...s, [sel]: [] })); }

  const redactedPages = Object.keys(boxes).map(Number).filter((i) => (boxes[i] || []).length > 0).sort((x, y) => x - y);
  const totalBoxes = redactedPages.reduce((n, i) => n + boxes[i].length, 0);

  async function apply() {
    if (!file || !handle || redactedPages.length === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      const { PDFDocument } = await import('pdf-lib');
      const src = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const redSet = new Set(redactedPages);
      const n = src.getPageCount();
      for (let i = 0; i < n; i++) {
        const srcPage = src.getPage(i);
        if (redSet.has(i)) {
          const rp = await renderPage(handle, i, dprTarget(1500, 2, 2600));
          const cvs = document.createElement('canvas');
          cvs.width = rp.w; cvs.height = rp.h;
          const ctx = cvs.getContext('2d')!;
          const img = new Image();
          img.src = rp.url;
          await img.decode();
          ctx.drawImage(img, 0, 0, rp.w, rp.h);
          drawBoxes(ctx, rp.w, rp.h, boxes[i], style);
          const png = await new Promise<ArrayBuffer>((res, rej) =>
            cvs.toBlob((b) => (b ? b.arrayBuffer().then(res) : rej(new Error('render failed'))), 'image/png'));
          cvs.width = 0; cvs.height = 0;
          const emb = await out.embedPng(png);
          const rot = srcPage.getRotation().angle % 360;
          const { width: w0, height: h0 } = srcPage.getSize();
          const [pw, ph] = rot === 90 || rot === 270 ? [h0, w0] : [w0, h0];
          const p = out.addPage([pw, ph]);
          p.drawImage(emb, { x: 0, y: 0, width: pw, height: ph });
        } else {
          const [copied] = await out.copyPages(src, [i]);
          out.addPage(copied);
        }
      }
      // Strip hidden info so it doesn't travel with the redacted file.
      out.setTitle(''); out.setAuthor(''); out.setSubject(''); out.setKeywords([]);
      out.setProducer('DiemDesk'); out.setCreator('DiemDesk');
      const bytes = await out.save();
      const name = `${file.name.replace(/\.pdf$/i, '')}-redacted.pdf`;
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redact the PDF.');
    } finally { setBusy(false); }
  }

  const styleBtn = (id: Style, label: string) => (
    <button key={id} onClick={() => setStyle(id)} aria-pressed={style === id}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${style === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'}`}>
      {label}
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
            <p className="text-xs text-muted-foreground">Black out sensitive content — permanently, on your device</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setBoxes({}); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Style</span>
                {styleBtn('black', 'Black')}
                {styleBtn('white', 'White')}
                {styleBtn('label', 'Labelled')}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={undo} disabled={!(boxes[sel] || []).length}><Undo2 className="size-4" /> Undo</Button>
                <Button size="sm" variant="outline" onClick={clearPage} disabled={!(boxes[sel] || []).length}><Trash2 className="size-4" /> Clear page</Button>
              </div>
            </div>

            <div className="mt-3 flex items-start justify-center rounded-xl border bg-muted/30 p-3">
              {preview ? (
                <div ref={wrapRef} className="relative inline-block leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={`Page ${sel + 1}`} className="max-h-[34rem] rounded border bg-white shadow-md" draggable={false} />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                  />
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={setSel} className="mt-2" />}
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              {totalBoxes ? `${totalBoxes} area${totalBoxes === 1 ? '' : 's'} on ${redactedPages.length} page${redactedPages.length === 1 ? '' : 's'} — content is permanently removed on export.` : 'Drag a box over anything sensitive. The content underneath is permanently removed — never just covered.'}
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-5 w-full" size="lg" onClick={apply} disabled={busy || redactedPages.length === 0}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Redacting…</> : <><EyeOff className="size-4" /> Redact &amp; download</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/redact-pdf" fromLabel="Redact PDF" />}
      </CardContent>
    </Card>
  );
}
