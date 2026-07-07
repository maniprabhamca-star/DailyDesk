'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, Pencil, Undo2, Redo2, Bold, Italic, Trash2, Minus, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { openPdf, renderPage, dprTarget, getPdfjs, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { FontSelect } from '@/components/app/font-select';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { FAMILIES, type Family } from '@/lib/fonts';
import { applyLineEdits, lineFitScale, COVER_TOP, COVER_H, BASELINE, type LineEdit } from '@/lib/pdf-edit-text';
import { pageBackground, lineColors, type RGB } from '@/lib/pdf-sample';

// Edit PDF — HYBRID in-place text editing (see docs/edit-pdf-approach.md).
// pdf.js detects each LINE of text (box, size, colour) and splits it into words.
// Click a word to retype/reformat it; the whole line reflows live (trailing words
// shift, no overlap) because a PDF line is one unit. Edited lines render as crisp
// DOM text over an opaque cover of the original; on export they're re-encoded as
// REAL vector text, leaving every unedited line pixel-perfect. 100% on-device.

type Line = {
  id: string; page: number;
  x: number; y: number; w: number; h: number;           // line box (top-left fractions)
  family: Family; color: string; bg: string; bold: boolean; italic: boolean;
  parts: string[];                                        // words + whitespace, in order
  boxes: ({ x: number; y: number; w: number; h: number } | null)[]; // per-word hit box
};
type Edit = { text: string; family: Family; size: number; color: string; bold: boolean; italic: boolean };
type EditMap = Record<string, Edit>;

const SWATCHES = ['#111827', '#374151', '#dc2626', '#ea580c', '#ca8a04', '#059669', '#2563eb', '#7c3aed', '#ffffff'];
const key = (lineId: string, i: number) => `${lineId}#${i}`;

let measureCtx: CanvasRenderingContext2D | null = null;
function measureWidth(text: string, cssFont: string): number {
  if (typeof document === 'undefined') return 0;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = cssFont;
  return measureCtx.measureText(text).width;
}
function cssFont(family: Family, bold: boolean, italic: boolean, px: number): string {
  return `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${px}px ${FAMILIES[family].css}`;
}

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

function defaultEdit(line: Line, i: number): Edit {
  return { text: line.parts[i], family: line.family, size: line.h, color: line.color, bold: line.bold, italic: line.italic };
}
function editOf(line: Line, i: number, edits: EditMap): Edit {
  return edits[key(line.id, i)] ?? defaultEdit(line, i);
}
function partEdited(line: Line, i: number, e: Edit): boolean {
  return e.text !== line.parts[i] || e.family !== line.family || e.color !== line.color || e.bold !== line.bold || e.italic !== line.italic || Math.abs(e.size - line.h) > 1e-4;
}
function lineHasEdits(line: Line, edits: EditMap): boolean {
  return line.parts.some((p, i) => p.trim() && edits[key(line.id, i)] && partEdited(line, i, edits[key(line.id, i)]));
}

