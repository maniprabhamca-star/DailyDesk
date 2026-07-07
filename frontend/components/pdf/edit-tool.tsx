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
import { applyLineEdits, COVER_TOP, COVER_H, BASELINE, type LineEdit } from '@/lib/pdf-edit-text';
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
  inkH: number;                                           // measured rendered ink height (fraction) — for visual size match
  family: Family; color: string; bg: string; bold: boolean; italic: boolean;
  parts: string[];                                        // words + whitespace, in order
  boxes: (WordBox | null)[];                              // per-word box (refined on click)
};
type WordBox = { x: number; y: number; w: number; h: number; inkTop?: number; inkH?: number };
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
// Rendered ink height of some text in a CSS font (cap+descender) — used to match
// the redraw's visual size to the original (browser fonts look bigger otherwise).
function inkHeight(text: string, cssFontStr: string): number {
  if (typeof document === 'undefined') return 0;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = cssFontStr;
  const m = measureCtx.measureText(text || 'Hg');
  return (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
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
        // Decode the rendered page to sample its pixels. Prefer createImageBitmap
        // (fast + reliable); fall back to <img>.decode() only where it's missing.
        // (img.decode() of a blob URL can hang in some headless engines — it stalled
        // detection entirely — so createImageBitmap is the robust default.)
        let src: CanvasImageSource & { close?: () => void };
        try {
          if (typeof createImageBitmap !== 'function') throw new Error('no-bitmap');
          const blob = await (await fetch(rp.url)).blob();
          src = await createImageBitmap(blob);
        } catch {
          const im = new Image(); im.src = rp.url; await im.decode(); src = im;
        }
        const sc = document.createElement('canvas'); sc.width = rp.w; sc.height = rp.h;
        const sctx = sc.getContext('2d')!; sctx.drawImage(src, 0, 0, rp.w, rp.h);
        src.close?.();
        const px = sctx.getImageData(0, 0, rp.w, rp.h).data;
        // MUST floor to integer pixel coords — a fractional index into the pixel
        // array returns undefined, which produced `rgb(undefined,...)` covers
        // (invalid → transparent in DOM = doubling, black on canvas = black bar).
        const at = (cx: number, cy: number): RGB => {
          const xi = Math.min(rp.w - 1, Math.max(0, Math.round(cx)));
          const yi = Math.min(rp.h - 1, Math.max(0, Math.round(cy)));
          const i = (yi * rp.w + xi) * 4;
          return [px[i], px[i + 1], px[i + 2]];
        };
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
          // Split into words + whitespace; estimate per-word boxes, then REFINE
          // each word's horizontal extent from the actual pixels (scan out to the
          // white gaps that separate words). Accurate boxes are what let us cover
          // and replace ONE word cleanly without touching its neighbours.
          sctx.font = cssFont(family, bold, italic, 100);
          const parts = s.split(/(\s+)/).filter((p) => p !== '');
          let measured = 0; const off: number[] = [];
          const widths = parts.map((p) => { off.push(measured); const mw = sctx.measureText(p).width; measured += mw; return mw; });
          const scl = measured > 0 ? w / measured : 0;
          // Per-word box (proportional — accurate for the doc font) + the word's OWN
          // measured ink height (so the redraw matches THAT word's size, not the
          // line's — all-caps words have no descenders and would look too big).
          const yWt = Math.round(top / vp.height * rp.h), yWb = Math.round((top + fontH) / vp.height * rp.h);
          const boxes = parts.map((p, i) => {
            if (!p.trim()) return null;
            const bxF = (left + off[i] * scl) / vp.width, bwF = (widths[i] * scl) / vp.width;
            const bl = Math.max(0, Math.round(bxF * rp.w)), br = Math.min(rp.w - 1, Math.round((bxF + bwF) * rp.w));
            let cT = -1, cB = -1;
            for (let y = yWt; y <= yWb; y++) { let d = false; for (let x = bl; x <= br; x++) { const cc = at(x, y); if (cc[0] + cc[1] + cc[2] < 430) { d = true; break; } } if (d) { if (cT < 0) cT = y; cB = y; } }
            const wInkH = (cT >= 0 && cB >= cT) ? (cB - cT + 1) / rp.h : (fontH / vp.height) * 0.7;
            return { x: bxF, y: top / vp.height, w: bwF, h: fontH / vp.height, inkH: wInkH };
          });
          // Measure the line's ACTUAL rendered ink height (topmost→bottommost dark
          // pixel within its em box) so the redraw can match the original's visual
          // size — the browser font at the same nominal size looks bigger otherwise.
          const lBand = Math.max(0, Math.round(left / vp.width * rp.w)), rBand = Math.min(rp.w - 1, Math.round((left + w) / vp.width * rp.w));
          const sTop = Math.max(0, Math.round(top / vp.height * rp.h)), sBot = Math.min(rp.h - 1, Math.round((top + fontH * 0.98) / vp.height * rp.h));
          let capTop = -1, capBot = -1;
          for (let yy = sTop; yy <= sBot; yy++) { let dark = false; for (let xx = lBand; xx <= rBand; xx += 2) { const c = at(xx, yy); if (c[0] + c[1] + c[2] < 430) { dark = true; break; } } if (dark) { if (capTop < 0) capTop = yy; capBot = yy; } }
          const inkH = (capTop >= 0 && capBot >= capTop) ? (capBot - capTop + 1) / rp.h : (fontH / vp.height) * 0.7;
          list.push({ id: `${sel}-L${list.length}`, page: sel, x: left / vp.width, y: top / vp.height, w: w / vp.width, h: fontH / vp.height, inkH, family, color, bg, bold, italic, parts, boxes });
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
  function onClick(e: React.MouseEvent) { const p = frac(e); const hw = hitWord(p); if (hw) { const b = hw.line.boxes[hw.i]!; openWord(hw.line, hw.i, b.w > 0 ? (p.x - b.x) / b.w : 0); } else closeWord(); }

  const editCount = pageLines.length
    ? Object.keys(edits).reduce((n, k) => { const [lineId, iStr] = k.split('#'); const p = Number(lineId.split('-')[0]); const line = (lines[p] || []).find((l) => l.id === lineId); const i = Number(iStr); return line && line.parts[i]?.trim() && partEdited(line, i, edits[k]) ? n + 1 : n; }, 0)
    : 0;

  async function apply() {
    if (!file || editCount === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      // One cover+draw PER CHANGED WORD, at that word's ORIGINAL position — so
      // every untouched word stays the original PDF text, pixel-for-pixel, and
      // nothing on the line moves or resizes. (A much longer replacement can
      // overrun into the next word's gap; a same/shorter one is seamless.)
      const list: LineEdit[] = [];
      for (const [pStr, ls] of Object.entries(lines)) {
        const p = Number(pStr);
        for (const line of ls) {
          line.parts.forEach((part, i) => {
            if (!part.trim()) return;
            const e = editOf(line, i, edits);
            if (!partEdited(line, i, e)) return;
            const box = line.boxes[i]; if (!box) return;
            const c = wordCover(line, box, e);
            const draws = e.text.trim() ? [{ text: e.text, xFrac: box.x, sizeFrac: c.size / disp.h, family: e.family, color: e.color, bold: e.bold, italic: e.italic }] : [];
            list.push({ page: p, yFrac: line.y, hFrac: line.h, bg: line.bg, coverLFrac: c.coverL, coverRFrac: c.coverR, draws });
          });
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

  // Draw size for an edited word. The browser font at the detected nominal size can
  // render a bit larger/smaller than the PDF's font, so we correct it — but with a
  // SINGLE per-line factor (the line's measured ink vs the browser rendering of the
  // same line text), NOT per-word. Matching each word to its OWN ink made words
  // whose letters differ from the original (e.g. a capitalised replacement over a
  // lowercase word) shrink to the wrong x-height. One factor per line keeps every
  // edited word at a consistent em that matches the untouched words around it.
  function matchedSize(line: Line, _box: WordBox, e: Edit): number {
    const nominal = e.size * disp.h;
    const targetInk = line.inkH * disp.h;
    const ref = line.parts.join('').trim() || 'Hg';
    const brInk = inkHeight(ref, cssFont(line.family, line.bold, line.italic, line.h * disp.h)) || nominal * 0.9;
    const scale = targetInk > 0 && brInk > 0 ? targetInk / brInk : 1;
    return nominal * Math.max(0.7, Math.min(1.12, scale));
  }

  // In-place cover for ONE changed word: hides just that word's box (with a small
  // bleed) and, if a replacement is longer than the original, extends right enough
  // to fit it. No reflow — neighbours never move, so unchanged words stay exactly
  // as the PDF drew them. Returns the matched draw size too (single source of truth
  // for the overlay, the live input, and the export).
  function wordCover(line: Line, box: WordBox, e: Edit) {
    const size = matchedSize(line, box, e);
    const newWFrac = e.text.trim() ? measureWidth(e.text, cssFont(e.family, e.bold, e.italic, size)) / disp.w : 0;
    const coverL = Math.max(0, box.x - line.h * 0.06);
    const coverR = box.x + Math.max(box.w, newWFrac) + line.h * 0.10;
    return { size, coverL, coverR };
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
      if (!lineHasEdits(line, edits)) continue;
      // Guard: an invalid colour string leaves canvas fillStyle unchanged (black),
      // which is exactly how a bad sample used to blot the line. Force white.
      const bgFill = /^rgb\(\s*\d/.test(line.bg) ? line.bg : 'rgb(255,255,255)';
      const baseY = (line.y + BASELINE * line.h) * disp.h;
      const coverTopY = (line.y - COVER_TOP * line.h) * disp.h;
      const coverHpx = COVER_H * line.h * disp.h;
      // Only the CHANGED words are covered + redrawn, each at its ORIGINAL box
      // position — untouched words keep their exact PDF pixels (never resized,
      // never moved).
      for (let i = 0; i < line.parts.length; i++) {
        if (!line.parts[i].trim()) continue;
        const box = line.boxes[i]; if (!box) continue;
        const e = editOf(line, i, edits);
        if (!partEdited(line, i, e)) continue;
        const c = wordCover(line, box, e);
        ctx.fillStyle = bgFill;
        ctx.fillRect(c.coverL * disp.w, coverTopY, (c.coverR - c.coverL) * disp.w, coverHpx);
        // The word being typed is shown by the DOM input on top; a deletion just
        // leaves the cover (erased). Everything else is redrawn here.
        if ((editing?.lineId === line.id && editing?.i === i) || !e.text.trim()) continue;
        ctx.font = cssFont(e.family, e.bold, e.italic, c.size);
        ctx.fillStyle = e.color;
        ctx.fillText(e.text, box.x * disp.w, baseY);
      }
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
            {/* Premium formatting toolbar — acts on the selected word. While a word
                is being edited, DON'T let toolbar clicks steal focus from the input
                (that blur used to commit + exit edit mode before the style applied),
                so font/size/bold/italic/colour change live as you type. */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-soft"
              onMouseDown={(e) => { if (editing) e.preventDefault(); }}>
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
              {activeEdit ? 'Editing a word — type, then format with the toolbar. Only this word changes.' : 'Click any word to edit it.'}
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

                  {/* the live editor input — positioned exactly over its word */}
                  {activeLine && activeEdit && editing && disp.h > 0 && activeLine.boxes[editing.i] && (() => {
                    const box = activeLine.boxes[editing.i]!;
                    const size = matchedSize(activeLine, box, activeEdit);
                    const baselinePx = (activeLine.y + BASELINE * activeLine.h) * disp.h;
                    const newWpx = activeEdit.text.trim() ? measureWidth(activeEdit.text, cssFont(activeEdit.family, activeEdit.bold, activeEdit.italic, size)) : 0;
                    return (
                      <input
                        ref={editRef}
                        value={activeEdit.text}
                        onChange={(ev) => { const t = ev.target.value; beginSession(); setEdits((s) => ({ ...s, [key(activeLine.id, editing.i)]: { ...editOf(activeLine, editing.i, s), text: t } })); }}
                        onKeyDown={(ev) => {
                          const mod = ev.ctrlKey || ev.metaKey;
                          if (mod && ev.key.toLowerCase() === 'b') { ev.preventDefault(); if (famInfo?.bold) patchActive({ bold: !activeEdit.bold }); }
                          else if (mod && ev.key.toLowerCase() === 'i') { ev.preventDefault(); if (famInfo?.italic) patchActive({ italic: !activeEdit.italic }); }
                          else if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); if (ev.key === 'Escape') { setEditing(null); sessionRef.current = null; } }
                        }}
                        className="absolute z-20 rounded-[2px] p-0 outline-none ring-2 ring-primary/60"
                        style={{ left: `${box.x * disp.w}px`, top: `${baselinePx - BASELINE * size}px`, width: `${Math.max(newWpx, box.w * disp.w, size) + 4}px`, height: `${size * 1.2}px`, lineHeight: `${size * 1.2}px`, fontFamily: FAMILIES[activeEdit.family].css, fontSize: `${size}px`, fontWeight: activeEdit.bold ? 700 : 400, fontStyle: activeEdit.italic ? 'italic' : 'normal', color: activeEdit.color, background: activeLine.bg, caretColor: '#4f46e5' }}
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
              {editCount ? `${editCount} word${editCount === 1 ? '' : 's'} edited in place — untouched words stay exactly as the original. A much longer replacement can run into the next word.` : 'Hover shows editable words. Scanned pages have no selectable text to edit.'}
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
