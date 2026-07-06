'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, Pencil, Undo2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { openPdf, renderPage, dprTarget, getPdfjs, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { FAMILIES, type Family } from '@/lib/fonts';

// Edit PDF — HYBRID in-place text editing (see docs/edit-pdf-approach.md).
// pdf.js detects each text run's exact box/size; clicking one lets you edit the
// words. On export we cover the original run with its sampled background colour
// and redraw the new text in a matched font/size/ink — the seamless overlay
// that looks native on normal documents. 100% on-device.

type Run = { id: string; text: string; x: number; y: number; w: number; h: number; size: number; family: Family; color: string; bg: string };

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function matchFamily(fontName?: string): Family {
  const n = (fontName || '').toLowerCase();
  if (/times|serif|roman|georgia|garamond|minion|book/.test(n)) return 'times';
  if (/courier|mono|consol/.test(n)) return 'courier';
  return 'helvetica';
}

// Paint the cover-and-redraw for one edited run onto ctx (W×H device px).
function paintEdit(ctx: CanvasRenderingContext2D, W: number, H: number, r: Run, text: string) {
  const x = r.x * W, y = r.y * H, w = r.w * W, h = r.h * H;
  // Cover the original with a small bleed so anti-aliased edges are hidden.
  const bleed = Math.max(1, h * 0.12);
  ctx.fillStyle = r.bg;
  ctx.fillRect(x - bleed, y - bleed, w + bleed * 2, h + bleed * 2);
  if (!text) return;
  const fs = r.size * H;
  ctx.fillStyle = r.color;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fs}px ${FAMILIES[r.family].css}`;
  // Baseline ≈ top + ascent; alphabetic baseline sits ~0.8 of the box down.
  ctx.fillText(text, x, y + h * 0.8);
}

export function EditTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [runs, setRuns] = useState<Record<number, Run[]>>({});
  const [edits, setEdits] = useState<Record<string, string>>({}); // runId → new text
  const [editing, setEditing] = useState<{ run: Run; value: string; caret: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true); setRuns({}); setEdits({}); setEditing(null); setPreview(null);
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

  // Render the page + detect its text runs (with sampled ink/background colours).
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setDetecting(true); setEditing(null);
    (async () => {
      const rp = await renderPage(handle, sel, dprTarget(560, 2.2, 1700));
      if (cancelled) return;
      setPreview(rp);
      if (runs[sel]) { setDetecting(false); return; }
      try {
        const pdfjs = await getPdfjs();
        const page = await handle.doc.getPage(sel + 1);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        // Sample colours from the rendered page bitmap.
        const img = new Image(); img.src = rp.url; await img.decode();
        const sc = document.createElement('canvas'); sc.width = rp.w; sc.height = rp.h;
        const sctx = sc.getContext('2d')!; sctx.drawImage(img, 0, 0, rp.w, rp.h);
        const px = sctx.getImageData(0, 0, rp.w, rp.h).data;
        const at = (cx: number, cy: number) => { const i = (Math.min(rp.h - 1, Math.max(0, cy)) * rp.w + Math.min(rp.w - 1, Math.max(0, cx))) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        const list: Run[] = [];
        // Sample ink (darkest) + background (just above) for a device-px x-range.
        const sample = (x0: number, x1: number, topPt: number, hPt: number) => {
          let dark = [0, 0, 0], best = 999;
          for (let k = 0; k <= 4; k++) { const cx = (x0 + (x1 - x0) * k / 4) / vp.width * rp.w; const cy = (topPt + hPt * 0.5) / vp.height * rp.h; const [r0, g0, b0] = at(cx, cy); const lum = r0 + g0 + b0; if (lum < best) { best = lum; dark = [r0, g0, b0]; } }
          const [br, bg2, bb] = at(((x0 + x1) / 2) / vp.width * rp.w, (topPt - hPt * 0.35) / vp.height * rp.h);
          return { color: `rgb(${dark[0]},${dark[1]},${dark[2]})`, bg: `rgb(${br},${bg2},${bb})` };
        };
        for (const it of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number; fontName?: string }>) {
          const s = it.str;
          if (!s || !s.trim() || !it.transform) continue;
          const m = pdfjs.Util.transform(vp.transform, it.transform);
          const fontH = Math.hypot(m[2], m[3]) || (it.height || 8);
          const w = (it.width || 0) * vp.scale;
          if (w < 2 || fontH < 4) continue;
          const left = m[4], top = m[5] - fontH;
          const family = matchFamily(it.fontName);
          // Split the line into WORDS so a click edits ONE word, not the whole
          // line. Per-word widths are measured with a matched font, then scaled
          // so the whole run matches the PDF's real width (approximate but tight).
          sctx.font = `100px ${FAMILIES[family].css}`;
          const parts = s.split(/(\s+)/);
          let measured = 0; const segs: { text: string; start: number; mw: number }[] = [];
          for (const part of parts) { const mw = sctx.measureText(part).width; segs.push({ text: part, start: measured, mw }); measured += mw; }
          const scl = measured > 0 ? w / measured : 0;
          for (const seg of segs) {
            if (!seg.text.trim()) continue;
            const wx = left + seg.start * scl, ww = seg.mw * scl;
            if (ww < 1) continue;
            const { color, bg } = sample(wx, wx + ww, top, fontH);
            list.push({ id: `${sel}-${list.length}`, text: seg.text, x: wx / vp.width, y: top / vp.height, w: ww / vp.width, h: fontH / vp.height, size: fontH / vp.height, family, color, bg });
          }
        }
        if (!cancelled) setRuns((prev) => ({ ...prev, [sel]: list }));
      } catch { /* image-only page → no runs */ }
      if (!cancelled) setDetecting(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, sel]);

  const pageRuns = runs[sel] || [];

  const repaint = useCallback(() => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    // Cover-and-redraw for every edited run on this page.
    for (const r of pageRuns) { const t = edits[r.id]; if (t !== undefined && t !== r.text) paintEdit(ctx, c.width, c.height, r, t); }
    // Hover highlight (skip the one being edited).
    if (hover && (!editing || editing.run.id !== hover)) {
      const r = pageRuns.find((x) => x.id === hover);
      if (r) { ctx.strokeStyle = 'rgba(99,102,241,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height); ctx.setLineDash([]); }
    }
  }, [pageRuns, edits, hover, editing]);

  useEffect(() => { repaint(); }, [repaint, preview]);

  function frac(e: React.PointerEvent | React.MouseEvent) {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function runAt(p: { x: number; y: number }): Run | null {
    for (let i = pageRuns.length - 1; i >= 0; i--) { const r = pageRuns[i]; if (p.x >= r.x - 0.004 && p.x <= r.x + r.w + 0.004 && p.y >= r.y - 0.004 && p.y <= r.y + r.h + 0.004) return r; }
    return null;
  }
  function onMove(e: React.MouseEvent) { const r = runAt(frac(e)); setHover(r?.id ?? null); if (canvasRef.current) canvasRef.current.style.cursor = r ? 'text' : 'default'; }
  function onClick(e: React.MouseEvent) {
    const p = frac(e);
    const r = runAt(p);
    if (!r) return;
    const val = edits[r.id] ?? r.text;
    // Drop the caret roughly where you clicked (not at the end of the line).
    const rel = r.w > 0 ? Math.min(1, Math.max(0, (p.x - r.x) / r.w)) : 0;
    setEditing({ run: r, value: val, caret: Math.round(rel * val.length) });
  }
  // Focus the edit input on the next frame and place the caret where you clicked.
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const el = editRef.current;
    const id = requestAnimationFrame(() => { try { el.focus(); el.setSelectionRange(editing.caret, editing.caret); } catch { /* ignore */ } });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.run.id]);
  function commitEdit() { if (editing) setEdits((s) => ({ ...s, [editing.run.id]: editing.value })); setEditing(null); }

  const editedIds = Object.keys(edits).filter((id) => { const r = pageRunsAll(runs, id); return r && edits[id] !== r.text; });
  const editedCount = editedIds.length;

  async function apply() {
    if (!file || !handle || editedCount === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      const pages = Array.from(new Set(editedIds.map((id) => Number(id.split('-')[0])))).sort((a, b) => a - b);
      let current: File | Blob = file;
      for (const idx of pages) {
        const rp = await renderPage(handle, idx, dprTarget(1200, 2, 2200));
        const cvs = document.createElement('canvas'); cvs.width = rp.w; cvs.height = rp.h;
        const ctx = cvs.getContext('2d')!;
        const img = new Image(); img.src = rp.url; await img.decode();
        ctx.drawImage(img, 0, 0, rp.w, rp.h);
        for (const r of (runs[idx] || [])) { const t = edits[r.id]; if (t !== undefined && t !== r.text) paintEdit(ctx, rp.w, rp.h, r, t); }
        const buf = await new Promise<ArrayBuffer>((res, rej) => cvs.toBlob((b) => (b ? b.arrayBuffer().then(res) : rej(new Error('render failed'))), 'image/png'));
        const out = await rewritePdf(current, { type: 'place-image', opts: { pageNo: idx + 1, xFrac: 0, yFrac: 0, wFrac: 1, imageBytes: buf, isPng: true } });
        current = new Blob([new Uint8Array(out)], { type: 'application/pdf' });
      }
      const name = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`;
      const blob: Blob = current;
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the edited PDF.');
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        {handoffNote && <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground"><Zap className="size-4 shrink-0 text-primary" /> {handoffNote}</p>}

        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Click any text to edit it — right in your browser, never uploaded</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p></div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setRuns({}); setEdits({}); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Pencil className="size-3.5 text-primary" /> Click any word to edit it. {detecting && <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> finding text…</span>}</p>

            <div className="flex items-start justify-center rounded-xl border bg-muted/30 p-3">
              {preview ? (
                <div ref={wrapRef} className="relative inline-block leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={`Page ${sel + 1}`} className="max-h-[34rem] max-w-full rounded border bg-white shadow-md" draggable={false} />
                  <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} />
                  {editing && (
                    <input
                      ref={editRef}
                      value={editing.value}
                      onChange={(e) => setEditing((d) => (d ? { ...d, value: e.target.value } : d))}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); else if (e.key === 'Escape') setEditing(null); }}
                      onBlur={commitEdit}
                      className="absolute z-10 rounded border-2 border-primary bg-white px-1 text-black shadow-lg outline-none"
                      style={{ left: `${editing.run.x * 100}%`, top: `${editing.run.y * 100}%`, height: `${editing.run.h * 100}%`, minWidth: `${Math.max(editing.run.w, 0.1) * 100}%`, fontSize: `${editing.run.size * (wrapRef.current?.getBoundingClientRect().height || 500)}px`, fontFamily: FAMILIES[editing.run.family].css }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { setEditing(null); setSel(i); }} className="mt-2" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {editedCount ? `${editedCount} edit${editedCount === 1 ? '' : 's'} made. Edits over photos or unusual fonts may show a patch (see how it works).` : 'Hover shows editable text. Not every PDF has selectable text — scanned pages can’t be edited.'}
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-4 w-full" size="lg" onClick={apply} disabled={busy || editedCount === 0}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Pencil className="size-4" /> Save edited PDF</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/edit-pdf" fromLabel="Edit PDF" />}
      </CardContent>
    </Card>
  );
}

// Find a run by id across all pages (for counting edits after page changes).
function pageRunsAll(runs: Record<number, Run[]>, id: string): Run | undefined {
  const p = Number(id.split('-')[0]);
  return (runs[p] || []).find((r) => r.id === id);
}