export function EditTool() {
  const plan = usePlan();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [lines, setLines] = useState<Record<number, Line[]>>({});
  const [edits, setEdits] = useState<EditMap>({});
  const [editing, setEditing] = useState<{ lineId: string; i: number } | null>(null);
  const [caret, setCaret] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const [past, setPast] = useState<EditMap[]>([]);
  const [future, setFuture] = useState<EditMap[]>([]);
  const sessionRef = useRef<EditMap | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true);
    setLines({}); setEdits({}); setEditing(null); setPreview(null); setPast([]); setFuture([]);
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

  // Keep `disp` (the displayed image size) EXACT at all times. A one-shot
  // measure on load reads clientHeight before layout settles (it comes back 0),
  // which used to leave the overlay misaligned until a resize — so we observe
  // the image and update on every size change.
  useEffect(() => {
    const im = imgRef.current; if (!im) return;
    const m = () => setDisp({ w: im.clientWidth, h: im.clientHeight });
    m();
    const ro = new ResizeObserver(m); ro.observe(im);
    window.addEventListener('resize', m);
    return () => { ro.disconnect(); window.removeEventListener('resize', m); };
  }, [preview]);

  // Render the page + detect its lines (with sampled ink/background colours).
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    setDetecting(true); setEditing(null);
    (async () => {
      const rp = await renderPage(handle, sel, dprTarget(620, 2.2, 1800));
      if (cancelled) return;
      setPreview(rp);
      if (lines[sel]) { setDetecting(false); return; }
      try {
        const pdfjs = await getPdfjs();
        const page = await handle.doc.getPage(sel + 1);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const img = new Image(); img.src = rp.url; await img.decode();
        const sc = document.createElement('canvas'); sc.width = rp.w; sc.height = rp.h;
        const sctx = sc.getContext('2d')!; sctx.drawImage(img, 0, 0, rp.w, rp.h);
        const px = sctx.getImageData(0, 0, rp.w, rp.h).data;
        const at = (cx: number, cy: number): RGB => { const i = (Math.min(rp.h - 1, Math.max(0, cy)) * rp.w + Math.min(rp.w - 1, Math.max(0, cx))) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        // Robust colours (lib/pdf-sample) — the cover background is the MODE of the
        // line's surrounding gaps with a page-colour fallback, so a single dark
        // pixel can never paint the whole line black.
        const pageBg = pageBackground(at, rp.w, rp.h);
        const sample = (x0: number, x1: number, topPt: number, hPt: number) => lineColors(at, vp.width, vp.height, rp.w, rp.h, x0, x1, topPt, hPt, pageBg);
        const list: Line[] = [];
        for (const it of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number; fontName?: string }>) {
          const s = it.str;
          if (!s || !s.trim() || !it.transform) continue;
          const m = pdfjs.Util.transform(vp.transform, it.transform);
          const fontH = Math.hypot(m[2], m[3]) || (it.height || 8);
          const w = (it.width || 0) * vp.scale;
          if (w < 2 || fontH < 4) continue;
          const left = m[4], top = m[5] - fontH * BASELINE;
          const family = matchFamily(it.fontName);
          const fn = (it.fontName || '').toLowerCase();
          const bold = /bold|black|heavy|semibold|w[6-9]00/.test(fn);
          const italic = /italic|oblique/.test(fn);
          const { color, bg } = sample(left, left + w, top, fontH);
          // Split into words + whitespace; measure per-word boxes for hit-testing.
          sctx.font = cssFont(family, bold, italic, 100);
          const parts = s.split(/(\s+)/).filter((p) => p !== '');
          let measured = 0; const off: number[] = [];
          const widths = parts.map((p) => { off.push(measured); const mw = sctx.measureText(p).width; measured += mw; return mw; });
          const scl = measured > 0 ? w / measured : 0;
          const boxes = parts.map((p, i) => p.trim() ? { x: (left + off[i] * scl) / vp.width, y: top / vp.height, w: (widths[i] * scl) / vp.width, h: fontH / vp.height } : null);
          list.push({ id: `${sel}-L${list.length}`, page: sel, x: left / vp.width, y: top / vp.height, w: w / vp.width, h: fontH / vp.height, family, color, bg, bold, italic, parts, boxes });
        }
        if (!cancelled) setLines((prev) => ({ ...prev, [sel]: list }));
      } catch { /* image-only page → no lines */ }
      if (!cancelled) setDetecting(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, sel]);

  const pageLines = lines[sel] || [];
  const activeLine = editing ? pageLines.find((l) => l.id === editing.lineId) ?? null : null;
  const activeEdit = activeLine && editing ? editOf(activeLine, editing.i, edits) : null;
  const famInfo = activeEdit ? FAMILIES[activeEdit.family] : null;

  function beginSession() { if (!sessionRef.current) sessionRef.current = edits; }
  function endSession(next: EditMap) {
    const snap = sessionRef.current; sessionRef.current = null;
    if (snap && JSON.stringify(snap) !== JSON.stringify(next)) { setPast((p) => [...p, snap]); setFuture([]); }
  }
  function patchActive(patch: Partial<Edit>) {
    if (!activeLine || !editing) return;
    beginSession();
    setEdits((s) => ({ ...s, [key(activeLine.id, editing.i)]: { ...editOf(activeLine, editing.i, s), ...patch } }));
  }
  function openWord(line: Line, i: number, clickFrac: number) {
    if (editing && (editing.lineId !== line.id || editing.i !== i)) endSession(edits);
    setEditing({ lineId: line.id, i });
    const e = editOf(line, i, edits);
    setCaret(Math.round(Math.min(1, Math.max(0, clickFrac)) * e.text.length));
  }
  function closeWord() { if (editing) { endSession(edits); setEditing(null); } }
  function deleteActive() { patchActive({ text: '' }); }

  function undo() {
    setPast((p) => { if (!p.length) return p; const prev = p[p.length - 1]; setFuture((f) => [edits, ...f]); setEdits(prev); setEditing(null); sessionRef.current = null; return p.slice(0, -1); });
  }
  function redo() {
    setFuture((f) => { if (!f.length) return f; const next = f[0]; setPast((p) => [...p, edits]); setEdits(next); setEditing(null); sessionRef.current = null; return f.slice(1); });
  }

  useEffect(() => {
    if (!editing || !editRef.current) return;
    const el = editRef.current;
    const id = requestAnimationFrame(() => { try { el.focus(); el.setSelectionRange(caret, caret); } catch { /* ignore */ } });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.lineId, editing?.i]);

  useEffect(() => {
    if (!file || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, done, edits, past, future]);

  function frac(e: React.MouseEvent) {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function hitWord(p: { x: number; y: number }): { line: Line; i: number } | null {
    for (let li = pageLines.length - 1; li >= 0; li--) {
      const line = pageLines[li];
      for (let i = line.boxes.length - 1; i >= 0; i--) {
        const b = line.boxes[i]; if (!b) continue;
        if (p.x >= b.x - 0.004 && p.x <= b.x + b.w + 0.004 && p.y >= b.y - 0.004 && p.y <= b.y + b.h + 0.004) return { line, i };
      }
    }
    return null;
  }
  function onMove(e: React.MouseEvent) { const h = hitWord(frac(e)); setHover(h ? key(h.line.id, h.i) : null); }
  function onClick(e: React.MouseEvent) { const p = frac(e); const h = hitWord(p); if (h) { const b = h.line.boxes[h.i]!; openWord(h.line, h.i, b.w > 0 ? (p.x - b.x) / b.w : 0); } else closeWord(); }

  const editCount = pageLines.length
    ? Object.keys(edits).reduce((n, k) => { const [lineId, iStr] = k.split('#'); const p = Number(lineId.split('-')[0]); const line = (lines[p] || []).find((l) => l.id === lineId); const i = Number(iStr); return line && line.parts[i]?.trim() && partEdited(line, i, edits[k]) ? n + 1 : n; }, 0)
    : 0;

  async function apply() {
    if (!file || editCount === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      const list: LineEdit[] = [];
      for (const [pStr, ls] of Object.entries(lines)) {
        const p = Number(pStr);
        for (const line of ls) {
          if (!lineHasEdits(line, edits)) continue;
          const parts = line.parts.map((orig, i) => {
            if (!orig.trim()) return { text: orig, family: line.family, color: line.color, bold: line.bold, italic: line.italic };
            const e = editOf(line, i, edits);
            return { text: e.text, family: e.family, sizeFrac: e.size, color: e.color, bold: e.bold, italic: e.italic };
          });
          list.push({ page: p, xFrac: line.x, yFrac: line.y, wFrac: line.w, hFrac: line.h, bg: line.bg, parts });
        }
      }
      const outBytes = await applyLineEdits(await file.arrayBuffer(), list);
      const name = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`;
      const blob = new Blob([outBytes.slice()], { type: 'application/pdf' });
      download(blob, name);
      setDone({ blob, name, secs: (performance.now() - t0) / 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the edited PDF.');
    } finally { setBusy(false); }
  }

  // Per-line layout: the fit scale + each part's drawn width. Preview canvas and
  // the editor input both use this so they stay perfectly in sync.
  function lineMetrics(line: Line): { fit: number; widths: number[]; parts: (Edit | null)[] } {
    const parts = line.parts.map((p, i) => (p.trim() ? editOf(line, i, edits) : null));
    let natural = 0; const base: number[] = [];
    line.parts.forEach((orig, i) => {
      const e = parts[i];
      const size = (e ? e.size : line.h) * disp.h;
      const w = measureWidth((e ? e.text : orig) || ' ', cssFont(e ? e.family : line.family, e ? e.bold : line.bold, e ? e.italic : line.italic, size));
      base.push(w); natural += w;
    });
    const fit = lineFitScale(natural, line.w * disp.w);
    return { fit, widths: base.map((w) => w * fit), parts };
  }

  // Draw the edited/active lines onto the overlay CANVAS. Cover + redrawn text
  // live in ONE coordinate space, so they can never drift apart (that drift was
  // the "doubling" bug when cover used % and text used px-from-a-stale-disp).
  const paintOverlay = useCallback(() => {
    const cv = canvasRef.current; if (!cv || !disp.w || !disp.h) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(disp.w * dpr) || cv.height !== Math.round(disp.h * dpr)) { cv.width = Math.round(disp.w * dpr); cv.height = Math.round(disp.h * dpr); }
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, disp.w, disp.h);
    ctx.textBaseline = 'alphabetic';
    for (const line of pageLines) {
      const isActive = editing?.lineId === line.id;
      if (!isActive && !lineHasEdits(line, edits)) continue;
      const { fit, widths, parts } = lineMetrics(line);
      const bx = line.w * 0.02 + line.h * 0.06;
      ctx.fillStyle = line.bg;
      ctx.fillRect((line.x - bx) * disp.w, (line.y - COVER_TOP * line.h) * disp.h, (line.w + bx * 2) * disp.w, COVER_H * line.h * disp.h);
      const baseY = (line.y + BASELINE * line.h) * disp.h;
      let x = line.x * disp.w;
      line.parts.forEach((orig, i) => {
        const e = parts[i];
        const t = e ? e.text : orig;
        const isActiveWord = isActive && editing!.i === i;
        if (t && t.trim() && !isActiveWord) {
          ctx.font = cssFont(e ? e.family : line.family, e ? e.bold : line.bold, e ? e.italic : line.italic, (e ? e.size : line.h) * disp.h * fit);
          ctx.fillStyle = e ? e.color : line.color;
          ctx.fillText(t, x, baseY);
        }
        x += widths[i];
      });
    }
    // hover highlight (skip the word being edited)
    if (hover && hover !== (editing ? key(editing.lineId, editing.i) : null)) {
      const [lid, iStr] = hover.split('#'); const line = pageLines.find((l) => l.id === lid); const b = line?.boxes[Number(iStr)];
      if (b) {
        const pad = b.h * 0.12, rx = (b.x - pad) * disp.w, ry = (b.y - pad) * disp.h, rw = (b.w + pad * 2) * disp.w, rh = (b.h + pad * 2) * disp.h;
        ctx.fillStyle = 'rgba(79,70,229,0.16)'; ctx.strokeStyle = 'rgba(79,70,229,0.55)'; ctx.lineWidth = 1;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 3); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(rx, ry, rw, rh); ctx.strokeRect(rx, ry, rw, rh); }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLines, edits, hover, editing, disp]);

  useEffect(() => { paintOverlay(); }, [paintOverlay, preview]);

  const canUndo = past.length > 0, canRedo = future.length > 0;
  const tbBtn = 'flex size-9 items-center justify-center rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed';

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
            <p className="text-xs text-muted-foreground">Click any word to edit it — right in your browser, never uploaded</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p></div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setLines({}); setEdits({}); setPast([]); setFuture([]); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            {/* Premium formatting toolbar — acts on the selected word */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-soft">
              <FontSelect value={activeEdit?.family ?? 'helvetica'} onChange={(f) => patchActive({ family: f })} className="w-44" />
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} hover:bg-accent`} title="Smaller" disabled={!activeEdit} onClick={() => patchActive({ size: Math.max(0.006, activeEdit!.size * 0.92) })}><Minus className="size-4" /></button>
              <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">{activeEdit ? Math.round(activeEdit.size * disp.h) : '—'}</span>
              <button className={`${tbBtn} hover:bg-accent`} title="Larger" disabled={!activeEdit} onClick={() => patchActive({ size: Math.min(0.2, activeEdit!.size * 1.08) })}><Plus className="size-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} ${activeEdit?.bold ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Bold" aria-pressed={!!activeEdit?.bold} disabled={!activeEdit || !famInfo?.bold} onClick={() => patchActive({ bold: !activeEdit!.bold })}><Bold className="size-4" /></button>
              <button className={`${tbBtn} ${activeEdit?.italic ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Italic" aria-pressed={!!activeEdit?.italic} disabled={!activeEdit || !famInfo?.italic} onClick={() => patchActive({ italic: !activeEdit!.italic })}><Italic className="size-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <div className="flex items-center gap-1 px-0.5">
                {SWATCHES.map((c) => (
                  <button key={c} disabled={!activeEdit} aria-label={`colour ${c}`} aria-pressed={activeEdit?.color === c} onClick={() => patchActive({ color: c })}
                    className={`size-5 rounded-full ring-offset-1 ring-offset-card transition-all disabled:opacity-40 ${activeEdit?.color === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} text-destructive hover:bg-destructive/10`} title="Delete this word" disabled={!activeEdit} onClick={deleteActive}><Trash2 className="size-4" /></button>
              <div className="ml-auto flex items-center gap-1">
                <button className={`${tbBtn} hover:bg-accent`} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 className="size-4" /></button>
                <button className={`${tbBtn} hover:bg-accent`} title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}><Redo2 className="size-4" /></button>
              </div>
            </div>

            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Pencil className="size-3.5 text-primary" />
              {activeEdit ? 'Editing a word — type, then format with the toolbar. The line reflows as you go.' : 'Click any word to edit it.'}
              {detecting && <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> finding text…</span>}
            </p>

            <div className="flex items-start justify-center rounded-xl border bg-muted/30 p-3">
              {preview ? (
                <div ref={wrapRef} className="relative inline-block leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={imgRef} src={preview.url} alt={`Page ${sel + 1}`} className="max-h-[34rem] max-w-full rounded border bg-white shadow-md" draggable={false} onLoad={() => { const im = imgRef.current; if (im) setDisp({ w: im.clientWidth, h: im.clientHeight }); }} />

                  {/* Edited/active lines: cover + reflowed text drawn in ONE canvas
                      (same coordinate space → can't drift → no doubling). */}
                  <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

                  {/* click/hover surface */}
                  <div className="absolute inset-0" style={{ cursor: hover ? 'text' : 'default' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} />

                  {/* the live editor input — positioned exactly over its word slot */}
                  {activeLine && activeEdit && editing && disp.h > 0 && (() => {
                    const { fit, widths } = lineMetrics(activeLine);
                    const px = activeEdit.size * disp.h * fit;
                    let offset = 0; for (let j = 0; j < editing.i; j++) offset += widths[j];
                    const baselinePx = (activeLine.y + BASELINE * activeLine.h) * disp.h;
                    return (
                      <input
                        ref={editRef}
                        value={activeEdit.text}
                        onChange={(ev) => { const t = ev.target.value; beginSession(); setEdits((s) => ({ ...s, [key(activeLine.id, editing.i)]: { ...editOf(activeLine, editing.i, s), text: t } })); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); closeWord(); } else if (ev.key === 'Escape') { setEditing(null); sessionRef.current = null; } }}
                        onBlur={closeWord}
                        className="absolute z-20 rounded-[2px] p-0 outline-none ring-2 ring-primary/60"
                        style={{ left: `${activeLine.x * disp.w + offset}px`, top: `${baselinePx - BASELINE * px}px`, width: `${Math.max(px, widths[editing.i]) + 3}px`, height: `${px * 1.2}px`, lineHeight: `${px * 1.2}px`, fontFamily: FAMILIES[activeEdit.family].css, fontSize: `${px}px`, fontWeight: activeEdit.bold ? 700 : 400, fontStyle: activeEdit.italic ? 'italic' : 'normal', color: activeEdit.color, background: activeLine.bg, caretColor: '#4f46e5' }}
                      />
                    );
                  })()}
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { closeWord(); setSel(i); }} className="mt-2" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {editCount ? `${editCount} word${editCount === 1 ? '' : 's'} edited. Edited lines are re-encoded as real text; edits over photos may show a faint patch.` : 'Hover shows editable words. Scanned pages have no selectable text to edit.'}
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-4 w-full" size="lg" onClick={apply} disabled={busy || editCount === 0}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Pencil className="size-4" /> Save edited PDF</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/edit-pdf" fromLabel="Edit PDF" />}
      </CardContent>
    </Card>
  );
}
