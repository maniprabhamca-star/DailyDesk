'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { Upload, FileText, X, Loader2, Pencil, Undo2, Redo2, Bold, Italic, Trash2, Minus, Plus, Zap, TextCursorInput, Highlighter, Pen, Square, Circle, ArrowUpRight, ChevronDown, Signature as SignatureIcon, ImagePlus, Move, Maximize2, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, Stamp as StampIcon, Link as LinkIcon, RotateCw } from 'lucide-react';
import { SignatureMaker } from './signature-maker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { rewritePdf } from '@/lib/pdf-rewrite';
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
  family: Family; color: string; bg: string; bold: boolean; italic: boolean; link?: string;
  parts: string[];                                        // words + whitespace, in order
  boxes: (WordBox | null)[];                              // per-word box (refined on click)
};
type WordBox = { x: number; y: number; w: number; h: number; inkTop?: number; inkH?: number };
type Edit = { text: string; family: Family; size: number; color: string; bold: boolean; italic: boolean; underline?: boolean; strike?: boolean; link?: string };
type EditMap = Record<string, Edit>;
type TextAlign = 'left' | 'center' | 'right';
// A brand-new text box the user placed (independent of the PDF's own text).
type Added = { id: string; page: number; x: number; y: number; sizeFrac: number; text: string; family: Family; color: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; align: TextAlign; link?: string };

type ShapeKind = 'rect' | 'circle' | 'line' | 'arrow';
type EditorTool = 'paragraph' | 'add-text' | 'highlight' | 'pen' | 'stamp' | ShapeKind;
type Pt = { x: number; y: number };
type Stroke = { kind: 'pen' | 'highlight'; color: string; w: number; pts: Pt[] };
type ShapeMarkup = { kind: ShapeKind; color: string; w: number; a: Pt; b: Pt };
type StampMarkup = { kind: 'stamp'; color: string; text: string; x: number; y: number; w: number; h: number };
type Markup = Stroke | ShapeMarkup | StampMarkup;
type ImageItem = {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  aspect: number;
  src: string;
  rot: number;
  source?: 'added' | 'pdf';
  orig?: { x: number; y: number; w: number; h: number };
  bg?: string;
  changed?: boolean;
  deleted?: boolean;
};

const SHAPE_KINDS: ShapeKind[] = ['rect', 'circle', 'line', 'arrow'];
const isShape = (t: EditorTool): t is ShapeKind => (SHAPE_KINDS as string[]).includes(t);
const isMarkupTool = (t: EditorTool) => t === 'highlight' || t === 'pen' || isShape(t);
const MARKUP_COLORS = ['#111827', '#ef4444', '#2563eb', '#16a34a', '#7c3aed', '#facc15'];
const STAMP_PRESETS = ['APPROVED', 'DRAFT', 'CONFIDENTIAL', 'VOID', 'COMPLETED', 'SIGN HERE', 'AS IS'];

function strokeWidthFrac(tool: EditorTool, weight: number) {
  if (tool === 'highlight') return weight * 0.006;
  return weight * 0.0012;
}

