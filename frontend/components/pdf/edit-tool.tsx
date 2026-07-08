'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Upload, FileText, X, Loader2, Pencil, Undo2, Redo2, Bold, Italic, Trash2, Minus, Plus, Zap, TextCursorInput } from 'lucide-react';
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
import { applyLineEdits, COVER_TOP, COVER_H, BASELINE, type LineEdit, type BlockEdit } from '@/lib/pdf-edit-text';
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
// A brand-new text box the user placed (independent of the PDF's own text).
type Added = { id: string; page: number; x: number; y: number; sizeFrac: number; text: string; family: Family; color: string; bold: boolean; italic: boolean };

// A paragraph BLOCK — the Smallpdf-style unit you edit: one or more detected
// line-runs grouped into a box you type into freely (browser wraps the text).
type Block = {
  id: string; page: number;
  x: number; y: number; w: number; h: number;   // bounding box (top-left + size, fractions)
  family: Family; size: number; color: string; bold: boolean; italic: boolean; bg: string;
  lineH: number;                                  // line-to-line spacing (fraction of page height)
  text: string;                                   // full text, original line breaks kept as \n
};

// Group detected line-runs into paragraph blocks: lines that sit directly under
// one another, share a left edge / overlap horizontally, and are the same size
// belong to the same block. This is what lets a whole paragraph be edited at once.
function groupBlocks(lines: Line[], page: number): Block[] {
  const rows = lines
    .map((l) => ({ top: l.y, bottom: l.y + l.h, left: l.x, right: l.x + l.w, h: l.h, text: l.parts.join(''), family: l.family, color: l.color, bold: l.bold, italic: l.italic, bg: l.bg }))
    .filter((r) => r.text.trim())
    .sort((a, b) => (Math.abs(a.top - b.top) > a.h * 0.4 ? a.top - b.top : a.left - b.left));
  const blocks: Block[] = [];
  let cur: typeof rows | null = null;
  const flush = () => {
    if (!cur || !cur.length) return;
    const x = Math.min(...cur.map((r) => r.left)), right = Math.max(...cur.map((r) => r.right));
    const y = Math.min(...cur.map((r) => r.top)), bottom = Math.max(...cur.map((r) => r.bottom));
    const first = cur[0];
    // median line spacing (baseline-to-baseline); fall back to 1.2× height.
    const gaps: number[] = [];
    for (let i = 1; i < cur.length; i++) gaps.push(cur[i].top - cur[i - 1].top);
    gaps.sort((a, b) => a - b);
    const lineH = gaps.length ? gaps[Math.floor(gaps.length / 2)] : first.h * 1.2;
    blocks.push({ id: `${page}-B${blocks.length}`, page, x, y, w: right - x, h: bottom - y, family: first.family, size: first.h, color: first.color, bold: first.bold, italic: first.italic, bg: first.bg, lineH, text: cur.map((r) => r.text).join('\n') });
    cur = null;
  };
  for (const r of rows) {
    if (!cur) { cur = [r]; continue; }
    const prev = cur[cur.length - 1];
    const vGap = r.top - prev.bottom;                                  // vertical gap to previous line
    const sameCol = r.left < prev.right && r.right > prev.left;        // horizontal overlap (same column)
    const sameSize = Math.abs(r.h - prev.h) <= prev.h * 0.35;          // similar font size
    const closeEnough = vGap >= -prev.h * 0.5 && vGap <= prev.h * 0.9; // stacked (paragraph spacing)
    if (sameCol && sameSize && closeEnough) cur.push(r);
    else { flush(); cur = [r]; }
  }
  flush();
  return blocks;
}