function paintMarkups(ctx: CanvasRenderingContext2D, W: number, H: number, list: Markup[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of list) {
    if (a.kind === 'stamp') {
      const x = a.x * W, y = a.y * H, w = a.w * W, h = a.h * H;
      const fontSize = Math.max(12, Math.min(h * 0.48, w / Math.max(5, a.text.length * 0.72)));
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = Math.max(2, h * 0.045);
      ctx.font = `italic 700 ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(8, h * 0.18));
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, w, h);
      }
      ctx.fillText(a.text, x + w / 2, y + h / 2);
      ctx.restore();
      continue;
    }

    if (a.kind === 'pen' || a.kind === 'highlight') {
      ctx.globalAlpha = a.kind === 'highlight' ? 0.38 : 1;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, a.w * W);
      ctx.beginPath();
      a.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
      if (a.pts.length === 1) ctx.lineTo(a.pts[0].x * W + 0.1, a.pts[0].y * H);
      ctx.stroke();
      continue;
    }

    const s = a as ShapeMarkup;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(2, s.w * W);
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 2;
    const ax = s.a.x * W, ay = s.a.y * H, bx = s.b.x * W, by = s.b.y * H;
    if (s.kind === 'rect') {
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    } else if (s.kind === 'circle') {
      const cx = (ax + bx) / 2, cy = (ay + by) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, Math.abs(bx - ax) / 2), Math.max(1, Math.abs(by - ay) / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (s.kind === 'arrow') {
        const ang = Math.atan2(by - ay, bx - ax);
        const head = Math.max(10, s.w * W * 3.4);
        const spread = Math.PI / 7;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx - head * Math.cos(ang - spread), by - head * Math.sin(ang - spread));
        ctx.moveTo(bx, by); ctx.lineTo(bx - head * Math.cos(ang + spread), by - head * Math.sin(ang + spread));
        ctx.stroke();
      }
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

// A paragraph BLOCK — the Smallpdf-style unit you edit: one or more detected
// line-runs grouped into a box you type into freely (browser wraps the text).
type Block = {
  id: string; page: number;
  x: number; y: number; w: number; h: number;   // bounding box (top-left + size, fractions)
  family: Family; size: number; color: string; bold: boolean; italic: boolean; bg: string; link?: string;
  lineH: number;                                  // line-to-line spacing (fraction of page height)
  align: TextAlign;
  text: string;                                   // full text, original line breaks kept as \n
};
type BlockStylePatch = Partial<Pick<Block, 'family' | 'size' | 'color' | 'bold' | 'italic'> & { underline: boolean; strike: boolean; align: TextAlign; link: string }>;
type BlockLayout = { x: number; y: number; w: number; h: number };
type EditorSnapshot = {
  edits: EditMap;
  blockEdits: Record<string, string>;
  blockStyle: Record<string, BlockStylePatch>;
  blockLayout: Record<string, BlockLayout>;
  added: Added[];
  markups: Record<number, Markup[]>;
  images: ImageItem[];
};

function rgbNums(color: string): [number, number, number] | null {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cssRgb(r: number, g: number, b: number) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function colorFromPdfArgs(args: unknown[] | undefined, mode: 'rgb' | 'gray' | 'cmyk'): string | null {
  if (!args?.length) return null;
  const raw = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
  const nums = raw.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  const toByte = (v: number) => (v <= 1 ? v * 255 : v);
  if (mode === 'gray') {
    const g = toByte(nums[0] ?? 0);
    return cssRgb(g, g, g);
  }
  if (mode === 'cmyk') {
    const [c = 0, m = 0, y = 0, k = 0] = nums.map((v) => (v > 1 ? v / 100 : v));
    return cssRgb(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k));
  }
  return cssRgb(toByte(nums[0] ?? 0), toByte(nums[1] ?? 0), toByte(nums[2] ?? 0));
}

function textColorsFromOperatorList(ops: { fnArray: number[]; argsArray: unknown[][] }, OPS: Record<string, number>): string[] {
  const textOps = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText].filter((n) => typeof n === 'number'));
  const colors: string[] = [];
  let fill = '';
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.setFillRGBColor) fill = colorFromPdfArgs(args, 'rgb') ?? fill;
    else if (fn === OPS.setFillGray) fill = colorFromPdfArgs(args, 'gray') ?? fill;
    else if (fn === OPS.setFillCMYKColor) fill = colorFromPdfArgs(args, 'cmyk') ?? fill;
    else if (textOps.has(fn)) colors.push(fill);
  }
  return colors;
}

function colorDistance(a: string, b: string): number {
  const ca = rgbNums(a), cb = rgbNums(b);
  if (!ca || !cb) return 999;
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]);
}

function looksLikeLinkColor(color: string): boolean {
  const c = rgbNums(color);
  return !!c && c[2] > c[0] + 30 && c[2] > c[1] + 15;
}

// Group detected line-runs into paragraph blocks: lines that sit directly under
// one another, share a left edge / overlap horizontally, and are the same size
// belong to the same block. This is what lets a whole paragraph be edited at once.
function groupBlocks(lines: Line[], page: number): Block[] {
  const rows = lines
    .map((l) => ({ top: l.y, bottom: l.y + l.h, left: l.x, right: l.x + l.w, h: l.h, text: l.parts.join(''), family: l.family, color: l.color, bold: l.bold, italic: l.italic, bg: l.bg, link: l.link }))
    .filter((r) => r.text.trim())
    .sort((a, b) => (Math.abs(a.top - b.top) > a.h * 0.4 ? a.top - b.top : a.left - b.left));
  const blocks: Block[] = [];
  let cur: typeof rows | null = null;
  const flush = () => {
    if (!cur || !cur.length) return;
    const x = Math.min(...cur.map((r) => r.left)), right = Math.max(...cur.map((r) => r.right));
    const y = Math.min(...cur.map((r) => r.top)), bottom = Math.max(...cur.map((r) => r.bottom));
    const first = cur[0];
    const w = right - x;
    const center = x + w / 2;
    const align: TextAlign = w < 0.58 && Math.abs(center - 0.5) < 0.12 ? 'center' : 'left';
    // median line spacing (baseline-to-baseline); fall back to 1.2× height.
    const gaps: number[] = [];
    for (let i = 1; i < cur.length; i++) gaps.push(cur[i].top - cur[i - 1].top);
    gaps.sort((a, b) => a - b);
    const lineH = gaps.length ? gaps[Math.floor(gaps.length / 2)] : first.h * 1.2;
    const sameLink = cur.every((r) => (r.link || '') === (first.link || ''));
    blocks.push({ id: `${page}-B${blocks.length}`, page, x, y, w, h: bottom - y, family: first.family, size: first.h, color: first.color, bold: first.bold, italic: first.italic, bg: first.bg, link: sameLink ? first.link : undefined, lineH, align, text: cur.map((r) => r.text).join('\n') });
    cur = null;
  };
  for (const r of rows) {
    if (!cur) { cur = [r]; continue; }
    const prev = cur[cur.length - 1];
    const vGap = r.top - prev.bottom;                                  // vertical gap to previous line
    const sameCol = r.left < prev.right && r.right > prev.left;        // horizontal overlap (same column)
    const sameSize = Math.abs(r.h - prev.h) <= prev.h * 0.35;          // similar font size
    const sameStyle = r.family === prev.family && colorDistance(r.color, prev.color) < 90;
    const closeEnough = vGap >= -prev.h * 0.5 && vGap <= prev.h * 0.9; // stacked (paragraph spacing)
    if (sameCol && sameSize && sameStyle && closeEnough) cur.push(r);
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
  return { text: line.parts[i], family: line.family, size: line.h, color: line.color, bold: line.bold, italic: line.italic, underline: looksLikeLinkColor(line.color) || !!line.link, strike: false, link: line.link };
}
function editOf(line: Line, i: number, edits: EditMap): Edit {
  return edits[key(line.id, i)] ?? defaultEdit(line, i);
}
function partEdited(line: Line, i: number, e: Edit): boolean {
  const baseUnderline = looksLikeLinkColor(line.color) || !!line.link;
  return e.text !== line.parts[i] || e.family !== line.family || e.color !== line.color || e.bold !== line.bold || e.italic !== line.italic || Math.abs(e.size - line.h) > 1e-4 || (e.link || '') !== (line.link || '') || !!e.strike || !!e.underline !== baseUnderline;
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
  const [blockStyle, setBlockStyle] = useState<Record<string, BlockStylePatch>>({});
  const [blockLayout, setBlockLayout] = useState<Record<string, BlockLayout>>({});
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
  const [tool, setTool] = useState<EditorTool>('paragraph');
  const [markupColor, setMarkupColor] = useState(MARKUP_COLORS[0]);
  const [markupWeight, setMarkupWeight] = useState(4);
  const [shape, setShape] = useState<ShapeKind>('rect');
  const [shapesOpen, setShapesOpen] = useState(false);
  const [stampLabel, setStampLabel] = useState(STAMP_PRESETS[0]);
  const [stampsOpen, setStampsOpen] = useState(false);
  const [customStampText, setCustomStampText] = useState('');
  const [customStamps, setCustomStamps] = useState<string[]>([]);
  const [markups, setMarkups] = useState<Record<number, Markup[]>>({});
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selImg, setSelImg] = useState<string | null>(null);
  const [selStamp, setSelStamp] = useState<number | null>(null);
  const [hoverStamp, setHoverStamp] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [sigOpen, setSigOpen] = useState(false);
  // Add-text (new boxes the user places), separate from the PDF's own words.
  const [added, setAdded] = useState<Added[]>([]);
  const [addSel, setAddSel] = useState<string | null>(null); // id being edited
  const [addMode, setAddMode] = useState(false);             // click-to-place armed
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const imgFileRef = useRef<HTMLInputElement>(null);
  const imgDrag = useRef<{ id: string; mode: 'move' | 'resize' | 'rotate'; ox: number; oy: number; startW: number; startRot: number; cx: number; cy: number; startAngle: number } | null>(null);
  const stampDrag = useRef<{ index: number; dx: number; dy: number } | null>(null);
  const blockDrag = useRef<{ id: string; mode: 'move' | 'resize-e' | 'resize-s' | 'resize-se'; startX: number; startY: number; start: BlockLayout } | null>(null);
  const shapesRef = useRef<HTMLDivElement>(null);
  const stampsRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const liveMarkup = useRef<Markup | null>(null);

  const [past, setPast] = useState<EditMap[]>([]);
  const [future, setFuture] = useState<EditMap[]>([]);
  const [historyPast, setHistoryPast] = useState<EditorSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<EditorSnapshot[]>([]);
  const sessionRef = useRef<EditMap | null>(null);
  const blockInputSession = useRef(false);
  const addedInputSession = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true);
    setLines({}); setEdits({}); setEditing(null); setPreview(null); setPast([]); setFuture([]);
    setHistoryPast([]); setHistoryFuture([]); blockInputSession.current = false; addedInputSession.current = false;
    setAdded([]); setAddSel(null); setAddMode(false);
    setBlocks({}); setBlockEdits({}); setBlockStyle({}); setBlockLayout({}); setEditingBlock(null);
    setTool('paragraph'); setMarkups({}); setImages([]); setSelImg(null); setSelStamp(null); setSigOpen(false); setStampsOpen(false); setLinkOpen(false); imgCache.current.clear();
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
        let opList: { fnArray: number[]; argsArray: unknown[][] } | null = null;
        try { opList = await page.getOperatorList() as { fnArray: number[]; argsArray: unknown[][] }; } catch { opList = null; }
        const textColors = opList ? textColorsFromOperatorList(opList, pdfjs.OPS as Record<string, number>) : [];
        const linkAnnots: Array<{ left: number; top: number; right: number; bottom: number; url: string }> = [];
        try {
          const annots = await page.getAnnotations({ intent: 'display' }) as Array<{ subtype?: string; url?: string; unsafeUrl?: string; rect?: number[] }>;
          for (const a of annots) {
            const url = a.url || a.unsafeUrl;
            if (a.subtype !== 'Link' || !url || !a.rect) continue;
            const toViewportRect = (vp as unknown as { convertToViewportRectangle?: (rect: number[]) => number[] }).convertToViewportRectangle;
            const rect = toViewportRect ? toViewportRect.call(vp, pdfjs.Util.normalizeRect(a.rect)) : pdfjs.Util.normalizeRect(a.rect);
            const [left, top, right, bottom] = pdfjs.Util.normalizeRect(rect);
            linkAnnots.push({ left, top, right, bottom, url });
          }
        } catch { /* annotations are optional */ }
        const linkAt = (left: number, top: number, width: number, height: number) =>
          linkAnnots.find((a) => left <= a.right && left + width >= a.left && top <= a.bottom && top + height >= a.top)?.url;
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
        const bgCss = cssRgb(pageBg[0], pageBg[1], pageBg[2]);

        type PdfImg = { bitmap?: ImageBitmap; data?: Uint8ClampedArray; width?: number; height?: number; kind?: number };
        const imageToUrl = async (img: PdfImg): Promise<string | null> => {
          if (!img.width || !img.height) return null;
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
          else if (img.data) {
            const px = new Uint8ClampedArray(img.width * img.height * 4);
            const srcData = img.data;
            if (img.kind === 3) px.set(srcData);
            else if (img.kind === 2) {
              for (let p = 0, s = 0; p < px.length; p += 4) { px[p] = srcData[s++]; px[p + 1] = srcData[s++]; px[p + 2] = srcData[s++]; px[p + 3] = 255; }
            } else if (img.kind === 1) {
              const stride = Math.ceil(img.width / 8);
              for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                  const bit = (srcData[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1;
                  const v = bit ? 255 : 0;
                  const p = (y * img.width + x) * 4;
                  px[p] = v; px[p + 1] = v; px[p + 2] = v; px[p + 3] = 255;
                }
              }
            } else return null;
            ctx.putImageData(new ImageData(px, img.width, img.height), 0, 0);
          } else return null;
          return canvas.toDataURL('image/png');
        };
        const readPdfImage = async (objId: string): Promise<PdfImg | null> => {
          const store = objId.startsWith('g_') ? page.commonObjs : page.objs;
          return new Promise((resolve) => {
            let settled = false;
            const t = window.setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 4000);
            try {
              store.get(objId, (v: unknown) => { if (!settled) { settled = true; window.clearTimeout(t); resolve(v as PdfImg); } });
            } catch {
              window.clearTimeout(t);
              if (!settled) { settled = true; resolve(null); }
            }
          });
        };
        const detectEmbeddedImages = async () => {
          if (!opList) return [] as ImageItem[];
          const OPS = pdfjs.OPS as Record<string, number>;
          type M = [number, number, number, number, number, number];
          const stack: M[] = [];
          let ctm: M = [1, 0, 0, 1, 0, 0];
          const transform = (a: M, b: unknown[]): M => pdfjs.Util.transform(a, b as number[]) as M;
          const apply = (m: M, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;
          const found: ImageItem[] = [];
          const seen = new Set<string>();
          for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i];
            const args = opList.argsArray[i] || [];
            if (fn === OPS.save) { stack.push([...ctm] as M); continue; }
            if (fn === OPS.restore) { ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
            if (fn === OPS.transform) { ctm = transform(ctm, args); continue; }
            if (fn !== OPS.paintImageXObject && fn !== OPS.paintJpegXObject && fn !== OPS.paintInlineImageXObject) continue;
            const objId = typeof args[0] === 'string' ? args[0] as string : '';
            const img = objId ? await readPdfImage(objId) : (args[0] as PdfImg | undefined) || null;
            if (!img?.width || !img.height || img.width < 24 || img.height < 24) continue;
            const m = pdfjs.Util.transform(vp.transform, ctm) as M;
            const pts = [apply(m, 0, 0), apply(m, 1, 0), apply(m, 0, 1), apply(m, 1, 1)];
            const left = Math.min(...pts.map((p) => p[0]));
            const right = Math.max(...pts.map((p) => p[0]));
            const top = Math.min(...pts.map((p) => p[1]));
            const bottom = Math.max(...pts.map((p) => p[1]));
            const wPx = Math.abs(right - left);
            const hPx = Math.abs(bottom - top);
            if (wPx < vp.width * 0.035 || hPx < vp.height * 0.018) continue;
            const sig = `${Math.round(left)}_${Math.round(top)}_${Math.round(wPx)}_${Math.round(hPx)}_${objId || i}`;
            if (seen.has(sig)) continue;
            seen.add(sig);
            const url = await imageToUrl(img);
            if (!url) continue;
            const id = `P${sel}-${sig}`;
            const item: ImageItem = {
              id,
              page: sel,
              x: Math.max(0, left / vp.width),
              y: Math.max(0, top / vp.height),
              w: Math.min(1, wPx / vp.width),
              aspect: hPx / Math.max(1, wPx),
              src: url,
              rot: 0,
              source: 'pdf',
              bg: bgCss,
              orig: { x: Math.max(0, left / vp.width), y: Math.max(0, top / vp.height), w: Math.min(1, wPx / vp.width), h: Math.min(1, hPx / vp.height) },
              changed: false,
            };
            const el = new Image();
            el.src = url;
            try { await el.decode(); } catch { /* still usable once loaded */ }
            imgCache.current.set(url, el);
            found.push(item);
          }
          return found;
        };
        const detectedPdfImages = await detectEmbeddedImages();
        if (!cancelled && detectedPdfImages.length) {
          setImages((prev) => {
            if (prev.some((im) => im.source === 'pdf' && im.page === sel)) return prev;
            return [...prev, ...detectedPdfImages];
          });
        }
        // Resolve each pdf.js loadedName ("g_d0_f2") to the PDF's REAL font
        // ("Calibri") via commonObjs, so edits redraw in the matching family. The
        // page was already rendered above, so the fonts are loaded (getOperatorList
        // is cached and cheap; it just guarantees they're resolvable here).
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
        let textColorIndex = 0;
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
          const link = linkAt(left, top, w, fontH);
          const sampled = sample(left, left + w, top, fontH);
          const color = textColors[textColorIndex++] || sampled.color;
          const bg = sampled.bg;
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
          list.push({ id: `${sel}-L${list.length}`, page: sel, x: left / vp.width, y: top / vp.height, w: w / vp.width, h: fontH / vp.height, inkH, family, color, bg, bold, italic, link, parts, boxes });
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

  function snapshotEditor(): EditorSnapshot {
    return { edits, blockEdits, blockStyle, blockLayout, added, markups, images };
  }
  function restoreEditor(snap: EditorSnapshot) {
    setEdits(snap.edits);
    setBlockEdits(snap.blockEdits);
    setBlockStyle(snap.blockStyle);
    setBlockLayout(snap.blockLayout);
    setAdded(snap.added);
    setMarkups(snap.markups);
    setImages(snap.images);
    setEditing(null); setEditingBlock(null); setAddSel(null); setSelImg(null); setSelStamp(null); setLinkOpen(false);
    sessionRef.current = null; blockInputSession.current = false; addedInputSession.current = false; liveMarkup.current = null; drawing.current = false; stampDrag.current = null;
  }
  function pushHistory() {
    setHistoryPast((p) => [...p, snapshotEditor()]);
    setHistoryFuture([]);
  }

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
  const blockStyleOf = (b: Block) => { const o = blockStyle[b.id] || {}; return { family: o.family ?? b.family, size: o.size ?? b.size, color: o.color ?? b.color, bold: o.bold ?? b.bold, italic: o.italic ?? b.italic, underline: o.underline ?? (looksLikeLinkColor(b.color) || !!b.link), strike: o.strike ?? false, align: o.align ?? b.align, link: o.link ?? b.link ?? '' }; };
  const blockLayoutOf = (b: Block): BlockLayout => blockLayout[b.id] || { x: b.x, y: b.y, w: b.w, h: b.h };
  const layoutChanged = (b: Block) => { const l = blockLayout[b.id]; return !!l && (Math.abs(l.x - b.x) > 1e-5 || Math.abs(l.y - b.y) > 1e-5 || Math.abs(l.w - b.w) > 1e-5 || Math.abs(l.h - b.h) > 1e-5); };
  const blockChanged = (b: Block) => (blockEdits[b.id] !== undefined && blockEdits[b.id] !== b.text) || !!blockStyle[b.id] || layoutChanged(b);
  function openBlock(b: Block) { closeWord(); setAddSel(null); blockInputSession.current = false; setEditingBlock(b.id); }
  function closeBlock() { blockInputSession.current = false; setEditingBlock(null); }
  function patchBlock(patch: BlockStylePatch) { if (editingBlock) { pushHistory(); setBlockStyle((s) => ({ ...s, [editingBlock]: { ...s[editingBlock], ...patch } })); } }
  function hitBlock(p: { x: number; y: number }): Block | null {
    for (let i = pageBlocks.length - 1; i >= 0; i--) { const b = pageBlocks[i]; const l = blockLayoutOf(b); if (p.x >= l.x - 0.006 && p.x <= l.x + l.w + 0.006 && p.y >= l.y - 0.006 && p.y <= l.y + l.h + 0.006) return b; }
    return null;
  }
  // Stable style + input handler for the isolated editor (so it never re-renders
  // mid-typing).
  const activeBlockStyle = useMemo<React.CSSProperties>(() => {
    const b = activeBlock; if (!b || !disp.h) return {};
    const l = blockLayoutOf(b);
    const st = blockStyleOf(b); const fs = st.size * disp.h;
    return { left: `${l.x * disp.w}px`, top: `${l.y * disp.h - fs * 0.08}px`, width: `${(l.w + l.w * 0.02) * disp.w}px`, minHeight: `${l.h * disp.h + fs * 0.3}px`, fontFamily: RENDER_CSS[st.family] ?? FAMILIES[st.family].css, fontSize: `${fs}px`, fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal', textDecorationLine: [(st.underline || st.link) && 'underline', st.strike && 'line-through'].filter(Boolean).join(' ') || 'none', textAlign: st.align, color: st.color, lineHeight: (b.lineH / b.size), whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: /^rgb\(\s*\d/.test(b.bg) ? b.bg : '#ffffff', caretColor: '#4f46e5' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock, disp.h, disp.w, blockStyle, blockLayout]);
  const onBlockInput = useCallback((t: string) => {
    if (!editingBlock) return;
    if (!blockInputSession.current) { pushHistory(); blockInputSession.current = true; }
    setBlockEdits((s) => ({ ...s, [editingBlock]: t }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBlock, edits, blockEdits, blockStyle, blockLayout, added, markups, images]);

  // ---- Add-text: new boxes placed anywhere on the page -----------------------
  const activeAdded = addSel ? added.find((a) => a.id === addSel) ?? null : null;
  function placeAdded(fx: number, fy: number) {
    closeWord();
    pushHistory();
    const id = `A${Math.random().toString(36).slice(2, 8)}`;
    setAdded((prev) => [...prev, { id, page: sel, x: Math.max(0, Math.min(0.98, fx)), y: Math.max(0, Math.min(0.97, fy)), sizeFrac: 0.022, text: '', family: 'helvetica', color: '#111827', bold: false, italic: false, underline: false, strike: false, align: 'left' }]);
    setAddSel(id);
    setAddMode(false);
  }
  function patchAdded(patch: Partial<Added>, record = true) { if (addSel) { if (record) pushHistory(); setAdded((prev) => prev.map((a) => (a.id === addSel ? { ...a, ...patch } : a))); } }
  function patchAddedText(text: string) {
    if (!addSel) return;
    if (!addedInputSession.current) { pushHistory(); addedInputSession.current = true; }
    patchAdded({ text }, false);
  }
  function deleteAdded(id = addSel) {
    if (!id) return;
    pushHistory();
    setAdded((prev) => prev.filter((a) => a.id !== id));
    if (addSel === id) setAddSel(null);
  }

  function startAddedDrag(e: React.PointerEvent<HTMLElement>, a: Added, keepSelected = false) {
    e.stopPropagation();
    e.preventDefault();
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    pushHistory();
    if (keepSelected) setAddSel(a.id);
    else setAddSel(null);
    setSelImg(null); setSelStamp(null); closeWord(); closeBlock();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragRef.current = {
      id: a.id,
      dx: e.clientX - (r.left + a.x * r.width),
      dy: e.clientY - (r.top + a.y * r.height),
      moved: false,
    };
  }

  function moveAddedDrag(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current; if (!d || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) d.moved = true;
    const nx = (e.clientX - d.dx - r.left) / r.width;
    const ny = (e.clientY - d.dy - r.top) / r.height;
    setAdded((prev) => prev.map((a) => (a.id === d.id ? { ...a, x: Math.max(0, Math.min(0.99, nx)), y: Math.max(0, Math.min(0.99, ny)) } : a)));
  }

  function stopAddedDrag(selectOnClick = false) {
    const d = dragRef.current;
    dragRef.current = null;
    if (selectOnClick && d && !d.moved) { closeWord(); setAddSel(d.id); }
  }

  function chooseTool(next: EditorTool) {
    setTool(next);
    setAddMode(next === 'add-text');
    setShapesOpen(false);
    setStampsOpen(false);
    setLinkOpen(false);
    setSelImg(null);
    setSelStamp(null);
    closeWord();
    if (next !== 'paragraph') closeBlock();
    if (next !== 'add-text') { setAddSel(null); addedInputSession.current = false; }
  }

  const imageChanged = (im: ImageItem) => im.source !== 'pdf' || !!im.changed || !!im.deleted;
  const pageImages = images.filter((i) => i.page === sel && !i.deleted);
  const markedPages = Array.from(new Set([
    ...Object.keys(markups).map(Number).filter((i) => (markups[i] || []).length > 0),
    ...images.filter(imageChanged).map((i) => i.page),
  ])).sort((a, b) => a - b);
  const normDeg = (deg: number) => ((deg % 360) + 360) % 360;

  function addImageSrc(src: string, aspect: number) {
    pushHistory();
    const el = new Image();
    el.onload = () => {
      imgCache.current.set(src, el);
      const id = Math.random().toString(36).slice(2);
      setImages((a) => [...a, { id, page: sel, x: 0.34, y: 0.42, w: 0.32, aspect, src, rot: 0, source: 'added', changed: true }]);
      setSelImg(id); setAddSel(null); closeBlock(); closeWord();
    };
    el.src = src;
  }

  function pickImageFile(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(f.type) && !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) { setError('Please choose a PNG, JPG, WebP or GIF image.'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const probe = new Image();
      probe.onload = () => addImageSrc(url, probe.naturalHeight / probe.naturalWidth);
      probe.src = url;
    };
    reader.readAsDataURL(f);
  }

  function deleteImage(id: string) {
    pushHistory();
    setImages((a) => a.flatMap((i) => {
      if (i.id !== id) return [i];
      return i.source === 'pdf' ? [{ ...i, deleted: true, changed: true }] : [];
    }));
    if (selImg === id) setSelImg(null);
  }
  function rotateImage(id: string, delta: number) { pushHistory(); setImages((a) => a.map((i) => (i.id === id ? { ...i, rot: normDeg((i.rot || 0) + delta), changed: true } : i))); }
  function imgDown(e: React.PointerEvent<HTMLElement>, id: string, mode: 'move' | 'resize' | 'rotate') {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const im = images.find((i) => i.id === id); if (!im) return;
    pushHistory();
    setSelImg(id); setSelStamp(null); setAddSel(null); closeBlock(); closeWord();
    const r = wrapRef.current?.getBoundingClientRect();
    const hFrac = r ? im.w * im.aspect * (r.width / r.height) : im.w * im.aspect;
    const cx = r ? r.left + (im.x + im.w / 2) * r.width : e.clientX;
    const cy = r ? r.top + (im.y + hFrac / 2) * r.height : e.clientY;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    imgDrag.current = { id, mode, ox: e.clientX, oy: e.clientY, startW: im.w, startRot: im.rot || 0, cx, cy, startAngle };
    if (mode === 'move' && wrapRef.current) {
      const wr = wrapRef.current.getBoundingClientRect();
      imgDrag.current.ox = e.clientX - wr.left - im.x * wr.width;
      imgDrag.current.oy = e.clientY - wr.top - im.y * wr.height;
    }
  }
  function imgMove(e: React.PointerEvent<HTMLElement>) {
    const d = imgDrag.current; if (!d || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setImages((arr) => arr.map((im) => {
      if (im.id !== d.id) return im;
      if (d.mode === 'move') {
        const hFrac = im.w * im.aspect * (r.width / r.height);
        const x = Math.min(Math.max((e.clientX - r.left - d.ox) / r.width, 0), Math.max(0, 1 - im.w));
        const y = Math.min(Math.max((e.clientY - r.top - d.oy) / r.height, 0), Math.max(0, 1 - hFrac));
        return { ...im, x, y, changed: true };
      }
      if (d.mode === 'rotate') {
        const angle = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
        const delta = (angle - d.startAngle) * 180 / Math.PI;
        return { ...im, rot: normDeg(d.startRot + delta), changed: true };
      }
      const w = Math.min(Math.max(d.startW + (e.clientX - d.ox) / r.width, 0.05), 1 - im.x);
      return { ...im, w, changed: true };
    }));
  }
  function imgUp() { imgDrag.current = null; }

  function clampBlockLayout(l: BlockLayout): BlockLayout {
    const w = Math.min(Math.max(l.w, 0.04), 1);
    const h = Math.min(Math.max(l.h, 0.018), 1);
    return {
      x: Math.min(Math.max(l.x, 0), Math.max(0, 1 - w)),
      y: Math.min(Math.max(l.y, 0), Math.max(0, 1 - h)),
      w,
      h,
    };
  }
  function blockDown(e: React.PointerEvent<HTMLElement>, b: Block, mode: 'move' | 'resize-e' | 'resize-s' | 'resize-se') {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    closeWord(); setAddSel(null); setSelImg(null); setEditingBlock(b.id);
    blockDrag.current = { id: b.id, mode, startX: e.clientX, startY: e.clientY, start: blockLayoutOf(b) };
  }
  function blockMove(e: React.PointerEvent<HTMLElement>) {
    const d = blockDrag.current; if (!d || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / r.width;
    const dy = (e.clientY - d.startY) / r.height;
    let next = d.start;
    if (d.mode === 'move') next = { ...d.start, x: d.start.x + dx, y: d.start.y + dy };
    else if (d.mode === 'resize-e') next = { ...d.start, w: d.start.w + dx };
    else if (d.mode === 'resize-s') next = { ...d.start, h: d.start.h + dy };
    else next = { ...d.start, w: d.start.w + dx, h: d.start.h + dy };
    setBlockLayout((prev) => ({ ...prev, [d.id]: clampBlockLayout(next) }));
  }
  function blockUp() { blockDrag.current = null; }

  const paintMarkupOverlay = useCallback(() => {
    const cv = markupCanvasRef.current; if (!cv || !disp.w || !disp.h) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(disp.w * dpr) || cv.height !== Math.round(disp.h * dpr)) { cv.width = Math.round(disp.w * dpr); cv.height = Math.round(disp.h * dpr); }
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, disp.w, disp.h);
    const list = [...(markups[sel] || [])];
    if (liveMarkup.current) list.push(liveMarkup.current);
    paintMarkups(ctx, disp.w, disp.h, list);
  }, [disp, markups, sel]);

  useEffect(() => { paintMarkupOverlay(); }, [paintMarkupOverlay, preview]);

  useEffect(() => {
    if (!shapesOpen) return;
    const onDown = (e: MouseEvent) => { if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) setShapesOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shapesOpen]);

  useEffect(() => {
    if (!stampsOpen) return;
    const onDown = (e: MouseEvent) => { if (stampsRef.current && !stampsRef.current.contains(e.target as Node)) setStampsOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [stampsOpen]);

  useEffect(() => {
    if (!linkOpen) return;
    const onDown = (e: MouseEvent) => { if (linkRef.current && !linkRef.current.contains(e.target as Node)) setLinkOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [linkOpen]);

  function pageFracFromClient(clientX: number, clientY: number): Pt {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) };
  }

  function onMarkupDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!preview || !isMarkupTool(tool)) return;
    const p = pageFracFromClient(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    setSelImg(null); setAddSel(null); closeBlock(); closeWord();
    liveMarkup.current = isShape(tool)
      ? { kind: tool, color: markupColor, w: strokeWidthFrac(tool, markupWeight), a: p, b: p }
      : { kind: tool, color: markupColor, w: strokeWidthFrac(tool, markupWeight), pts: [p] };
    paintMarkupOverlay();
  }

  function onMarkupMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !liveMarkup.current) return;
    const p = pageFracFromClient(e.clientX, e.clientY);
    const cur = liveMarkup.current;
    if (cur.kind === 'pen' || cur.kind === 'highlight') cur.pts.push(p);
    else (cur as ShapeMarkup).b = p;
    paintMarkupOverlay();
  }

  function onMarkupUp() {
    if (!drawing.current || !liveMarkup.current) { drawing.current = false; return; }
    const committed = liveMarkup.current;
    liveMarkup.current = null; drawing.current = false;
    if (committed.kind === 'rect' || committed.kind === 'circle') {
      if (Math.abs(committed.b.x - committed.a.x) < 0.006 || Math.abs(committed.b.y - committed.a.y) < 0.006) { paintMarkupOverlay(); return; }
    } else if (committed.kind === 'line' || committed.kind === 'arrow') {
      if (Math.hypot(committed.b.x - committed.a.x, committed.b.y - committed.a.y) < 0.01) { paintMarkupOverlay(); return; }
    }
    pushHistory();
    setMarkups((a) => ({ ...a, [sel]: [...(a[sel] || []), committed] }));
  }

  function clearPageMarkup() {
    pushHistory();
    setMarkups((a) => ({ ...a, [sel]: [] }));
    setImages((arr) => arr.flatMap((i) => {
      if (i.page !== sel) return [i];
      if (i.source === 'pdf' && i.orig) return [{ ...i, x: i.orig.x, y: i.orig.y, w: i.orig.w, aspect: i.orig.h / Math.max(0.0001, i.orig.w), rot: 0, deleted: false, changed: false }];
      return [];
    }));
    setSelImg(null); setSelStamp(null);
  }

  function addStampAt(x: number, y: number, text = stampLabel) {
    const w = Math.min(0.34, Math.max(0.16, text.length * 0.018));
    const h = 0.05;
    pushHistory();
    setMarkups((a) => ({
      ...a,
      [sel]: [
        ...(a[sel] || []),
        {
          kind: 'stamp',
          text,
          color: markupColor,
          x: Math.max(0, Math.min(1 - w, x - w / 2)),
          y: Math.max(0, Math.min(1 - h, y - h / 2)),
          w,
          h,
        },
      ],
    }));
  }
  function moveStamp(index: number, x: number, y: number) {
    setMarkups((a) => {
      const list = [...(a[sel] || [])];
      const item = list[index];
      if (!item || item.kind !== 'stamp') return a;
      list[index] = { ...item, x: Math.max(0, Math.min(1 - item.w, x)), y: Math.max(0, Math.min(1 - item.h, y)) };
      return { ...a, [sel]: list };
    });
  }
  function deleteStamp(index: number) {
    pushHistory();
    setMarkups((a) => ({ ...a, [sel]: (a[sel] || []).filter((_, i) => i !== index) }));
    setSelStamp(null); setHoverStamp(null);
  }
  function stampDown(e: React.PointerEvent<HTMLElement>, index: number) {
    e.preventDefault(); e.stopPropagation();
    const item = (markups[sel] || [])[index];
    if (!item || item.kind !== 'stamp' || !wrapRef.current) return;
    pushHistory();
    setSelStamp(index); setSelImg(null); setAddSel(null); closeBlock(); closeWord();
    const r = wrapRef.current.getBoundingClientRect();
    stampDrag.current = { index, dx: e.clientX - (r.left + item.x * r.width), dy: e.clientY - (r.top + item.y * r.height) };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function stampMove(e: React.PointerEvent<HTMLElement>) {
    const d = stampDrag.current; if (!d || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    moveStamp(d.index, (e.clientX - d.dx - r.left) / r.width, (e.clientY - d.dy - r.top) / r.height);
  }
  function stampUp() { stampDrag.current = null; }
  function selectStamp(text: string) {
    const next = text.trim().toUpperCase();
    if (!next) return;
    setStampLabel(next);
    chooseTool('stamp');
    setStampsOpen(false);
  }
  function addCustomStamp() {
    const next = customStampText.trim().toUpperCase();
    if (!next) return;
    setCustomStamps((prev) => (prev.includes(next) || STAMP_PRESETS.includes(next) ? prev : [...prev, next]));
    setCustomStampText('');
    selectStamp(next);
  }

  // Unified "current selection" for the toolbar — a word edit, added box, or paragraph.
  const activeBlockStyleEff = activeBlock ? blockStyleOf(activeBlock) : null;
  const activeImage = selImg ? images.find((i) => i.id === selImg) ?? null : null;
  const hasSel = !!activeEdit || !!activeAdded || !!activeBlock;
  const selFamily: Family = activeEdit?.family ?? activeAdded?.family ?? activeBlockStyleEff?.family ?? 'helvetica';
  const selBold = activeEdit?.bold ?? activeAdded?.bold ?? activeBlockStyleEff?.bold ?? false;
  const selItalic = activeEdit?.italic ?? activeAdded?.italic ?? activeBlockStyleEff?.italic ?? false;
  const selUnderline = activeEdit?.underline ?? activeAdded?.underline ?? activeBlockStyleEff?.underline ?? false;
  const selStrike = activeEdit?.strike ?? activeAdded?.strike ?? activeBlockStyleEff?.strike ?? false;
  const selAlign = activeAdded?.align ?? activeBlockStyleEff?.align ?? 'left';
  const selColor = activeEdit?.color ?? activeAdded?.color ?? activeBlockStyleEff?.color ?? '';
  const selLink = activeEdit?.link ?? activeAdded?.link ?? activeBlockStyleEff?.link ?? '';
  const selSizeFrac = activeEdit?.size ?? activeAdded?.sizeFrac ?? activeBlockStyleEff?.size ?? 0.02;
  const selSizePx = selSizeFrac * disp.h;
  const selFamInfo = FAMILIES[selFamily];
  function patchSel(p: { family?: Family; color?: string; bold?: boolean; italic?: boolean; size?: number; underline?: boolean; strike?: boolean; align?: TextAlign; link?: string }) {
    if (activeEdit) {
      const { align: _a, ...wordPatch } = p;
      patchActive(wordPatch);
    }
    else if (activeAdded) { const { size, ...rest } = p; patchAdded({ ...rest, ...(size !== undefined ? { sizeFrac: size } : {}) }); }
    else if (activeBlock) patchBlock(p);
  }
  function normalizeLinkInput(value: string) {
    const next = value.trim();
    if (!next) return '';
    if (/^(https?:|mailto:|tel:)/i.test(next)) return next;
    return `https://${next}`;
  }
  function openLinkMenu() {
    if (!hasSel) return;
    setLinkDraft(selLink || '');
    setLinkOpen(true);
  }
  function applyLink() {
    const url = normalizeLinkInput(linkDraft);
    patchSel({ link: url, underline: !!url });
    setLinkOpen(false);
  }
  function removeLink() {
    patchSel({ link: '', underline: false });
    setLinkDraft('');
    setLinkOpen(false);
  }
  function deleteSel() {
    if (activeEdit) deleteActive();
    else if (activeAdded) deleteAdded();
    else if (activeImage) deleteImage(activeImage.id);
    else if (activeBlock) {
      pushHistory();
      setBlockEdits((s) => { const n = { ...s }; delete n[activeBlock.id]; return n; });
      setBlockStyle((s) => { const n = { ...s }; delete n[activeBlock.id]; return n; });
      setBlockLayout((s) => { const n = { ...s }; delete n[activeBlock.id]; return n; });
      closeBlock();
    }
  }

  function undoEditor() {
    if (editing && sessionRef.current && JSON.stringify(sessionRef.current) !== JSON.stringify(edits)) {
      const prev = sessionRef.current;
      sessionRef.current = null;
      setFuture((f) => [edits, ...f]);
      setEdits(prev);
      setEditing(null);
      return;
    }
    if (historyPast.length) {
      const prev = historyPast[historyPast.length - 1];
      const current = snapshotEditor();
      setHistoryPast((p) => p.slice(0, -1));
      setHistoryFuture((f) => [current, ...f]);
      restoreEditor(prev);
      return;
    }
    undo();
  }
  function redoEditor() {
    if (historyFuture.length) {
      const next = historyFuture[0];
      const current = snapshotEditor();
      setHistoryPast((p) => [...p, current]);
      setHistoryFuture((f) => f.slice(1));
      restoreEditor(next);
      return;
    }
    redo();
  }

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
    addedInputSession.current = false;
    const id = requestAnimationFrame(() => { try { addInputRef.current?.focus(); } catch { /* ignore */ } });
    return () => cancelAnimationFrame(id);
  }, [addSel]);

  const activeMarkupTool = isMarkupTool(tool);
  const usesMarkupStyle = activeMarkupTool || tool === 'stamp';

  useEffect(() => {
    if (!file || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoEditor(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoEditor(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, done, edits, past, future, historyPast, historyFuture, blockEdits, blockStyle, blockLayout, added, markups, images]);

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
    if (tool === 'stamp') { addStampAt(p.x, p.y); return; }
    const b = hitBlock(p);
    if (b) { setAddSel(null); setSelStamp(null); setSelImg(null); openBlock(b); }             // click a paragraph = edit the whole block
    else { closeBlock(); setAddSel(null); setSelStamp(null); setSelImg(null); }               // click empty space = deselect
  }

  const editCount = pageLines.length
    ? Object.keys(edits).reduce((n, k) => { const [lineId, iStr] = k.split('#'); const p = Number(lineId.split('-')[0]); const line = (lines[p] || []).find((l) => l.id === lineId); const i = Number(iStr); return line && line.parts[i]?.trim() && partEdited(line, i, edits[k]) ? n + 1 : n; }, 0)
    : 0;
  const addedCount = added.filter((a) => a.text.trim()).length;
  const blockCount = Object.entries(blocks).reduce((n, [, bs]) => n + bs.filter((b) => blockChanged(b)).length, 0);
  const markupCount = Object.values(markups).reduce((n, list) => n + list.length, 0);
  const imageCount = images.filter(imageChanged).length;
  const totalChanges = editCount + addedCount + blockCount + markupCount + imageCount;

  async function apply() {
    if (!file || !handle || totalChanges === 0) return;
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
          const drawOf = (it: PlanItem, xFrac: number) => ({ text: it.e.text, xFrac, sizeFrac: it.size / disp.h, family: it.e.family, color: it.e.color, bold: it.e.bold, italic: it.e.italic, underline: it.e.underline, strike: it.e.strike, link: it.e.link });
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
        list.push({ page: a.page, yFrac: a.y, hFrac: a.sizeFrac, bg: 'rgb(255,255,255)', coverLFrac: a.x, coverRFrac: a.x, draws: [{ text: a.text, xFrac: a.x, sizeFrac: a.sizeFrac, family: a.family, color: a.color, bold: a.bold, italic: a.italic, underline: a.underline, strike: a.strike, link: a.link }] });
      }
      // Edited paragraph blocks: cover the box + re-flow the text in its font.
      const blockList: BlockEdit[] = [];
      for (const [pStr, bs] of Object.entries(blocks)) {
        const p = Number(pStr);
        for (const b of bs) {
          if (!blockChanged(b)) continue;
          const st = blockStyleOf(b);
          const l = blockLayoutOf(b);
          blockList.push({ page: p, xFrac: l.x, yFrac: l.y, wFrac: l.w + l.w * 0.02, hFrac: l.h, coverXFrac: b.x, coverYFrac: b.y, coverWFrac: b.w + b.w * 0.02, coverHFrac: b.h, bg: b.bg, sizeFrac: st.size, lineHFrac: b.lineH, text: blockTextOf(b), family: st.family, color: st.color, bold: st.bold, italic: st.italic, underline: st.underline, strike: st.strike, align: st.align, link: st.link });
        }
      }
      let current: File | Blob = file;
      if (list.length || blockList.length) {
        const outBytes = await applyLineEdits(await file.arrayBuffer(), list, blockList);
        current = new Blob([outBytes.slice()], { type: 'application/pdf' });
      }

      for (const idx of markedPages) {
        const rp = await renderPage(handle, idx, dprTarget(1000, 2, 2000));
        const cvs = document.createElement('canvas');
        cvs.width = rp.w; cvs.height = rp.h;
        const ctx = cvs.getContext('2d')!;
        paintMarkups(ctx, rp.w, rp.h, markups[idx] || []);
        for (const im of images.filter((i) => i.page === idx && imageChanged(i))) {
          if (im.source === 'pdf' && im.orig) {
            ctx.fillStyle = im.bg && /^rgb\(\s*\d/.test(im.bg) ? im.bg : 'rgb(255,255,255)';
            ctx.fillRect(im.orig.x * rp.w, im.orig.y * rp.h, im.orig.w * rp.w, im.orig.h * rp.h);
          }
          if (im.deleted) continue;
          const el = imgCache.current.get(im.src);
          if (el) {
            const w = im.w * rp.w;
            const h = w * im.aspect;
            const x = im.x * rp.w;
            const y = im.y * rp.h;
            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((im.rot || 0) * Math.PI / 180);
            ctx.drawImage(el, -w / 2, -h / 2, w, h);
            ctx.restore();
          }
        }
        const buf = await new Promise<ArrayBuffer>((resolve, reject) =>
          cvs.toBlob((b) => (b ? b.arrayBuffer().then(resolve) : reject(new Error('render failed'))), 'image/png'));
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
        const x = it.xFrac * disp.w;
        ctx.fillText(it.e.text, x, baseY);
        const width = measureWidth(it.e.text, cssFont(it.e.family, it.e.bold, it.e.italic, it.size));
        ctx.strokeStyle = it.e.color;
        ctx.lineWidth = Math.max(1, it.size * 0.06);
        if (it.e.underline || it.e.link) {
          ctx.beginPath(); ctx.moveTo(x, baseY + it.size * 0.14); ctx.lineTo(x + width, baseY + it.size * 0.14); ctx.stroke();
        }
        if (it.e.strike) {
          ctx.beginPath(); ctx.moveTo(x, baseY - it.size * 0.32); ctx.lineTo(x + width, baseY - it.size * 0.32); ctx.stroke();
        }
      }
    }
    // Cover every edited/active paragraph block so the original text is hidden and
    // the DOM text box (rendered in the real font) shows on a clean background.
    const padY = 0.35; // fraction of a line's height bled above/below the block
    const coverBlock = (b: Block, l: BlockLayout) => {
      const bgFill = /^rgb\(\s*\d/.test(b.bg) ? b.bg : 'rgb(255,255,255)';
      ctx.fillStyle = bgFill;
      ctx.fillRect((l.x - l.w * 0.004) * disp.w, (l.y - b.size * padY) * disp.h, (l.w + l.w * 0.02) * disp.w, (l.h + b.size * padY * 2) * disp.h);
    };
    for (const b of pageBlocks) {
      if (b.id !== editingBlock && !blockChanged(b)) continue;
      coverBlock(b, { x: b.x, y: b.y, w: b.w, h: b.h });
      const l = blockLayoutOf(b);
      if (layoutChanged(b)) coverBlock(b, l);
    }
    // Hover outline for the block under the cursor (so it reads as clickable).
    const hb = hover ? pageBlocks.find((b) => b.id === hover) : null;
    if (hb && hb.id !== editingBlock) {
      const l = blockLayoutOf(hb);
      const pad = hb.size * 0.3;
      ctx.strokeStyle = 'rgba(79,70,229,0.5)'; ctx.fillStyle = 'rgba(79,70,229,0.06)'; ctx.lineWidth = 1;
      const rx = (l.x - l.w * 0.004) * disp.w, ry = (l.y - pad) * disp.h, rw = (l.w + l.w * 0.02) * disp.w, rh = (l.h + pad * 2) * disp.h;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 4); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(rx, ry, rw, rh); ctx.strokeRect(rx, ry, rw, rh); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLines, edits, hover, editing, disp, pageBlocks, editingBlock, blockEdits, blockStyle, blockLayout]);

  useEffect(() => { paintOverlay(); }, [paintOverlay, preview, fontReady]);

  const canUndo = historyPast.length > 0 || past.length > 0, canRedo = historyFuture.length > 0 || future.length > 0;
  const tbBtn = 'flex size-9 items-center justify-center rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const pageHasMarkup = (markups[sel] || []).length > 0 || images.some((im) => im.page === sel && imageChanged(im));
  const pageStamps = (markups[sel] || [])
    .map((m, index) => ({ m, index }))
    .filter((x): x is { m: StampMarkup; index: number } => x.m.kind === 'stamp');
  const toolButton = (id: EditorTool, icon: React.ReactNode, label: string) => (
    <button type="button" onClick={() => chooseTool(id)} aria-pressed={tool === id} title={label}
      className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all ${tool === id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'}`}>
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );
  const actionButton = (onClick: () => void, icon: React.ReactNode, label: string) => (
    <button type="button" onClick={onClick} title={label}
      className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all hover:bg-accent">
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );
  const SHAPE_META: Record<ShapeKind, { icon: React.ReactNode; label: string }> = {
    rect: { icon: <Square className="size-4" />, label: 'Rectangle' },
    circle: { icon: <Circle className="size-4" />, label: 'Ellipse' },
    line: { icon: <Minus className="size-4" />, label: 'Line' },
    arrow: { icon: <ArrowUpRight className="size-4" />, label: 'Arrow' },
  };
  const stampChoices = [...STAMP_PRESETS, ...customStamps.filter((s) => !STAMP_PRESETS.includes(s))];
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <input id="edit-pdf-upload" ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        <input ref={imgFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { pickImageFile(e.target.files); e.currentTarget.value = ''; }} />
        {sigOpen && <SignatureMaker onClose={() => setSigOpen(false)} onCreate={(url, aspect) => addImageSrc(url, aspect)} />}
        {handoffNote && <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground"><Zap className="size-4 shrink-0 text-primary" /> {handoffNote}</p>}

        {tooBig ? (
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        ) : !file ? (
          <label htmlFor="edit-pdf-upload" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Click a paragraph to edit, or use the premium toolbar - never uploaded</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </label>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40"><FileText className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{fmt(file.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p></div>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setLines({}); setEdits({}); setPast([]); setFuture([]); setHistoryPast([]); setHistoryFuture([]); blockInputSession.current = false; addedInputSession.current = false; setAdded([]); setAddSel(null); setAddMode(false); setBlocks({}); setBlockEdits({}); setBlockStyle({}); setBlockLayout({}); setEditingBlock(null); setMarkups({}); setImages([]); setSelImg(null); setStampsOpen(false); setLinkOpen(false); imgCache.current.clear(); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            {/* Premium formatting toolbar — acts on the selected word. While a word
                is being edited, DON'T let toolbar clicks steal focus from the input
                (that blur used to commit + exit edit mode before the style applied),
                so font/size/bold/italic/colour change live as you type. */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-soft"
              onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
                if (editing || activeAdded || activeBlock) e.preventDefault();
              }}>
              {toolButton('paragraph', <Pencil className="size-4" />, 'Edit paragraphs')}
              <button className={`${tbBtn} gap-1.5 w-auto px-2.5 ${addMode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Add a new text box — then click where you want it" aria-pressed={addMode} onClick={() => { if (addMode) chooseTool('paragraph'); else chooseTool('add-text'); }}><TextCursorInput className="size-4" /> <span className="text-xs font-medium">Add text</span></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              {toolButton('highlight', <Highlighter className="size-4" />, 'Highlight')}
              {toolButton('pen', <Pen className="size-4" />, 'Draw')}
              <div className="relative" ref={shapesRef}>
                <button type="button" onClick={() => { chooseTool(shape); setShapesOpen((o) => !o); }} aria-pressed={isShape(tool)} aria-haspopup="menu" aria-expanded={shapesOpen} title="Shapes"
                  className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-all ${isShape(tool) ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'}`}>
                  {SHAPE_META[shape].icon} <span className="hidden md:inline">Shapes</span> <ChevronDown className={`size-3.5 transition-transform ${shapesOpen ? 'rotate-180' : ''}`} />
                </button>
                {shapesOpen && (
                  <div role="menu" className="absolute left-0 top-full z-50 mt-1 w-40 rounded-xl border bg-card p-1 shadow-lift">
                    {SHAPE_KINDS.map((s) => (
                      <button key={s} type="button" role="menuitem" onClick={() => { setShape(s); chooseTool(s); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent ${tool === s ? 'text-primary' : ''}`}>
                        {SHAPE_META[s].icon} {SHAPE_META[s].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={stampsRef}>
                <button type="button" onClick={() => { chooseTool('stamp'); setStampsOpen((o) => !o); }} aria-pressed={tool === 'stamp'} aria-haspopup="menu" aria-expanded={stampsOpen} title="Stamp"
                  className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-all ${tool === 'stamp' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'}`}>
                  <StampIcon className="size-4" /> <span className="hidden md:inline">Stamp</span> <ChevronDown className={`size-3.5 transition-transform ${stampsOpen ? 'rotate-180' : ''}`} />
                </button>
                {stampsOpen && (
                  <div role="menu" className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border bg-card p-1 shadow-lift">
                    {stampChoices.map((s) => (
                      <button key={s} type="button" role="menuitem" onClick={() => selectStamp(s)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent ${stampLabel === s ? 'text-primary' : ''}`}>
                        <StampIcon className="size-4" /> {s}
                      </button>
                    ))}
                    <div className="mt-1 border-t p-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Custom stamp</label>
                      <div className="flex items-center gap-1.5">
                        <input value={customStampText} onChange={(e) => setCustomStampText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomStamp(); } }} maxLength={24} placeholder="PAID"
                          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" />
                        <button type="button" onClick={addCustomStamp} className="h-8 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground">Add</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {actionButton(() => setSigOpen(true), <SignatureIcon className="size-4" />, 'Sign')}
              {actionButton(() => imgFileRef.current?.click(), <ImagePlus className="size-4" />, 'Image')}
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <FontSelect value={selFamily} onChange={(f) => patchSel({ family: f })} className="w-40" menuPlacement="up" />
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} hover:bg-accent`} title="Smaller" disabled={!hasSel} onClick={() => patchSel({ size: Math.max(0.006, selSizeFrac * 0.92) })}><Minus className="size-4" /></button>
              <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">{hasSel ? Math.round(selSizePx) : '—'}</span>
              <button className={`${tbBtn} hover:bg-accent`} title="Larger" disabled={!hasSel} onClick={() => patchSel({ size: Math.min(0.2, selSizeFrac * 1.08) })}><Plus className="size-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} ${selBold && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Bold" aria-pressed={selBold} disabled={!hasSel || !selFamInfo?.bold} onClick={() => patchSel({ bold: !selBold })}><Bold className="size-4" /></button>
              <button className={`${tbBtn} ${selItalic && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Italic" aria-pressed={selItalic} disabled={!hasSel || !selFamInfo?.italic} onClick={() => patchSel({ italic: !selItalic })}><Italic className="size-4" /></button>
              <button className={`${tbBtn} ${selUnderline && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Underline" aria-pressed={selUnderline} disabled={!hasSel} onClick={() => patchSel({ underline: !selUnderline })}><Underline className="size-4" /></button>
              <button className={`${tbBtn} ${selStrike && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Strikethrough" aria-pressed={selStrike} disabled={!hasSel} onClick={() => patchSel({ strike: !selStrike })}><Strikethrough className="size-4" /></button>
              <div className="relative" ref={linkRef}>
                <button className={`${tbBtn} ${selLink && hasSel ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Add or edit hyperlink" aria-pressed={!!selLink} disabled={!hasSel} onClick={openLinkMenu}><LinkIcon className="size-4" /></button>
                {linkOpen && (
                  <div className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-xl border bg-card p-2.5 shadow-lift">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hyperlink</label>
                    <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } else if (e.key === 'Escape') setLinkOpen(false); }} placeholder="https://example.com"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" autoFocus />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button type="button" onClick={removeLink} className="text-xs font-medium text-muted-foreground hover:text-destructive">Remove link</button>
                      <button type="button" onClick={applyLink} className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">Apply</button>
                    </div>
                  </div>
                )}
              </div>
              <button className={`${tbBtn} ${selAlign === 'left' && (activeAdded || activeBlock) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Align left" disabled={!activeAdded && !activeBlock} onClick={() => patchSel({ align: 'left' })}><AlignLeft className="size-4" /></button>
              <button className={`${tbBtn} ${selAlign === 'center' && (activeAdded || activeBlock) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Align center" disabled={!activeAdded && !activeBlock} onClick={() => patchSel({ align: 'center' })}><AlignCenter className="size-4" /></button>
              <button className={`${tbBtn} ${selAlign === 'right' && (activeAdded || activeBlock) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} title="Align right" disabled={!activeAdded && !activeBlock} onClick={() => patchSel({ align: 'right' })}><AlignRight className="size-4" /></button>
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <div className="flex items-center gap-1 px-0.5">
                  {SWATCHES.map((c) => (
                  <button key={c} disabled={!hasSel && !usesMarkupStyle} aria-label={`colour ${c}`} aria-pressed={(usesMarkupStyle ? markupColor : selColor) === c} onClick={() => usesMarkupStyle ? setMarkupColor(c) : patchSel({ color: c })}
                    className={`size-5 rounded-full ring-offset-1 ring-offset-card transition-all disabled:opacity-40 ${(usesMarkupStyle ? markupColor : selColor) === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              {activeMarkupTool && (
                <>
                  <span className="mx-0.5 h-6 w-px bg-border/70" />
                  <label className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                    Size
                    <input type="range" min={1} max={10} value={markupWeight} onChange={(e) => setMarkupWeight(Number(e.target.value))} className="dd-range w-20" />
                  </label>
                </>
              )}
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <button className={`${tbBtn} text-destructive hover:bg-destructive/10`} title={activeImage ? 'Delete this image' : activeAdded ? 'Delete this text box' : activeBlock ? 'Clear paragraph edit' : 'Delete selection'} disabled={!hasSel && !activeImage} onClick={deleteSel}><Trash2 className="size-4" /></button>
              <div className="ml-auto flex items-center gap-1">
                <button className={`${tbBtn} hover:bg-accent`} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undoEditor}><Undo2 className="size-4" /></button>
                <button className={`${tbBtn} hover:bg-accent`} title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redoEditor}><Redo2 className="size-4" /></button>
                <button className={`${tbBtn} text-destructive hover:bg-destructive/10`} title="Clear page markup" disabled={!pageHasMarkup} onClick={clearPageMarkup}><Trash2 className="size-4" /></button>
              </div>
            </div>

            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Pencil className="size-3.5 text-primary" />
              {tool === 'stamp' ? `Click the page to place a ${stampLabel} stamp.` : activeMarkupTool ? 'Drag on the page to mark it up. Use Sign or Image to place files, then drag to move them.' : addMode ? 'Click anywhere on the page to drop a new text box.' : activeAdded ? 'Editing a text box — type, format, or drag it to move. Delete removes it.' : activeBlock ? 'Editing a paragraph — type freely; the text wraps and stays in the PDF’s font. Click outside when done.' : 'Click a paragraph to edit its text, or use “Add text”.'}
              {detecting && <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> finding text…</span>}
            </p>

            <div>
              <div className="flex items-start justify-center overflow-auto rounded-xl border bg-muted/30 p-1 sm:p-2">
                {preview ? (
                  <div ref={wrapRef} className="relative mx-auto w-full max-w-full leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={imgRef} src={preview.url} alt={`Page ${sel + 1}`} className="w-full rounded border bg-white shadow-md" draggable={false} onLoad={() => { const im = imgRef.current; if (im) setDisp({ w: im.clientWidth, h: im.clientHeight }); }} />

                  {/* Edited/active lines: cover + reflowed text drawn in ONE canvas
                      (same coordinate space → can't drift → no doubling). */}
                  <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                  <canvas
                    ref={markupCanvasRef}
                    className={`absolute inset-0 h-full w-full touch-none ${activeMarkupTool ? 'cursor-crosshair' : 'pointer-events-none'}`}
                    onPointerDown={onMarkupDown}
                    onPointerMove={onMarkupMove}
                    onPointerUp={onMarkupUp}
                    onPointerLeave={onMarkupUp}
                  />

                  {/* click/hover surface */}
                  <div className={`absolute inset-0 ${activeMarkupTool ? 'pointer-events-none' : ''}`} style={{ cursor: addMode || tool === 'stamp' ? 'crosshair' : hover ? 'text' : 'default' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} />

                  {/* Existing PDF image edits: hide the original image before drawing the moved/resized/rotated copy. */}
                  {disp.h > 0 && images.filter((im) => im.page === sel && im.source === 'pdf' && im.changed && im.orig).map((im) => (
                    <div key={`${im.id}-cover`} className="pointer-events-none absolute z-[25]" style={{ left: `${im.orig!.x * 100}%`, top: `${im.orig!.y * 100}%`, width: `${im.orig!.w * 100}%`, height: `${im.orig!.h * 100}%`, background: im.bg || '#fff' }} />
                  ))}

                  {/* Stamp object controls. Stamps are painted on the markup canvas; this layer makes them move/delete-able. */}
                  {disp.h > 0 && pageStamps.map(({ m, index }) => {
                    const active = selStamp === index || hoverStamp === index;
                    return (
                      <div key={`stamp-${index}`} onPointerDown={(e) => { setSelStamp(index); stampDown(e, index); }} onPointerMove={stampMove} onPointerUp={stampUp} onPointerEnter={() => setHoverStamp(index)} onPointerLeave={() => setHoverStamp((h) => (h === index ? null : h))}
                        className={`absolute z-[45] cursor-move rounded-md ${active ? 'ring-2 ring-primary/80' : 'ring-1 ring-transparent hover:ring-primary/50'}`}
                        style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}>
                        {active && (
                          <>
                            <span className="pointer-events-none absolute -left-2 -top-7 flex h-6 items-center gap-1 rounded-md border bg-card px-2 text-[11px] font-medium text-primary shadow-lift"><Move className="size-3" /> Move</span>
                            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteStamp(index)} title="Delete stamp" aria-label="Delete stamp"
                              className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow"><X className="size-3" /></button>
                          </>
                        )}
                      </div>
                    );
                  })}

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
                        style={{ left: `${xFrac * disp.w}px`, top: `${baselinePx - BASELINE * size}px`, width: `${Math.max(newWpx, box.w * disp.w, size) + 4}px`, height: `${size * 1.2}px`, lineHeight: `${size * 1.2}px`, fontFamily: RENDER_CSS[activeEdit.family] ?? FAMILIES[activeEdit.family].css, fontSize: `${size}px`, fontWeight: activeEdit.bold ? 700 : 400, fontStyle: activeEdit.italic ? 'italic' : 'normal', textDecorationLine: [(activeEdit.underline || activeEdit.link) && 'underline', activeEdit.strike && 'line-through'].filter(Boolean).join(' ') || 'none', color: activeEdit.color, background: activeLine.bg, caretColor: '#4f46e5' }}
                      />
                    );
                  })()}

                  {/* Committed edited paragraphs (not the one being typed) show as
                      static text in the PDF's real font. */}
                  {disp.h > 0 && pageBlocks.map((b) => {
                    if (b.id === editingBlock || !blockChanged(b)) return null;
                    const l = blockLayoutOf(b);
                    const st = blockStyleOf(b); const fs = st.size * disp.h;
                    const style: React.CSSProperties = {
                      left: `${l.x * disp.w}px`, top: `${l.y * disp.h - fs * 0.08}px`, width: `${(l.w + l.w * 0.02) * disp.w}px`, minHeight: `${l.h * disp.h + fs * 0.3}px`,
                      fontFamily: RENDER_CSS[st.family] ?? FAMILIES[st.family].css, fontSize: `${fs}px`, fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal',
                      textDecorationLine: [(st.underline || st.link) && 'underline', st.strike && 'line-through'].filter(Boolean).join(' ') || 'none', textAlign: st.align,
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
                  {activeBlock && disp.h > 0 && (() => {
                    const l = blockLayoutOf(activeBlock);
                    const left = l.x * disp.w, top = l.y * disp.h, width = (l.w + l.w * 0.02) * disp.w, height = Math.max(l.h * disp.h, activeBlock.size * disp.h * 1.3);
                    const handle = 'absolute z-50 flex size-6 touch-none items-center justify-center rounded-full border-2 border-primary bg-white text-primary shadow-sm';
                    return (
                      <div className="pointer-events-none absolute z-40 rounded-sm border-2 border-dashed border-primary/70" style={{ left, top: top - activeBlock.size * disp.h * 0.35, width, height: height + activeBlock.size * disp.h * 0.7 }}>
                        <button type="button" title="Drag paragraph" aria-label="Drag paragraph"
                          onPointerDown={(e) => blockDown(e, activeBlock, 'move')} onPointerMove={blockMove} onPointerUp={blockUp}
                          className="pointer-events-auto absolute -left-8 -top-8 flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-xs font-medium text-primary shadow-lift cursor-move">
                          <Move className="size-3.5" /> Move
                        </button>
                        <button type="button" title="Clear paragraph edit" aria-label="Clear paragraph edit" onClick={(e) => { e.stopPropagation(); deleteSel(); }}
                          className="pointer-events-auto absolute -right-8 -top-8 flex size-7 items-center justify-center rounded-md border bg-card text-destructive shadow-lift">
                          <Trash2 className="size-3.5" />
                        </button>
                        <span className={`${handle} -bottom-3 -right-3 cursor-nwse-resize pointer-events-auto`} title="Resize paragraph" onPointerDown={(e) => blockDown(e, activeBlock, 'resize-se')} onPointerMove={blockMove} onPointerUp={blockUp}><Maximize2 className="size-3.5" /></span>
                      </div>
                    );
                  })()}

                  {/* Added text boxes (new content the user placed). Selected =
                      editable input; otherwise a draggable label (click to edit,
                      drag to move). Rendered in the SAME font the PDF uses. */}
                  {disp.h > 0 && added.filter((a) => a.page === sel).map((a) => {
                    const left = a.x * disp.w, top = a.y * disp.h, size = a.sizeFrac * disp.h;
                    const fam = RENDER_CSS[a.family] ?? FAMILIES[a.family].css;
                    const common: React.CSSProperties = { left: `${left}px`, top: `${top}px`, fontFamily: fam, fontSize: `${size}px`, fontWeight: a.bold ? 700 : 400, fontStyle: a.italic ? 'italic' : 'normal', textDecorationLine: [(a.underline || a.link) && 'underline', a.strike && 'line-through'].filter(Boolean).join(' ') || 'none', textAlign: a.align, color: a.color, lineHeight: 1.1 };
                    const boxW = Math.max(size * 2, measureWidth(a.text || 'Type...', cssFont(a.family, a.bold, a.italic, size)) + 8);
                    const boxH = size * 1.3;
                    if (a.id === addSel) {
                      return (
                        <React.Fragment key={a.id}>
                          <input ref={addInputRef} value={a.text} placeholder="Type..."
                            onChange={(ev) => patchAddedText(ev.target.value)}
                            onKeyDown={(ev) => {
                              const mod = ev.ctrlKey || ev.metaKey;
                              if (ev.key === 'Escape' || ev.key === 'Enter') { ev.preventDefault(); if (ev.key === 'Escape' && !a.text.trim()) deleteAdded(); else setAddSel(null); }
                              else if (mod && ev.key.toLowerCase() === 'b') { ev.preventDefault(); if (selFamInfo?.bold) patchAdded({ bold: !a.bold }); }
                              else if (mod && ev.key.toLowerCase() === 'i') { ev.preventDefault(); if (selFamInfo?.italic) patchAdded({ italic: !a.italic }); }
                            }}
                            className="absolute z-30 rounded-[2px] border-0 p-0 outline-none ring-2 ring-primary/70"
                            style={{ ...common, width: `${boxW}px`, height: `${boxH}px`, background: 'rgba(255,255,255,0.65)', caretColor: '#4f46e5' }}
                          />
                          <div className="pointer-events-none absolute z-[45] rounded-sm" style={{ left, top, width: boxW, height: boxH }}>
                            <button type="button" title="Drag text box" aria-label="Drag text box"
                              onPointerDown={(e) => startAddedDrag(e, a, true)} onPointerMove={moveAddedDrag} onPointerUp={() => stopAddedDrag(false)}
                              className="pointer-events-auto absolute -left-2 -top-8 flex h-7 touch-none items-center gap-1 rounded-md border bg-card px-2 text-xs font-medium text-primary shadow-lift cursor-move">
                              <Move className="size-3.5" /> Move
                            </button>
                            <button type="button" title="Delete text box" aria-label="Delete text box"
                              onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteAdded(a.id)}
                              className="pointer-events-auto absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow">
                              <X className="size-3" />
                            </button>
                          </div>
                        </React.Fragment>
                      );
                    }
                    return (
                      <div key={a.id} role="button" tabIndex={0}
                        onPointerDown={(e) => startAddedDrag(e, a)}
                        onPointerMove={moveAddedDrag}
                        onPointerUp={() => stopAddedDrag(true)}
                        className="group absolute z-20 cursor-move select-none whitespace-pre rounded-[2px] ring-1 ring-transparent hover:ring-primary/40"
                        style={common}
                      >
                        {a.text || <span style={{ color: '#9ca3af' }}>Text</span>}
                        <span className="pointer-events-none absolute -left-2 -top-7 hidden h-6 items-center gap-1 rounded-md border bg-card px-2 text-[11px] font-medium text-primary shadow-lift group-hover:flex"><Move className="size-3" /> Move</span>
                        <button type="button" title="Delete text box" aria-label="Delete text box"
                          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deleteAdded(a.id); }}
                          className="absolute -right-2 -top-2 hidden size-5 items-center justify-center rounded-full bg-destructive text-white shadow group-hover:flex"><X className="size-3" /></button>
                      </div>
                    );
                  })}
                  {disp.h > 0 && pageImages.map((im) => {
                    const heightPct = im.w * im.aspect * (disp.w / Math.max(1, disp.h)) * 100;
                    const showImage = im.source !== 'pdf' || im.changed;
                    return (
                      <div key={im.id}
                        onPointerDown={(e) => imgDown(e, im.id, 'move')} onPointerMove={imgMove} onPointerUp={imgUp}
                        className={`absolute z-40 cursor-move rounded-sm ${selImg === im.id ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/40'}`}
                        style={{ left: `${im.x * 100}%`, top: `${im.y * 100}%`, width: `${im.w * 100}%`, height: `${heightPct}%` }}
                      >
                        {showImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={im.src} alt="" className="pointer-events-none block h-full w-full select-none object-contain" draggable={false} style={{ transform: `rotate(${im.rot || 0}deg)`, transformOrigin: 'center' }} />
                        )}
                        {selImg === im.id && (
                          <>
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteImage(im.id)} aria-label="Delete image" title="Delete image"
                              className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow"><X className="size-3" /></button>
                            <button type="button" onPointerDown={(e) => imgDown(e, im.id, 'rotate')} onPointerMove={imgMove} onPointerUp={imgUp} onDoubleClick={(e) => { e.stopPropagation(); rotateImage(im.id, 90); }}
                              aria-label="Rotate image" title="Drag to rotate; double-click for 90 degrees"
                              className="absolute -top-9 left-1/2 z-10 flex size-7 -translate-x-1/2 touch-none items-center justify-center rounded-full border bg-card text-primary shadow-lift cursor-grab">
                              <RotateCw className="size-3.5" />
                            </button>
                            <div onPointerDown={(e) => imgDown(e, im.id, 'resize')} onPointerMove={imgMove} onPointerUp={imgUp}
                              className="absolute -bottom-1.5 -right-1.5 z-10 size-3.5 cursor-nwse-resize rounded-sm border-2 border-primary bg-white" aria-label="Resize" />
                          </>
                        )}
                      </div>
                    );
                  })}
                  </div>
                ) : (
                  <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                )}
              </div>
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { closeWord(); setAddSel(null); setAddMode(false); setEditingBlock(null); setSelImg(null); setSel(i); }} className="mt-2" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {totalChanges
                ? `${[blockCount && `${blockCount} paragraph${blockCount === 1 ? '' : 's'} edited`, addedCount && `${addedCount} text box${addedCount === 1 ? '' : 'es'} added`, markupCount && `${markupCount} markup item${markupCount === 1 ? '' : 's'}`, imageCount && `${imageCount} image/signature${imageCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')} — edits stay in your browser.`
                : 'Click a paragraph to edit its text, use Add text, or mark up the page. Scanned pages have no selectable text.'}
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