// Isolated editable paragraph box. It seeds its text ONCE and never re-renders
// while you type (memoised), so React never fights the browser over the
// contentEditable content — the crash that happens if React reconciles it.
const BlockEditText = memo(function BlockEditText({ initialText, style, onInput, onDone }: {
  initialText: string; style: React.CSSProperties; onInput: (t: string) => void; onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.innerText = initialText;
    const id = requestAnimationFrame(() => {
      try { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
    // seed once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onInput={(e) => onInput((e.currentTarget as HTMLElement).innerText)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); onDone(); } }}
      className="absolute z-30 rounded-[2px] px-[1px] outline-none ring-2 ring-primary/60"
      style={style}
    />
  );
});

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
// Render the redraw in the SAME font pdf.js draws the page with, so edited text
// matches the original instead of the browser's Arial. pdf.js renders the
// standard-14 Helvetica/Arial with LiberationSans (bundled at /pdfjs/standard_fonts/,
// which we also load as a FontFace below). Times/Courier fall back to their CSS
// stacks until we add TTF substitutes for those too.
const RENDER_CSS: Partial<Record<Family, string>> = {
  helvetica: "'DiemLiberationSans', Helvetica, Arial, sans-serif",
};
function cssFont(family: Family, bold: boolean, italic: boolean, px: number): string {
  const fam = RENDER_CSS[family] ?? FAMILIES[family].css;
  return `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${px}px ${fam}`;
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
// Map the PDF's REAL font (e.g. "BCDFEE+Calibri", "ArialMT") to the closest
// bundled family so the redraw matches the document. Calibri → Carlito (its open
// metric+shape twin), Arial/Helvetica → helvetica (LiberationSans), etc.
function matchFamily(fontName?: string): Family {
  const n = (fontName || '').toLowerCase();
  if (/calibri|carlito/.test(n)) return 'carlito';
  if (/verdana|dejavu|tahoma|geneva|segoe/.test(n)) return 'dejavusans';
  if (/times|roman|georgia|garamond|minion|cambria|book\b|serif/.test(n)) return 'times';
  if (/courier|consol|\bmono\b/.test(n)) return 'courier';
  return 'helvetica'; // Arial, Helvetica, and unknown sans-serifs
}
// Weight/style from the real font name.
function styleOf(fontName?: string): { bold: boolean; italic: boolean } {
  const n = (fontName || '').toLowerCase();
  return { bold: /bold|black|heavy|semibold|w[6-9]00/.test(n), italic: /italic|oblique/.test(n) };
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
  const [blocks, setBlocks] = useState<Record<number, Block[]>>({});
  const [blockEdits, setBlockEdits] = useState<Record<string, string>>({}); // blockId -> edited full text
  const [blockStyle, setBlockStyle] = useState<Record<string, Partial<Pick<Block, 'family' | 'size' | 'color' | 'bold' | 'italic'>>>>({});
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [edits, setEdits] = useState<EditMap>({});
  const [editing, setEditing] = useState<{ lineId: string; i: number } | null>(null);
  const [caret, setCaret] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState(0);
  // Add-text (new boxes the user places), separate from the PDF's own words.
  const [added, setAdded] = useState<Added[]>([]);
  const [addSel, setAddSel] = useState<string | null>(null); // id being edited
  const [addMode, setAddMode] = useState(false);             // click-to-place armed
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

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
    setAdded([]); setAddSel(null); setAddMode(false);
    setBlocks({}); setBlockEdits({}); setBlockStyle({}); setEditingBlock(null);
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

  // Load LiberationSans (the font pdf.js renders standard Helvetica with) so our
  // canvas redraw matches the page exactly instead of using the browser's Arial.
  // Same files pdf.js already uses, served from /pdfjs/standard_fonts/.
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') return;
    const lib = '/pdfjs/standard_fonts/LiberationSans';
    const faces = [
      // Arial/Helvetica → LiberationSans (what pdf.js renders standard sans with).
      new FontFace('DiemLiberationSans', `url(${lib}-Regular.ttf)`, { weight: '400', style: 'normal' }),
      new FontFace('DiemLiberationSans', `url(${lib}-Bold.ttf)`, { weight: '700', style: 'normal' }),
      new FontFace('DiemLiberationSans', `url(${lib}-Italic.ttf)`, { weight: '400', style: 'italic' }),
      new FontFace('DiemLiberationSans', `url(${lib}-BoldItalic.ttf)`, { weight: '700', style: 'italic' }),
      // Calibri → Carlito (its open metric+shape twin) — the most common Office font.
      new FontFace('Carlito', `url(/fonts/carlito.ttf)`, { weight: '400', style: 'normal' }),
      new FontFace('Carlito', `url(/fonts/carlito-bold.ttf)`, { weight: '700', style: 'normal' }),
      new FontFace('Carlito', `url(/fonts/carlito-italic.ttf)`, { weight: '400', style: 'italic' }),
    ];
    let alive = true;
    void Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)).catch(() => {})))
      .then(() => { if (alive) setFontReady((n) => n + 1); });
    return () => { alive = false; };
  }, []);

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
        // Resolve each pdf.js loadedName ("g_d0_f2") to the PDF's REAL font
        // ("Calibri") via commonObjs, so edits redraw in the matching family. The
        // page was already rendered above, so the fonts are loaded (getOperatorList
        // is cached and cheap; it just guarantees they're resolvable here).
        try { await page.getOperatorList(); } catch { /* fonts fall back to name-guess */ }
        const famCache = new Map<string, { family: Family; bold: boolean; italic: boolean; real?: string }>();
        const resolveFont = (loaded?: string) => {
          const k = loaded || '';
          const hit = famCache.get(k); if (hit) return hit;
          let real: string | undefined;
          try {
            const co = (page as unknown as { commonObjs?: { has: (n: string) => boolean; get: (n: string) => { name?: string } | null } }).commonObjs;
            if (co && loaded && co.has(loaded)) real = co.get(loaded)?.name;
          } catch { /* not resolved */ }
          const name = real || loaded;
          const info = { family: matchFamily(name), ...styleOf(name), real };
          famCache.set(k, info);
          return info;
        };
        const list: Line[] = [];
        for (const it of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number; fontName?: string }>) {
          const s = it.str;
          if (!s || !s.trim() || !it.transform) continue;
          const m = pdfjs.Util.transform(vp.transform, it.transform);
          const fontH = Math.hypot(m[2], m[3]) || (it.height || 8);
          const w = (it.width || 0) * vp.scale;
          if (w < 2 || fontH < 4) continue;
          const left = m[4], top = m[5] - fontH * BASELINE;
          const finfo = resolveFont(it.fontName);
          const family = finfo.family;
          const bold = finfo.bold;
          const italic = finfo.italic;
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
        if (!cancelled) { setLines((prev) => ({ ...prev, [sel]: list })); setBlocks((prev) => ({ ...prev, [sel]: groupBlocks(list, sel) })); }
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

  // ---- Block (paragraph) editing — the Smallpdf-style model ------------------
  const pageBlocks = blocks[sel] || [];
  const activeBlock = editingBlock ? pageBlocks.find((b) => b.id === editingBlock) ?? null : null;
  const blockTextOf = (b: Block) => blockEdits[b.id] ?? b.text;
  // Effective style = detected style with any toolbar overrides applied.
  const blockStyleOf = (b: Block) => { const o = blockStyle[b.id] || {}; return { family: o.family ?? b.family, size: o.size ?? b.size, color: o.color ?? b.color, bold: o.bold ?? b.bold, italic: o.italic ?? b.italic }; };
  const blockChanged = (b: Block) => (blockEdits[b.id] !== undefined && blockEdits[b.id] !== b.text) || !!blockStyle[b.id];
  function openBlock(b: Block) { closeWord(); setAddSel(null); setEditingBlock(b.id); }
  function closeBlock() { setEditingBlock(null); }
  function patchBlock(patch: Partial<Pick<Block, 'family' | 'size' | 'color' | 'bold' | 'italic'>>) { if (editingBlock) setBlockStyle((s) => ({ ...s, [editingBlock]: { ...s[editingBlock], ...patch } })); }
  function hitBlock(p: { x: number; y: number }): Block | null {
    for (let i = pageBlocks.length - 1; i >= 0; i--) { const b = pageBlocks[i]; if (p.x >= b.x - 0.006 && p.x <= b.x + b.w + 0.006 && p.y >= b.y - 0.006 && p.y <= b.y + b.h + 0.006) return b; }
    return null;
  }
  // Stable style + input handler for the isolated editor (so it never re-renders
  // mid-typing).
  const activeBlockStyle = useMemo<React.CSSProperties>(() => {
    const b = activeBlock; if (!b || !disp.h) return {};
    const st = blockStyleOf(b); const fs = st.size * disp.h;
    return { left: `${b.x * disp.w}px`, top: `${b.y * disp.h - fs * 0.08}px`, width: `${(b.w + b.w * 0.02) * disp.w}px`, minHeight: `${b.h * disp.h + fs * 0.3}px`, fontFamily: RENDER_CSS[st.family] ?? FAMILIES[st.family].css, fontSize: `${fs}px`, fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal', color: st.color, lineHeight: (b.lineH / b.size), whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: /^rgb\(\s*\d/.test(b.bg) ? b.bg : '#ffffff', caretColor: '#4f46e5' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock, disp.h, disp.w, blockStyle]);
  const onBlockInput = useCallback((t: string) => { setBlockEdits((s) => (editingBlock ? { ...s, [editingBlock]: t } : s)); }, [editingBlock]);

  // ---- Add-text: new boxes placed anywhere on the page -----------------------
  const activeAdded = addSel ? added.find((a) => a.id === addSel) ?? null : null;
  function placeAdded(fx: number, fy: number) {
    closeWord();
    const id = `A${Math.random().toString(36).slice(2, 8)}`;
    setAdded((prev) => [...prev, { id, page: sel, x: Math.max(0, Math.min(0.98, fx)), y: Math.max(0, Math.min(0.97, fy)), sizeFrac: 0.022, text: '', family: 'helvetica', color: '#111827', bold: false, italic: false }]);
    setAddSel(id);
    setAddMode(false);
  }
  function patchAdded(patch: Partial<Added>) { if (addSel) setAdded((prev) => prev.map((a) => (a.id === addSel ? { ...a, ...patch } : a))); }
  function deleteAdded() { if (addSel) { setAdded((prev) => prev.filter((a) => a.id !== addSel)); setAddSel(null); } }

  // Unified "current selection" for the toolbar — a word edit OR an added box.
  const activeBlockStyleEff = activeBlock ? blockStyleOf(activeBlock) : null;
  const hasSel = !!activeEdit || !!activeAdded || !!activeBlock;
  const selFamily: Family = activeEdit?.family ?? activeAdded?.family ?? activeBlockStyleEff?.family ?? 'helvetica';
  const selBold = activeEdit?.bold ?? activeAdded?.bold ?? activeBlockStyleEff?.bold ?? false;
  const selItalic = activeEdit?.italic ?? activeAdded?.italic ?? activeBlockStyleEff?.italic ?? false;
  const selColor = activeEdit?.color ?? activeAdded?.color ?? activeBlockStyleEff?.color ?? '';
  const selSizeFrac = activeEdit?.size ?? activeAdded?.sizeFrac ?? activeBlockStyleEff?.size ?? 0.02;
  const selSizePx = selSizeFrac * disp.h;
  const selFamInfo = FAMILIES[selFamily];
  function patchSel(p: { family?: Family; color?: string; bold?: boolean; italic?: boolean; size?: number }) {
    if (activeEdit) patchActive(p);
    else if (activeAdded) { const { size, ...rest } = p; patchAdded({ ...rest, ...(size !== undefined ? { sizeFrac: size } : {}) }); }
    else if (activeBlock) patchBlock(p);
  }
  function deleteSel() { if (activeEdit) deleteActive(); else if (activeAdded) deleteAdded(); }

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

  // Focus a newly selected/placed text box so the user can type immediately.
  useEffect(() => {
    if (!addSel) return;
    const id = requestAnimationFrame(() => { try { addInputRef.current?.focus(); } catch { /* ignore */ } });
    return () => cancelAnimationFrame(id);
  }, [addSel]);

  useEffect(() => {
    if (!file || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // While typing in a paragraph/text box, let the browser's own undo/redo run
      // (native contentEditable/input history) instead of hijacking the keys.
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
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
  function onMove(e: React.MouseEvent) { const b = hitBlock(frac(e)); setHover(b ? b.id : null); }
  function onClick(e: React.MouseEvent) {
    const p = frac(e);
    if (addMode) { placeAdded(p.x, p.y); return; }        // click-to-place a new text box
    const b = hitBlock(p);
    if (b) { setAddSel(null); openBlock(b); }             // click a paragraph = edit the whole block
    else { closeBlock(); setAddSel(null); }               // click empty space = deselect
  }

  const editCount = pageLines.length
    ? Object.keys(edits).reduce((n, k) => { const [lineId, iStr] = k.split('#'); const p = Number(lineId.split('-')[0]); const line = (lines[p] || []).find((l) => l.id === lineId); const i = Number(iStr); return line && line.parts[i]?.trim() && partEdited(line, i, edits[k]) ? n + 1 : n; }, 0)
    : 0;
  const addedCount = added.filter((a) => a.text.trim()).length;
  const blockCount = Object.entries(blocks).reduce((n, [, bs]) => n + bs.filter((b) => (blockEdits[b.id] !== undefined && blockEdits[b.id] !== b.text) || !!blockStyle[b.id]).length, 0);
  const totalChanges = editCount + addedCount + blockCount;

  async function apply() {
    if (!file || totalChanges === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      // Export mirrors the on-screen plan EXACTLY (same linePlan) so the saved PDF
      // matches the preview: in-place covers per word, or a single reflow span with
      // the shifted words when a replacement grew the line.
      const list: LineEdit[] = [];
      for (const [pStr, ls] of Object.entries(lines)) {
        const p = Number(pStr);
        for (const line of ls) {
          const plan = linePlan(line);
          if (!plan) continue;
          const drawOf = (it: PlanItem, xFrac: number) => ({ text: it.e.text, xFrac, sizeFrac: it.size / disp.h, family: it.e.family, color: it.e.color, bold: it.e.bold, italic: it.e.italic });
          if (plan.reflow) {
            const draws = plan.items.filter((it) => it.e.text.trim()).map((it) => drawOf(it, it.xFrac));
            list.push({ page: p, yFrac: line.y, hFrac: line.h, bg: line.bg, coverLFrac: plan.coverL, coverRFrac: plan.coverR, draws });
          } else {
            for (const it of plan.items) {
              const box = line.boxes[it.i]!; const c = wordCover(line, box, it.e);
              const draws = it.e.text.trim() ? [drawOf(it, box.x)] : [];
              list.push({ page: p, yFrac: line.y, hFrac: line.h, bg: line.bg, coverLFrac: c.coverL, coverRFrac: c.coverR, draws });
            }
          }
        }
      }
      // Added text boxes: a positioned draw with NO cover (coverL == coverR).
      for (const a of added) {
        if (!a.text.trim()) continue;
        list.push({ page: a.page, yFrac: a.y, hFrac: a.sizeFrac, bg: 'rgb(255,255,255)', coverLFrac: a.x, coverRFrac: a.x, draws: [{ text: a.text, xFrac: a.x, sizeFrac: a.sizeFrac, family: a.family, color: a.color, bold: a.bold, italic: a.italic }] });
      }
      // Edited paragraph blocks: cover the box + re-flow the text in its font.
      const blockList: BlockEdit[] = [];
      for (const [pStr, bs] of Object.entries(blocks)) {
        const p = Number(pStr);
        for (const b of bs) {
          if (!blockChanged(b)) continue;
          const st = blockStyleOf(b);
          blockList.push({ page: p, xFrac: b.x, yFrac: b.y, wFrac: b.w + b.w * 0.02, hFrac: b.h, bg: b.bg, sizeFrac: st.size, lineHFrac: b.lineH, text: blockTextOf(b), family: st.family, color: st.color, bold: st.bold, italic: st.italic });
        }
      }
      const outBytes = await applyLineEdits(await file.arrayBuffer(), list, blockList);
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

  // Rendered width (fraction of page) of an edited word at a given size.
  function wordWidthFrac(e: Edit, size: number): number {
    return e.text.trim() ? measureWidth(e.text, cssFont(e.family, e.bold, e.italic, size)) / disp.w : 0;
  }
  // In-place cover for ONE changed word: hides just that word's box (with a small
  // bleed), extending right to fit a slightly-longer replacement.
  function wordCover(line: Line, box: WordBox, e: Edit) {
    const size = matchedSize(line, box, e);
    const w = Math.max(box.w, wordWidthFrac(e, size));
    return { size, coverL: Math.max(0, box.x - line.h * 0.06), coverR: box.x + w + line.h * 0.10 };
  }

  type PlanItem = { i: number; xFrac: number; size: number; e: Edit };
  type LinePlan = { items: PlanItem[]; coverL: number; coverR: number; reflow: boolean };
  // Decide how to lay out an edited line:
  //  • If the edits DON'T grow the line (shorter/equal), keep every edited word IN
  //    PLACE at its own box — untouched words stay the exact original PDF pixels.
  //  • If an edit makes the text LONGER, REFLOW from the first edit to the line end:
  //    shift the trailing words right by the accumulated growth and redraw them at
  //    matched size (so a longer word pushes the rest along instead of overlapping,
  //    and no original fragment is left peeking out). Prefix words stay original.
  function linePlan(line: Line): LinePlan | null {
    const edited: number[] = [];
    line.parts.forEach((p, i) => { if (p.trim() && partEdited(line, i, editOf(line, i, edits))) edited.push(i); });
    if (!edited.length) return null;
    // Reflow ONLY if a replacement would actually collide with its next neighbour.
    // A same-length/shorter edit (or one that still fits before the next word) stays
    // fully in place, so untouched words keep their exact original PDF pixels.
    let collide = false;
    for (const i of edited) {
      const box = line.boxes[i]; if (!box) continue;
      const e = editOf(line, i, edits);
      const newW = wordWidthFrac(e, matchedSize(line, box, e));
      let nextLeft = line.x + line.w;
      for (let k = i + 1; k < line.boxes.length; k++) { const nb = line.boxes[k]; if (nb) { nextLeft = nb.x; break; } }
      if (box.x + newW > nextLeft - line.h * 0.04) { collide = true; break; }
    }

    if (!collide) {
      const items: PlanItem[] = [];
      let cL = 1, cR = 0;
      for (const i of edited) { const box = line.boxes[i]; if (!box) continue; const e = editOf(line, i, edits); const c = wordCover(line, box, e); items.push({ i, xFrac: box.x, size: c.size, e }); cL = Math.min(cL, c.coverL); cR = Math.max(cR, c.coverR); }
      return { items, coverL: Math.max(0, cL), coverR: cR, reflow: false };
    }

    const firstEdit = Math.min(...edited);
    const items: PlanItem[] = [];
    let run = 0;
    for (let j = firstEdit; j < line.parts.length; j++) {
      const box = line.boxes[j]; if (!box || !line.parts[j].trim()) continue;
      const e = editOf(line, j, edits);
      const size = matchedSize(line, box, e);
      items.push({ i: j, xFrac: box.x + run, size, e });
      if (partEdited(line, j, e)) run += wordWidthFrac(e, size) - box.w;
    }
    const coverL = Math.max(0, line.boxes[firstEdit]!.x - line.h * 0.06);
    const coverR = line.x + line.w + Math.max(0, run) + line.h * 0.12;
    return { items, coverL, coverR, reflow: true };
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
      const plan = linePlan(line);
      if (!plan) continue;
      // Guard: an invalid colour string leaves canvas fillStyle unchanged (black),
      // which is exactly how a bad sample used to blot the line. Force white.
      const bgFill = /^rgb\(\s*\d/.test(line.bg) ? line.bg : 'rgb(255,255,255)';
      const baseY = (line.y + BASELINE * line.h) * disp.h;
      const coverTopY = (line.y - COVER_TOP * line.h) * disp.h;
      const coverHpx = COVER_H * line.h * disp.h;
      ctx.fillStyle = bgFill;
      if (plan.reflow) {
        // Longer edit: cover the whole edited-word→line-end span (no leftover
        // fragments) and redraw the shifted words on top.
        ctx.fillRect(plan.coverL * disp.w, coverTopY, (plan.coverR - plan.coverL) * disp.w, coverHpx);
      } else {
        // In place: cover only each changed word's own box; untouched words keep
        // their exact PDF pixels.
        for (const it of plan.items) { const box = line.boxes[it.i]!; const c = wordCover(line, box, it.e); ctx.fillRect(c.coverL * disp.w, coverTopY, (c.coverR - c.coverL) * disp.w, coverHpx); }
      }
      for (const it of plan.items) {
        // The word being typed is shown by the DOM input on top; a deletion just
        // leaves the cover (erased). Everything else is redrawn here.
        if ((editing?.lineId === line.id && editing?.i === it.i) || !it.e.text.trim()) continue;
        ctx.font = cssFont(it.e.family, it.e.bold, it.e.italic, it.size);
        ctx.fillStyle = it.e.color;
        ctx.fillText(it.e.text, it.xFrac * disp.w, baseY);
      }
    }
    // Cover every edited/active paragraph block so the original text is hidden and
    // the DOM text box (rendered in the real font) shows on a clean background.
    const padY = 0.35; // fraction of a line's height bled above/below the block
    for (const b of pageBlocks) {
      if (b.id !== editingBlock && !blockChanged(b)) continue;
      const bgFill = /^rgb\(\s*\d/.test(b.bg) ? b.bg : 'rgb(255,255,255)';
      ctx.fillStyle = bgFill;
      ctx.fillRect((b.x - b.w * 0.004) * disp.w, (b.y - b.size * padY) * disp.h, (b.w + b.w * 0.02) * disp.w, (b.h + b.size * padY * 2) * disp.h);
    }
    // Hover outline for the block under the cursor (so it reads as clickable).
    const hb = hover ? pageBlocks.find((b) => b.id === hover) : null;
    if (hb && hb.id !== editingBlock) {
      const pad = hb.size * 0.3;
      ctx.strokeStyle = 'rgba(79,70,229,0.5)'; ctx.fillStyle = 'rgba(79,70,229,0.06)'; ctx.lineWidth = 1;
      const rx = (hb.x - hb.w * 0.004) * disp.w, ry = (hb.y - pad) * disp.h, rw = (hb.w + hb.w * 0.02) * disp.w, rh = (hb.h + pad * 2) * disp.h;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 4); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(rx, ry, rw, rh); ctx.strokeRect(rx, ry, rw, rh); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLines, edits, hover, editing, disp, pageBlocks, editingBlock, blockEdits, blockStyle]);

  useEffect(() => { paintOverlay(); }, [paintOverlay, preview, fontReady]);

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
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setLines({}); setEdits({}); setPast([]); setFuture([]); setAdded([]); setAddSel(null); setAddMode(false); setBlocks({}); setBlockEdits({}); setBlockStyle({}); setEditingBlock(null); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            {/* Premium formatting toolbar — acts on the selected word. While a word
                is being edited, DON'T let toolbar clicks steal focus from the input
                (that blur used to commit + exit edit mode before the style applied),
                so font/size/bold/italic/colour change live as you type. */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-soft"
              onMouseDown={(e) => { if (editing || activeAdded) e.preventDefault(); }}>
              <button className={`${tbBtn} gap-1.5 w-auto px-2.5 ${addMode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Add a new text box — then click where you want it" aria-pressed={addMode} onClick={() => { setAddMode((m) => !m); closeWord(); }}><TextCursorInput className="size-4" /> <span className="text-xs font-medium">Add text</span></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <FontSelect value={selFamily} onChange={(f) => patchSel({ family: f })} className="w-40" />
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} hover:bg-accent`} title="Smaller" disabled={!hasSel} onClick={() => patchSel({ size: Math.max(0.006, selSizeFrac * 0.92) })}><Minus className="size-4" /></button>
              <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">{hasSel ? Math.round(selSizePx) : '—'}</span>
              <button className={`${tbBtn} hover:bg-accent`} title="Larger" disabled={!hasSel} onClick={() => patchSel({ size: Math.min(0.2, selSizeFrac * 1.08) })}><Plus className="size-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} ${selBold && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Bold" aria-pressed={selBold} disabled={!hasSel || !selFamInfo?.bold} onClick={() => patchSel({ bold: !selBold })}><Bold className="size-4" /></button>
              <button className={`${tbBtn} ${selItalic && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Italic" aria-pressed={selItalic} disabled={!hasSel || !selFamInfo?.italic} onClick={() => patchSel({ italic: !selItalic })}><Italic className="size-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <div className="flex items-center gap-1 px-0.5">
                {SWATCHES.map((c) => (
                  <button key={c} disabled={!hasSel} aria-label={`colour ${c}`} aria-pressed={selColor === c} onClick={() => patchSel({ color: c })}
                    className={`size-5 rounded-full ring-offset-1 ring-offset-card transition-all disabled:opacity-40 ${selColor === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} text-destructive hover:bg-destructive/10`} title={activeAdded ? 'Delete this text box' : 'Delete this word'} disabled={!hasSel} onClick={deleteSel}><Trash2 className="size-4" /></button>
              <div className="ml-auto flex items-center gap-1">
                <button className={`${tbBtn} hover:bg-accent`} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 className="size-4" /></button>
                <button className={`${tbBtn} hover:bg-accent`} title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}><Redo2 className="size-4" /></button>
              </div>
            </div>

            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Pencil className="size-3.5 text-primary" />
              {addMode ? 'Click anywhere on the page to drop a new text box.' : activeAdded ? 'Editing a text box — type, format, or drag it to move. Delete removes it.' : activeBlock ? 'Editing a paragraph — type freely; the text wraps and stays in the PDF’s font. Click outside when done.' : 'Click a paragraph to edit its text, or use “Add text”.'}
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
                  <div className="absolute inset-0" style={{ cursor: addMode ? 'crosshair' : hover ? 'text' : 'default' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} />

                  {/* the live editor input — positioned exactly over its word */}
                  {activeLine && activeEdit && editing && disp.h > 0 && activeLine.boxes[editing.i] && (() => {
                    const box = activeLine.boxes[editing.i]!;
                    const plan = linePlan(activeLine);
                    const item = plan?.items.find((it) => it.i === editing.i);
                    const size = item ? item.size : matchedSize(activeLine, box, activeEdit);
                    const xFrac = item ? item.xFrac : box.x;
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
                        style={{ left: `${xFrac * disp.w}px`, top: `${baselinePx - BASELINE * size}px`, width: `${Math.max(newWpx, box.w * disp.w, size) + 4}px`, height: `${size * 1.2}px`, lineHeight: `${size * 1.2}px`, fontFamily: RENDER_CSS[activeEdit.family] ?? FAMILIES[activeEdit.family].css, fontSize: `${size}px`, fontWeight: activeEdit.bold ? 700 : 400, fontStyle: activeEdit.italic ? 'italic' : 'normal', color: activeEdit.color, background: activeLine.bg, caretColor: '#4f46e5' }}
                      />
                    );
                  })()}

                  {/* Committed edited paragraphs (not the one being typed) show as
                      static text in the PDF's real font. */}
                  {disp.h > 0 && pageBlocks.map((b) => {
                    if (b.id === editingBlock || !blockChanged(b)) return null;
                    const st = blockStyleOf(b); const fs = st.size * disp.h;
                    const style: React.CSSProperties = {
                      left: `${b.x * disp.w}px`, top: `${b.y * disp.h - fs * 0.08}px`, width: `${(b.w + b.w * 0.02) * disp.w}px`, minHeight: `${b.h * disp.h + fs * 0.3}px`,
                      fontFamily: RENDER_CSS[st.family] ?? FAMILIES[st.family].css, fontSize: `${fs}px`, fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal',
                      color: st.color, lineHeight: b.lineH / b.size, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: /^rgb\(\s*\d/.test(b.bg) ? b.bg : '#ffffff',
                    };
                    return (
                      <div key={b.id} onClick={(e) => { e.stopPropagation(); openBlock(b); }} className="absolute z-20 cursor-text rounded-[2px] px-[1px]" style={style}>{blockTextOf(b)}</div>
                    );
                  })}
                  {/* The paragraph being edited — an ISOLATED editable box (Smallpdf
                      style): type freely, the browser wraps inside the block width. */}
                  {activeBlock && disp.h > 0 && (
                    <BlockEditText key={activeBlock.id} initialText={blockTextOf(activeBlock)} style={activeBlockStyle} onInput={onBlockInput} onDone={closeBlock} />
                  )}

                  {/* Added text boxes (new content the user placed). Selected =
                      editable input; otherwise a draggable label (click to edit,
                      drag to move). Rendered in the SAME font the PDF uses. */}
                  {disp.h > 0 && added.filter((a) => a.page === sel).map((a) => {
                    const left = a.x * disp.w, top = a.y * disp.h, size = a.sizeFrac * disp.h;
                    const fam = RENDER_CSS[a.family] ?? FAMILIES[a.family].css;
                    const common: React.CSSProperties = { left: `${left}px`, top: `${top}px`, fontFamily: fam, fontSize: `${size}px`, fontWeight: a.bold ? 700 : 400, fontStyle: a.italic ? 'italic' : 'normal', color: a.color, lineHeight: 1.1 };
                    if (a.id === addSel) {
                      return (
                        <input key={a.id} ref={addInputRef} value={a.text} placeholder="Type…"
                          onChange={(ev) => patchAdded({ text: ev.target.value })}
                          onKeyDown={(ev) => {
                            const mod = ev.ctrlKey || ev.metaKey;
                            if (ev.key === 'Escape' || ev.key === 'Enter') { ev.preventDefault(); if (ev.key === 'Escape' && !a.text.trim()) deleteAdded(); else setAddSel(null); }
                            else if (mod && ev.key.toLowerCase() === 'b') { ev.preventDefault(); if (selFamInfo?.bold) patchAdded({ bold: !a.bold }); }
                            else if (mod && ev.key.toLowerCase() === 'i') { ev.preventDefault(); if (selFamInfo?.italic) patchAdded({ italic: !a.italic }); }
                          }}
                          className="absolute z-30 rounded-[2px] border-0 p-0 outline-none ring-2 ring-primary/70"
                          style={{ ...common, width: `${Math.max(size * 2, measureWidth(a.text || 'Type…', cssFont(a.family, a.bold, a.italic, size)) + 8)}px`, height: `${size * 1.3}px`, background: 'rgba(255,255,255,0.65)', caretColor: '#4f46e5' }}
                        />
                      );
                    }
                    return (
                      <div key={a.id} role="button" tabIndex={0}
                        onPointerDown={(e) => { e.stopPropagation(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ } const r = wrapRef.current!.getBoundingClientRect(); dragRef.current = { id: a.id, dx: e.clientX - (r.left + left), dy: e.clientY - (r.top + top), moved: false }; }}
                        onPointerMove={(e) => { const d = dragRef.current; if (!d || d.id !== a.id) return; const r = wrapRef.current!.getBoundingClientRect(); const nx = (e.clientX - d.dx - r.left) / r.width, ny = (e.clientY - d.dy - r.top) / r.height; if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) d.moved = true; setAdded((prev) => prev.map((x) => (x.id === a.id ? { ...x, x: Math.max(0, Math.min(0.99, nx)), y: Math.max(0, Math.min(0.99, ny)) } : x))); }}
                        onPointerUp={() => { const d = dragRef.current; dragRef.current = null; if (d && !d.moved) { closeWord(); setAddSel(a.id); } }}
                        className="absolute z-20 cursor-move select-none whitespace-pre rounded-[2px] ring-1 ring-transparent hover:ring-primary/40"
                        style={common}
                      >{a.text || <span style={{ color: '#9ca3af' }}>Text</span>}</div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { closeWord(); setAddSel(null); setAddMode(false); setEditingBlock(null); setSel(i); }} className="mt-2" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {totalChanges
                ? `${[blockCount && `${blockCount} paragraph${blockCount === 1 ? '' : 's'} edited`, addedCount && `${addedCount} text box${addedCount === 1 ? '' : 'es'} added`].filter(Boolean).join(' · ')} — edits stay in your browser.`
                : 'Click a paragraph to edit its text, or use “Add text” to drop new text anywhere. Scanned pages have no selectable text.'}
            </p>
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {file && !done && (
          <Button className="mt-4 w-full" size="lg" onClick={apply} disabled={busy || totalChanges === 0}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Pencil className="size-4" /> Save edited PDF</>}
          </Button>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/edit-pdf" fromLabel="Edit PDF" />}
      </CardContent>
    </Card>
  );
}
