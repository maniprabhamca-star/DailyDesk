'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, X, Loader2, Highlighter, Pen, Square, Circle, Minus, ArrowUpRight, ChevronDown, ChevronUp, Type, Trash2, Zap, Bold, Italic, Underline, Signature as SignatureIcon, ImagePlus, Plus, Copy, Star, MoveDiagonal, MousePointer2, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Eye, EyeOff, Layers as LayersIcon, RotateCw, FileMinus, ArrowLeftRight } from 'lucide-react';
import { SignatureMaker } from './signature-maker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff, setHandoff } from '@/lib/handoff';
import { useRouter } from 'next/navigation';
import { rewritePdf } from '@/lib/pdf-rewrite';
import { openPdf, renderPage, dprTarget, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { EditorShell } from '@/components/pdf/editor-shell';
import { loadLibrary, addLibraryItem, removeLibraryItem, newLibraryId, type LibraryItem } from '@/lib/library';
import { setEditorContext, clearEditorContext } from '@/lib/command-registry';
import { saveSession, loadSession, clearSession } from '@/lib/editor-session';
import { UpgradeNotice } from '@/components/app/upgrade-notice';
import { usePlan, canProcessSize, FREE_MAX_BYTES, fmtBytes } from '@/lib/plan';
import { FAMILIES, type Family } from '@/lib/fonts';
import { FontSelect } from '@/components/app/font-select';

// Annotate PDF — highlight, draw, box and type on a live page preview, then
// flatten the markup onto the original pages with the shared place-image rewrite
// (a transparent full-page PNG per page). 100% on-device: the file and your
// notes never leave the browser. Coordinates are stored as page fractions so the
// on-screen canvas and the high-res export stay pixel-perfect at any size.

type ShapeKind = 'rect' | 'circle' | 'line' | 'arrow';
type Tool = 'select' | 'highlight' | 'pen' | ShapeKind | 'text';
type Pt = { x: number; y: number };
type Stroke = { kind: 'pen' | 'highlight'; color: string; w: number; pts: Pt[]; opacity?: number; hidden?: boolean };
type ShapeA = { kind: ShapeKind; color: string; w: number; a: Pt; b: Pt; opacity?: number; hidden?: boolean };
type TextA = { kind: 'text'; color: string; size: number; at: Pt; text: string; family: Family; bold: boolean; italic: boolean; underline: boolean; opacity?: number; hidden?: boolean };
type Anno = Stroke | ShapeA | TextA;
// Images + signatures live as draggable overlays (not on the stroke canvas) and
// are composited into the page at export. x/y = top-left fraction, w = width
// fraction of the page, aspect = image height/width (in px). opacity 0–1.
type ImageItem = { id: string; page: number; x: number; y: number; w: number; aspect: number; src: string; opacity?: number; hidden?: boolean };
// A saved "look" — tool + colour + size (+ text styling), reusable in one click.
type Preset = { id: string; name: string; tool: Tool; color: string; weight: number; family: Family; bold: boolean; italic: boolean; underline: boolean };
const SHAPE_KINDS: ShapeKind[] = ['rect', 'circle', 'line', 'arrow'];
const isShape = (t: Tool): t is ShapeKind => (SHAPE_KINDS as string[]).includes(t);

const COLORS = ['#111827', '#ef4444', '#2563eb', '#16a34a', '#7c3aed', '#facc15'];

// The font list is shared with the Watermark tool (lib/fonts FAMILIES) so it's
// identical everywhere. Text is drawn to canvas; globals.css declares the real
// bold/italic @font-face for the families that ship them, and we await
// document.fonts.load before rasterising.
function fontSpec(fs: number, a: { family: Family; bold: boolean; italic: boolean }) {
  return `${a.italic ? 'italic ' : ''}${a.bold ? '700' : '400'} ${fs}px ${FAMILIES[a.family].css}`;
}

// Weight (1–10 UI) → width as a fraction of the page width, per tool.
function widthFrac(tool: Tool, weight: number) {
  if (tool === 'highlight') return weight * 0.006;
  return weight * 0.0012;
}
function fontFrac(weight: number) { return 0.016 + weight * 0.006; }

// Smart snap: given an object's top-left (x,y) and its size (all page fractions),
// nudge it so its centre lines up with the page centre, or an edge with a margin,
// when it's within a small threshold — and report which guide line to draw. This
// is the Keynote/Figma "clicks into place" feel; returns v (vertical guide x) and
// h (horizontal guide y) fractions when a snap fired.
const SNAP_MARGIN = 0.06;
const SNAP_T = 0.012;
function applySnap(x: number, y: number, wFrac: number, hFrac: number): { x: number; y: number; v?: number; h?: number } {
  let sx = x, sy = y; let v: number | undefined, h: number | undefined;
  const cx = x + wFrac / 2, cy = y + hFrac / 2;
  if (Math.abs(cx - 0.5) < SNAP_T) { sx = 0.5 - wFrac / 2; v = 0.5; }
  else if (Math.abs(x - SNAP_MARGIN) < SNAP_T) { sx = SNAP_MARGIN; v = SNAP_MARGIN; }
  else if (Math.abs((x + wFrac) - (1 - SNAP_MARGIN)) < SNAP_T) { sx = (1 - SNAP_MARGIN) - wFrac; v = 1 - SNAP_MARGIN; }
  if (Math.abs(cy - 0.5) < SNAP_T) { sy = 0.5 - hFrac / 2; h = 0.5; }
  else if (Math.abs(y - SNAP_MARGIN) < SNAP_T) { sy = SNAP_MARGIN; h = SNAP_MARGIN; }
  else if (Math.abs((y + hFrac) - (1 - SNAP_MARGIN)) < SNAP_T) { sy = (1 - SNAP_MARGIN) - hFrac; h = 1 - SNAP_MARGIN; }
  return { x: sx, y: sy, v, h };
}

// Layers panel: a friendly label + icon for each object kind.
function layerMeta(a: Anno): { label: string; Icon: typeof Type } {
  switch (a.kind) {
    case 'text': return { label: a.text.slice(0, 22) || 'Text', Icon: Type };
    case 'rect': return { label: 'Rectangle', Icon: Square };
    case 'circle': return { label: 'Ellipse', Icon: Circle };
    case 'line': return { label: 'Line', Icon: Minus };
    case 'arrow': return { label: 'Arrow', Icon: ArrowUpRight };
    case 'highlight': return { label: 'Highlight', Icon: Highlighter };
    default: return { label: 'Drawing', Icon: Pen };
  }
}

// Draw a list of annotations onto ctx sized W×H (used for both the live preview
// and the high-res export — same code, different canvas).
function paint(ctx: CanvasRenderingContext2D, W: number, H: number, list: Anno[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of list) {
    if (a.hidden) continue;
    if (a.kind === 'rect' || a.kind === 'circle' || a.kind === 'line' || a.kind === 'arrow') {
      ctx.globalAlpha = a.opacity ?? 1;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(2, a.w * W);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // A soft shadow gives the outline edge definition on any background, so a
      // light colour (e.g. yellow) doesn't vanish on a white page.
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 2;
      const ax = a.a.x * W, ay = a.a.y * H, bx = a.b.x * W, by = a.b.y * H;
      if (a.kind === 'rect') {
        ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      } else if (a.kind === 'circle') {
        const cx = (ax + bx) / 2, cy = (ay + by) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, Math.abs(bx - ax) / 2), Math.max(1, Math.abs(by - ay) / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // line + (for arrow) a two-stroke arrowhead at the b end
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (a.kind === 'arrow') {
          const ang = Math.atan2(by - ay, bx - ax);
          const head = Math.max(10, a.w * W * 3.4);
          const spread = Math.PI / 7;
          ctx.beginPath();
          ctx.moveTo(bx, by); ctx.lineTo(bx - head * Math.cos(ang - spread), by - head * Math.sin(ang - spread));
          ctx.moveTo(bx, by); ctx.lineTo(bx - head * Math.cos(ang + spread), by - head * Math.sin(ang + spread));
          ctx.stroke();
        }
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else if (a.kind === 'text') {
      // Clean text — just the glyphs in the chosen colour/font (no outline/halo),
      // so the typeface and weight read exactly as picked (like Smallpdf).
      ctx.globalAlpha = a.opacity ?? 1;
      ctx.textBaseline = 'top';
      const fs = Math.max(10, a.size * H);
      const x = a.at.x * W, y = a.at.y * H;
      ctx.font = fontSpec(fs, a);
      ctx.fillStyle = a.color;
      ctx.fillText(a.text, x, y);
      if (a.underline) {
        const tw = ctx.measureText(a.text).width;
        const uy = y + fs * 1.04;
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1, fs * 0.06);
        ctx.beginPath(); ctx.moveTo(x, uy); ctx.lineTo(x + tw, uy); ctx.stroke();
      }
    } else if (a.kind === 'pen' || a.kind === 'highlight') {
      ctx.globalAlpha = (a.kind === 'highlight' ? 0.38 : 1) * (a.opacity ?? 1);
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
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [tool, setTool] = useState<Tool>('highlight');
  const [color, setColor] = useState(COLORS[0]);
  const [recentColors, setRecentColors] = useState<string[]>([]); // custom colours picked beyond the 6 swatches
  const [presets, setPresets] = useState<Preset[]>([]); // saved style presets (localStorage)
  const [weight, setWeight] = useState(4);
  const [shape, setShape] = useState<ShapeKind>('rect'); // last-picked shape for the Shapes button
  const [shapesOpen, setShapesOpen] = useState(false);
  const [family, setFamily] = useState<Family>('helvetica');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [annos, setAnnos] = useState<Record<number, Anno[]>>({});
  const [selIdx, setSelIdx] = useState<number | null>(null); // selected placed text (current page)

  // Patch the selected placed text in place — this is what lets the toolbar
  // restyle an already-placed text (font/colour/size/bold/italic/underline)
  // instead of only affecting the next one you add.
  const patchSelected = (patch: Partial<TextA>) => {
    if (selIdx === null) return;
    setAnnos((a) => {
      const list = a[sel] || [];
      const cur = list[selIdx];
      if (!cur || cur.kind !== 'text') return a;
      const next = list.slice();
      next[selIdx] = { ...cur, ...patch };
      return { ...a, [sel]: next };
    });
  };
  // Switch family (drop bold/italic the family can't do) + apply to any selection.
  const pickFamily = (f: Family) => {
    const nb = FAMILIES[f].bold ? bold : false;
    const ni = FAMILIES[f].italic ? italic : false;
    setFamily(f); setBold(nb); setItalic(ni);
    patchSelected({ family: f, bold: nb, italic: ni });
  };
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [brandName, setBrandName] = useState(false); // opt-in "-diemdesk" filename suffix
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selImg, setSelImg] = useState<string | null>(null); // selected image/signature id
  const [sigOpen, setSigOpen] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{ v?: number; h?: number } | null>(null); // live alignment guides while dragging
  // 1c multi-select (Select tool): `group` holds selected object keys (t<idx> / i<id>),
  // `marquee` is the live rubber-band rect (page fractions) while dragging empty space.
  const [group, setGroup] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // My Library (on-device reusable signatures/stamps/text)
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  const libRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const imgDrag = useRef<{ id: string; mode: 'move' | 'resize'; ox: number; oy: number; startW: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const shapesRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null); // "＋ click to add text" cursor hint
  const drawing = useRef(false);
  const live = useRef<Stroke | ShapeA | null>(null);
  const textDrag = useRef<{ idx: number; ox: number; oy: number } | null>(null); // dragging a placed text
  const groupDrag = useRef<{ sx: number; sy: number; items: { key: string; x: number; y: number }[] } | null>(null); // dragging a multi-selection
  const marqueeStart = useRef<Pt | null>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError(wrongTypeError(f.name)); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true); setAnnos({}); setImages([]); setSelImg(null); imgCache.current.clear(); setPreview(null);
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
    if (h && pdf) { setHandoffNote(`PDF brought straight over from ${h.from} — no re-upload needed.`); void loadOne(pdf); return; }
    // No handoff — restore the last session so leaving & returning keeps your work.
    const sess = loadSession<{ annos: Record<number, Anno[]>; images: ImageItem[] }>('annotate');
    if (sess) {
      setAnnos(sess.data.annos || {});
      setImages(sess.data.images || []);
      (sess.data.images || []).forEach((im) => { const el = new Image(); el.onload = () => { imgCache.current.set(im.src, el); }; el.src = im.src; });
      setBusy(true);
      void openPdf(sess.file).then((hh) => { setHandle(hh); setPageCount(hh.numPages); setSel(0); setFile(sess.file); }).catch(() => clearSession('annotate')).finally(() => setBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist the session (in-memory) whenever the file or edits change.
  useEffect(() => { if (file) saveSession('annotate', file, { annos, images }); }, [file, annos, images]);
  useEffect(() => () => { if (handle) void handle.destroy(); }, [handle]);

  // Render the current page for the annotation surface. We intentionally DON'T
  // clear the old preview here — keeping the previous page on screen until the
  // new one is ready stops the surface from collapsing to a spinner and back
  // on every page change (the "flicker/dance"). A fresh file clears preview in
  // loadOne, so the first page still shows a clean loading state.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    const dpr = dprTarget(560, 2.2, 1700);
    void renderPage(handle, sel, dpr).then((p) => {
      if (cancelled) return;
      setPreview(p);
      // Warm the neighbours so next/prev is instant (LRU-cached per handle).
      if (sel + 1 < pageCount) void renderPage(handle, sel + 1, dpr).catch(() => {});
      if (sel - 1 >= 0) void renderPage(handle, sel - 1, dpr).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [handle, sel, pageCount]);

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
    const pageList = annos[sel] || [];
    const list = [...pageList];
    if (live.current) list.push(live.current);
    paint(ctx, c.width, c.height, list);
    // Selection outline around the selected placed text (dashed indigo box).
    const selA = selIdx !== null ? pageList[selIdx] : undefined;
    if (selA && selA.kind === 'text') {
      const aspect = preview ? preview.h / preview.w : 1.3;
      const hFrac = selA.size * 1.3, wFrac = Math.max(0.03, selA.text.length * selA.size * 0.55 * aspect);
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.strokeRect((selA.at.x - 0.006) * c.width, (selA.at.y - 0.006) * c.height, (wFrac + 0.012) * c.width, (hFrac + 0.012) * c.height);
      ctx.setLineDash([]);
    }
  }, [annos, sel, selIdx, preview]);

  useEffect(() => { repaint(); }, [repaint, preview]);
  // Repaint whenever a web font finishes loading, so text painted before its
  // font was ready gets redrawn in the correct typeface.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    const onDone = () => repaint();
    document.fonts.addEventListener('loadingdone', onDone);
    return () => document.fonts.removeEventListener('loadingdone', onDone);
  }, [repaint]);
  // Deselect when switching tool or page; clear any inline cursor override.
  useEffect(() => { setSelIdx(null); setGroup([]); setMarquee(null); if (canvasRef.current) canvasRef.current.style.cursor = ''; }, [tool, sel]);
  // Close the Shapes menu on an outside click.
  useEffect(() => {
    if (!shapesOpen) return;
    const onDown = (e: MouseEvent) => { if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) setShapesOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shapesOpen]);
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
    document.fonts.load(fontSpec(24, { family, bold, italic })).then(() => { if (!stale) repaint(); }).catch(() => {});
    return () => { stale = true; };
  }, [family, bold, italic, repaint]);

  function frac(e: React.MouseEvent): Pt {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!preview) return;
    const p = frac(e);
    // Select tool: click an object to select (Shift toggles into the group), or
    // drag empty space to marquee-select. Dragging a selected object moves the group.
    if (tool === 'select') {
      const key = hitObject(p);
      if (key) {
        if (e.shiftKey) { setGroup((g) => (g.includes(key) ? g.filter((k) => k !== key) : [...g, key])); }
        else {
          const keys = group.includes(key) ? group : [key];
          if (!group.includes(key)) setGroup([key]);
          groupDrag.current = { sx: p.x, sy: p.y, items: keys.map((k) => ({ key: k, ...(posOf(k) || { x: 0, y: 0 }) })) };
        }
      } else {
        if (!e.shiftKey) setGroup([]);
        marqueeStart.current = p; setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }
      return;
    }
    setSelImg(null); // clicking the page deselects any image/signature
    if (tool === 'text') {
      const hit = findTextAt(p);
      if (hit >= 0) {
        // Single click SELECTS a placed text + starts a drag so it can be moved
        // anywhere. Changing font/colour/size restyles it live; double-click
        // edits the words (onDblClick).
        const t = (annos[sel] || [])[hit] as TextA;
        setSelIdx(hit);
        setColor(t.color); setFamily(t.family); setBold(t.bold); setItalic(t.italic); setUnderline(t.underline);
        setWeight(Math.min(10, Math.max(1, Math.round((t.size - 0.016) / 0.006))));
        e.currentTarget.setPointerCapture(e.pointerId);
        textDrag.current = { idx: hit, ox: p.x - t.at.x, oy: p.y - t.at.y };
        if (hintRef.current) hintRef.current.style.opacity = '0';
      } else {
        // Empty space → deselect and start a new text.
        setSelIdx(null);
        setTextDraft({ x: p.x, y: p.y, value: '' });
      }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    setSelIdx(null);
    if (isShape(tool)) live.current = { kind: tool, color, w: widthFrac('pen', weight), a: p, b: p };
    else live.current = { kind: tool, color, w: widthFrac(tool, weight), pts: [p] };
    repaint();
  }
  function moveText(idx: number, at: Pt) {
    setAnnos((a) => {
      const list = a[sel] || [];
      const cur = list[idx];
      if (!cur || cur.kind !== 'text') return a;
      const next = list.slice(); next[idx] = { ...cur, at };
      return { ...a, [sel]: next };
    });
  }

  // ---- 1c Select tool: unified objects (text + images) on the current page ----
  const pageWH = preview ? preview.w / preview.h : 0.77; // page width / height
  const pageHW = preview ? preview.h / preview.w : 1.3;  // page height / width
  type OBox = { key: string; x: number; y: number; w: number; h: number };
  function pageObjects(): OBox[] {
    const out: OBox[] = [];
    (annos[sel] || []).forEach((a, i) => {
      if (a.kind === 'text') out.push({ key: `t${i}`, x: a.at.x, y: a.at.y, w: Math.max(0.03, a.text.length * a.size * 0.55 * pageHW), h: a.size * 1.25 });
    });
    images.filter((im) => im.page === sel).forEach((im) => out.push({ key: `i${im.id}`, x: im.x, y: im.y, w: im.w, h: im.w * im.aspect * pageWH }));
    return out;
  }
  function hitObject(p: Pt): string | null {
    const objs = pageObjects();
    for (let i = objs.length - 1; i >= 0; i--) { const o = objs[i]; if (p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h) return o.key; }
    return null;
  }
  const groupObjs = () => pageObjects().filter((o) => group.includes(o.key));
  const groupBox = () => {
    const objs = groupObjs(); if (!objs.length) return null;
    const minX = Math.min(...objs.map((o) => o.x)), minY = Math.min(...objs.map((o) => o.y));
    const maxX = Math.max(...objs.map((o) => o.x + o.w)), maxY = Math.max(...objs.map((o) => o.y + o.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };
  function posOf(key: string): Pt | null {
    if (key[0] === 't') { const a = (annos[sel] || [])[+key.slice(1)]; return a && a.kind === 'text' ? { x: a.at.x, y: a.at.y } : null; }
    const im = images.find((i) => `i${i.id}` === key); return im ? { x: im.x, y: im.y } : null;
  }
  // Move each listed item to (its stored x/y) + (dx,dy). Used for group drag and,
  // with dx=dy=0, for align (pass the target x/y as the stored value).
  function moveGroupTo(items: { key: string; x: number; y: number }[], dx: number, dy: number) {
    const cl = (n: number) => Math.min(1, Math.max(0, n));
    setAnnos((prev) => {
      const list = (prev[sel] || []).slice();
      items.forEach((it) => { if (it.key[0] === 't') { const idx = +it.key.slice(1); const a = list[idx]; if (a && a.kind === 'text') list[idx] = { ...a, at: { x: cl(it.x + dx), y: cl(it.y + dy) } }; } });
      return { ...prev, [sel]: list };
    });
    setImages((prev) => prev.map((im) => { const it = items.find((i) => i.key === `i${im.id}`); return it ? { ...im, x: cl(it.x + dx), y: cl(it.y + dy) } : im; }));
  }
  const nudgeGroup = (dx: number, dy: number) => moveGroupTo(groupObjs().map((o) => ({ key: o.key, x: o.x, y: o.y })), dx, dy);
  function deleteGroup() {
    const textIdx = group.filter((k) => k[0] === 't').map((k) => +k.slice(1));
    const imgIds = group.filter((k) => k[0] === 'i').map((k) => k.slice(1));
    setAnnos((prev) => ({ ...prev, [sel]: (prev[sel] || []).filter((_, i) => !textIdx.includes(i)) }));
    setImages((prev) => prev.filter((im) => !imgIds.includes(im.id)));
    setGroup([]);
  }
  function duplicateGroup() {
    const newKeys: string[] = [];
    setAnnos((prev) => {
      const list = (prev[sel] || []).slice();
      group.filter((k) => k[0] === 't').forEach((k) => { const a = list[+k.slice(1)]; if (a && a.kind === 'text') { list.push({ ...a, at: { x: Math.min(0.94, a.at.x + 0.03), y: Math.min(0.96, a.at.y + 0.03) } }); newKeys.push(`t${list.length - 1}`); } });
      return { ...prev, [sel]: list };
    });
    setImages((prev) => {
      const add: ImageItem[] = [];
      group.filter((k) => k[0] === 'i').forEach((k) => { const im = prev.find((i) => i.id === k.slice(1)); if (im) { const id = Math.random().toString(36).slice(2); add.push({ ...im, id, x: Math.min(1 - im.w, im.x + 0.03), y: Math.min(0.96, im.y + 0.03) }); newKeys.push(`i${id}`); } });
      return [...prev, ...add];
    });
    setGroup(newKeys);
  }
  type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
  function alignGroup(edge: AlignEdge) {
    const box = groupBox(); if (!box) return;
    const move = groupObjs().map((o) => {
      let nx = o.x, ny = o.y;
      if (edge === 'left') nx = box.x; else if (edge === 'hcenter') nx = box.x + box.w / 2 - o.w / 2; else if (edge === 'right') nx = box.x + box.w - o.w;
      else if (edge === 'top') ny = box.y; else if (edge === 'vcenter') ny = box.y + box.h / 2 - o.h / 2; else if (edge === 'bottom') ny = box.y + box.h - o.h;
      return { key: o.key, x: nx, y: ny };
    });
    moveGroupTo(move, 0, 0);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === 'select') {
      const p = frac(e);
      if (groupDrag.current) { const g = groupDrag.current; moveGroupTo(g.items, p.x - g.sx, p.y - g.sy); }
      else if (marqueeStart.current) { setMarquee({ x0: marqueeStart.current.x, y0: marqueeStart.current.y, x1: p.x, y1: p.y }); }
      return;
    }
    // Text tool hover: over an existing text show a MOVE cursor and hide the
    // add-text hint (you'd drag it there); over empty space show the "＋ click
    // to add text" hint following the cursor.
    if (tool === 'text' && !textDraft && !textDrag.current) {
      const overText = findTextAt(frac(e)) >= 0;
      if (canvasRef.current) canvasRef.current.style.cursor = overText ? 'move' : 'text';
      if (hintRef.current && wrapRef.current) {
        if (overText) { hintRef.current.style.opacity = '0'; }
        else {
          const r = wrapRef.current.getBoundingClientRect();
          hintRef.current.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
          hintRef.current.style.opacity = '1';
        }
      }
    }
    if (textDrag.current) {
      const d = textDrag.current; const q = frac(e);
      let nx = Math.min(1, Math.max(0, q.x - d.ox));
      let ny = Math.min(1, Math.max(0, q.y - d.oy));
      const ta = (annos[sel] || [])[d.idx];
      if (ta && ta.kind === 'text' && preview) {
        const wFrac = Math.max(0.03, ta.text.length * ta.size * 0.55 * (preview.h / preview.w));
        const s = applySnap(nx, ny, wFrac, ta.size * 1.25);
        nx = s.x; ny = s.y;
        setSnapGuides(s.v != null || s.h != null ? { v: s.v, h: s.h } : null);
      }
      moveText(d.idx, { x: nx, y: ny });
      return;
    }
    if (!drawing.current || !live.current) return;
    const cur = live.current;
    const p = frac(e);
    if (cur.kind === 'pen' || cur.kind === 'highlight') cur.pts.push(p);
    else if (cur.kind === 'rect' || cur.kind === 'circle' || cur.kind === 'line' || cur.kind === 'arrow') cur.b = p;
    repaint();
  }
  function onLeave() { if (hintRef.current) hintRef.current.style.opacity = '0'; onUp(); }
  function onUp() {
    if (tool === 'select') {
      if (groupDrag.current) { groupDrag.current = null; return; }
      if (marqueeStart.current) {
        marqueeStart.current = null;
        if (marquee) {
          const x0 = Math.min(marquee.x0, marquee.x1), y0 = Math.min(marquee.y0, marquee.y1), x1 = Math.max(marquee.x0, marquee.x1), y1 = Math.max(marquee.y0, marquee.y1);
          if (Math.abs(x1 - x0) > 0.01 || Math.abs(y1 - y0) > 0.01) {
            setGroup(pageObjects().filter((o) => !(o.x > x1 || o.x + o.w < x0 || o.y > y1 || o.y + o.h < y0)).map((o) => o.key));
          }
        }
        setMarquee(null);
      }
      return;
    }
    if (textDrag.current) { textDrag.current = null; setSnapGuides(null); return; }
    if (!drawing.current || !live.current) { drawing.current = false; return; }
    const committed = live.current;
    live.current = null; drawing.current = false;
    // Shapes need a real drag — ignore an accidental click. Box/circle need area
    // in both axes; line/arrow just need length. Pen/highlight taps are kept (dot).
    if (committed.kind === 'rect' || committed.kind === 'circle') {
      if (Math.abs(committed.b.x - committed.a.x) < 0.006 || Math.abs(committed.b.y - committed.a.y) < 0.006) { repaint(); return; }
    } else if (committed.kind === 'line' || committed.kind === 'arrow') {
      if (Math.hypot(committed.b.x - committed.a.x, committed.b.y - committed.a.y) < 0.01) { repaint(); return; }
    }
    setAnnos((a) => ({ ...a, [sel]: [...(a[sel] || []), committed] }));
  }

  // Double-click a placed text to edit its WORDS (single click just selects it).
  function onDblClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== 'text' || !preview) return;
    const p = frac(e);
    const hit = findTextAt(p);
    if (hit < 0) return;
    const t = (annos[sel] || [])[hit] as TextA;
    setSelIdx(null);
    setAnnos((a) => ({ ...a, [sel]: (a[sel] || []).filter((_, i) => i !== hit) }));
    setColor(t.color); setFamily(t.family); setBold(t.bold); setItalic(t.italic); setUnderline(t.underline);
    setWeight(Math.min(10, Math.max(1, Math.round((t.size - 0.016) / 0.006))));
    setTextDraft({ x: t.at.x, y: t.at.y, value: t.text });
  }

  function commitText() {
    if (textDraft && textDraft.value.trim()) {
      const t: TextA = { kind: 'text', color, size: fontFrac(weight), at: { x: textDraft.x, y: textDraft.y }, text: textDraft.value.trim(), family, bold, italic, underline };
      const idx = (annos[sel] || []).length; // the new text's index
      setAnnos((a) => ({ ...a, [sel]: [...(a[sel] || []), t] }));
      setSelIdx(idx); // keep it selected so the toolbar (font/colour/B/I/U/size) restyles it live
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
  function undo() { setSelIdx(null); setAnnos((a) => ({ ...a, [sel]: (a[sel] || []).slice(0, -1) })); }
  function clearPage() { setSelIdx(null); setSelImg(null); setAnnos((a) => ({ ...a, [sel]: [] })); setImages((arr) => arr.filter((i) => i.page !== sel)); }

  // ---- images / signatures (draggable overlays, composited at export) -------
  function addImageSrc(src: string, aspect: number) {
    const el = new Image();
    el.onload = () => {
      imgCache.current.set(src, el);
      const id = Math.random().toString(36).slice(2);
      setImages((a) => [...a, { id, page: sel, x: 0.34, y: 0.42, w: 0.32, aspect, src }]);
      setSelImg(id); setSelIdx(null);
    };
    el.src = src;
  }
  function pickImageFile(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(f.type) && !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) { setError('Please choose a PNG, JPG, WebP or GIF image.'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); const probe = new Image(); probe.onload = () => addImageSrc(url, probe.naturalHeight / probe.naturalWidth); probe.src = url; };
    reader.readAsDataURL(f);
  }
  function deleteImage(id: string) { setImages((a) => a.filter((i) => i.id !== id)); if (selImg === id) setSelImg(null); }
  function imgDown(e: React.PointerEvent<HTMLElement>, id: string, mode: 'move' | 'resize') {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const im = images.find((i) => i.id === id); if (!im) return;
    setSelImg(id); setSelIdx(null);
    imgDrag.current = { id, mode, ox: e.clientX, oy: e.clientY, startW: im.w };
    if (mode === 'move' && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      imgDrag.current.ox = e.clientX - r.left - im.x * r.width;
      imgDrag.current.oy = e.clientY - r.top - im.y * r.height;
    }
  }
  function imgMove(e: React.PointerEvent<HTMLElement>) {
    const d = imgDrag.current; if (!d || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const im = images.find((i) => i.id === d.id); if (!im) return;
    if (d.mode === 'move') {
      const hFrac = im.w * im.aspect * (r.width / r.height);
      const x = Math.min(Math.max((e.clientX - r.left - d.ox) / r.width, 0), Math.max(0, 1 - im.w));
      const y = Math.min(Math.max((e.clientY - r.top - d.oy) / r.height, 0), Math.max(0, 1 - hFrac));
      const s = applySnap(x, y, im.w, hFrac);
      setImages((arr) => arr.map((it) => (it.id === d.id ? { ...it, x: s.x, y: s.y } : it)));
      setSnapGuides(s.v != null || s.h != null ? { v: s.v, h: s.h } : null);
    } else {
      setImages((arr) => arr.map((it) => (it.id === d.id ? { ...it, w: Math.min(Math.max(d.startW + (e.clientX - d.ox) / r.width, 0.05), 1 - it.x) } : it)));
    }
  }
  function imgUp() { imgDrag.current = null; setSnapGuides(null); }
  const pageImages = images.filter((i) => i.page === sel);

  const annotatedPages = Object.keys(annos).map(Number).filter((i) => (annos[i] || []).length > 0).sort((x, y) => x - y);
  // Pages that need rendering = those with strokes/shapes/text OR an image/signature.
  const markedPages = Array.from(new Set([...annotatedPages, ...images.map((i) => i.page)])).sort((x, y) => x - y);

  async function apply() {
    if (!file || !handle || markedPages.length === 0) return;
    setBusy(true); setError(null); setDone(null);
    const t0 = performance.now();
    try {
      // Make sure every custom font used is loaded before we rasterise a page,
      // otherwise the export could fall back to a default face.
      if (typeof document !== 'undefined' && document.fonts) {
        for (const idx of markedPages) for (const a of (annos[idx] || [])) if (a.kind === 'text') { try { await document.fonts.load(fontSpec(24, a)); } catch { /* ignore */ } }
      }
      let current: File | Blob = file;
      for (const idx of markedPages) {
        const rp = await renderPage(handle, idx, dprTarget(1000, 2, 2000));
        const cvs = document.createElement('canvas');
        cvs.width = rp.w; cvs.height = rp.h;
        const ctx = cvs.getContext('2d')!;
        paint(ctx, rp.w, rp.h, annos[idx] || []);
        // Composite images/signatures on this page (aspect preserved in px).
        for (const im of images.filter((i) => i.page === idx && !i.hidden)) {
          const el = imgCache.current.get(im.src);
          if (el) { ctx.globalAlpha = im.opacity ?? 1; const w = im.w * rp.w; ctx.drawImage(el, im.x * rp.w, im.y * rp.h, w, w * im.aspect); ctx.globalAlpha = 1; }
        }
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

  // Premium segmented tool button: filled when active, quiet hover otherwise.
  // Label collapses to icon-only on small screens for a tidy bar.
  const toolBtn = (id: Tool, icon: React.ReactNode, label: string) => (
    <button key={id} onClick={() => { setTool(id); setTextDraft(null); }} aria-pressed={tool === id} title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${tool === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-accent'}`}>
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );
  const actionBtn = (onClick: () => void, icon: React.ReactNode, label: string) => (
    <button onClick={onClick} title={label}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/80 transition-all hover:bg-accent">
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );

  const SHAPE_META: Record<ShapeKind, { icon: React.ReactNode; label: string }> = {
    rect: { icon: <Square className="size-4" />, label: 'Rectangle' },
    circle: { icon: <Circle className="size-4" />, label: 'Ellipse' },
    line: { icon: <Minus className="size-4" />, label: 'Line' },
    arrow: { icon: <ArrowUpRight className="size-4" />, label: 'Arrow' },
  };

  // ---- Phase 1: selection superpowers (floating toolbar + inspector + keys) ----
  // The two individually-selectable object kinds: a placed text (selIdx) or an
  // image/signature (selImg). Derived here so the floating toolbar, the inspector
  // and the keyboard handlers all read one source of truth.
  const _selText = selIdx !== null ? ((annos[sel] || [])[selIdx] as Anno | undefined) : undefined;
  const selTextA = _selText && _selText.kind === 'text' ? _selText : undefined;
  const selImage = selImg ? images.find((i) => i.id === selImg && i.page === sel) : undefined;
  const selBox = selTextA ? { x: selTextA.at.x, y: selTextA.at.y } : selImage ? { x: selImage.x, y: selImage.y } : null;

  const deleteSelected = () => {
    if (selTextA && selIdx !== null) { const idx = selIdx; setSelIdx(null); setAnnos((a) => ({ ...a, [sel]: (a[sel] || []).filter((_, i) => i !== idx) })); }
    else if (selImage) deleteImage(selImage.id);
  };
  const duplicateSelected = () => {
    if (selTextA && selIdx !== null) {
      const clone: TextA = { ...selTextA, at: { x: Math.min(0.94, selTextA.at.x + 0.03), y: Math.min(0.96, selTextA.at.y + 0.03) } };
      const nextIdx = (annos[sel] || []).length;
      setAnnos((a) => ({ ...a, [sel]: [...(a[sel] || []), clone] }));
      setSelIdx(nextIdx);
    } else if (selImage) {
      const id = Math.random().toString(36).slice(2);
      setImages((arr) => [...arr, { ...selImage, id, x: Math.min(1 - selImage.w, selImage.x + 0.03), y: Math.min(0.96, selImage.y + 0.03) }]);
      setSelImg(id);
    }
  };
  const nudge = (dx: number, dy: number) => {
    if (selTextA && selIdx !== null) moveText(selIdx, { x: Math.min(1, Math.max(0, selTextA.at.x + dx)), y: Math.min(1, Math.max(0, selTextA.at.y + dy)) });
    else if (selImage) setImages((arr) => arr.map((im) => (im.id === selImage.id ? { ...im, x: Math.min(1, Math.max(0, im.x + dx)), y: Math.min(1, Math.max(0, im.y + dy)) } : im)));
  };
  const resizeImage = (dw: number) => { if (selImage) setImages((arr) => arr.map((im) => (im.id === selImage.id ? { ...im, w: Math.min(1 - im.x, Math.max(0.05, im.w + dw)) } : im))); };

  // Align the selected object to the PAGE (not the group) — centre H/V or snap to
  // a margin, in one click. Reuses the same box math as snap/multi-select.
  const alignSelected = (edge: AlignEdge) => {
    const M = SNAP_MARGIN, cl = (n: number) => Math.max(0, Math.min(1, n));
    const put = (w: number, h: number, cur: Pt, set: (x: number, y: number) => void) => {
      let x = cur.x, y = cur.y;
      if (edge === 'left') x = M; else if (edge === 'hcenter') x = 0.5 - w / 2; else if (edge === 'right') x = 1 - M - w;
      else if (edge === 'top') y = M; else if (edge === 'vcenter') y = 0.5 - h / 2; else if (edge === 'bottom') y = 1 - M - h;
      set(cl(x), cl(y));
    };
    if (selTextA && selIdx !== null) {
      put(Math.max(0.03, selTextA.text.length * selTextA.size * 0.55 * pageHW), selTextA.size * 1.25, selTextA.at, (x, y) => moveText(selIdx, { x, y }));
    } else if (selImage) {
      put(selImage.w, selImage.w * selImage.aspect * pageWH, { x: selImage.x, y: selImage.y }, (x, y) => setImages((arr) => arr.map((im) => (im.id === selImage.id ? { ...im, x, y } : im))));
    }
  };
  // Per-object opacity (selected text or image).
  const selOpacity = selTextA?.opacity ?? selImage?.opacity ?? 1;
  const setSelOpacity = (v: number) => {
    if (selTextA && selIdx !== null) patchSelected({ opacity: v });
    else if (selImage) setImages((arr) => arr.map((im) => (im.id === selImage.id ? { ...im, opacity: v } : im)));
  };

  // ---- Layers panel: every object on the current page, topmost first --------
  type Layer = { key: string; label: string; Icon: typeof Type; hidden: boolean; selected: boolean; canMove: boolean };
  const pageLayers = (): Layer[] => {
    const out: Layer[] = [];
    // Images render above the canvas, so they're the top layers (newest first).
    images.filter((im) => im.page === sel).slice().reverse().forEach((im) => out.push({ key: `i${im.id}`, label: 'Image / signature', Icon: ImagePlus, hidden: !!im.hidden, selected: selImg === im.id, canMove: false }));
    // Then the canvas annotations (last painted = on top → list reversed).
    (annos[sel] || []).map((a, i) => ({ a, i })).reverse().forEach(({ a, i }) => { const m = layerMeta(a); out.push({ key: `t${i}`, label: m.label, Icon: m.Icon, hidden: !!a.hidden, selected: selIdx === i, canMove: true }); });
    return out;
  };
  const toggleLayerHidden = (key: string) => {
    if (key[0] === 't') { const idx = +key.slice(1); setAnnos((a) => { const l = (a[sel] || []).slice(); if (l[idx]) l[idx] = { ...l[idx], hidden: !l[idx].hidden }; return { ...a, [sel]: l }; }); }
    else { const id = key.slice(1); setImages((arr) => arr.map((im) => (im.id === id ? { ...im, hidden: !im.hidden } : im))); }
  };
  const deleteLayer = (key: string) => {
    if (key[0] === 't') { const idx = +key.slice(1); setSelIdx((s) => (s === idx ? null : s)); setAnnos((a) => ({ ...a, [sel]: (a[sel] || []).filter((_, i) => i !== idx) })); }
    else deleteImage(key.slice(1));
  };
  const selectLayer = (key: string) => {
    if (key[0] === 't') { const idx = +key.slice(1); const a = (annos[sel] || [])[idx]; if (a && a.kind === 'text') { setTool('text'); setSelImg(null); setSelIdx(idx); } }
    else { setSelIdx(null); setSelImg(key.slice(1)); }
  };
  // Reorder a canvas annotation's paint order (front/back). dir -1 = up the list
  // = toward the front (later in the array). Selection is index-based, so clear it.
  const moveLayer = (key: string, dir: -1 | 1) => {
    if (key[0] !== 't') return;
    const idx = +key.slice(1), j = idx + (dir === -1 ? 1 : -1);
    setAnnos((a) => { const l = (a[sel] || []).slice(); if (j < 0 || j >= l.length) return a; [l[idx], l[j]] = [l[j], l[idx]]; return { ...a, [sel]: l }; });
    setSelIdx(null);
  };

  // Keyboard: arrow-nudge the selection (Shift = bigger step), Del removes it,
  // Ctrl/Cmd+D duplicates. Ignored while typing in any field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const groupMode = tool === 'select' && group.length > 0;
      if (!selBox && !groupMode) return;
      const step = e.shiftKey ? 0.02 : 0.004;
      const mv = groupMode ? nudgeGroup : nudge;
      const del = groupMode ? deleteGroup : deleteSelected;
      const dup = groupMode ? duplicateGroup : duplicateSelected;
      if (e.key === 'ArrowLeft') { e.preventDefault(); mv(-step, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); mv(step, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mv(0, -step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); mv(0, step); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); dup(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // annos/images in deps so nudge reads FRESH positions after each move/align
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selBox?.x, selBox?.y, selIdx, selImg, sel, tool, group, annos, images]);

  // ---- My Library: save the selected object for one-click reuse on any file ----
  useEffect(() => { setLibrary(loadLibrary()); }, []);
  useEffect(() => {
    if (!libOpen) return;
    const onDown = (e: MouseEvent) => { if (libRef.current && !libRef.current.contains(e.target as Node)) setLibOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [libOpen]);
  function saveToLibrary() {
    if (selImage) setLibrary(addLibraryItem({ id: newLibraryId(), kind: 'image', name: 'Signature', src: selImage.src, aspect: selImage.aspect, createdAt: Date.now() }));
    else if (selTextA) setLibrary(addLibraryItem({ id: newLibraryId(), kind: 'text', name: selTextA.text.slice(0, 24) || 'Text', text: selTextA.text, family: selTextA.family, size: selTextA.size, color: selTextA.color, bold: selTextA.bold, italic: selTextA.italic, underline: selTextA.underline, createdAt: Date.now() }));
    else return;
    setLibOpen(true); // pop the library so the user sees it landed
  }
  function placeFromLibrary(item: LibraryItem) {
    setLibOpen(false);
    if (item.kind === 'image') addImageSrc(item.src, item.aspect);
    else {
      const t: TextA = { kind: 'text', color: item.color, size: item.size, at: { x: 0.38, y: 0.4 }, text: item.text, family: item.family as Family, bold: item.bold, italic: item.italic, underline: item.underline };
      const idx = (annos[sel] || []).length;
      setAnnos((a) => ({ ...a, [sel]: [...(a[sel] || []), t] }));
      setSelIdx(idx);
    }
  }
  const deleteFromLibrary = (id: string) => setLibrary(removeLibraryItem(id));

  // Full colour: apply a custom hex (from the wheel) to the active colour + any
  // selected object, and remember it as a recent swatch.
  const applyCustomColor = (hex: string) => {
    setColor(hex); patchSelected({ color: hex });
    setRecentColors((prev) => [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 5));
  };

  // Style presets — save the current tool + colour + size (+ text styling) and
  // re-apply the whole look in one click. Stored on-device (localStorage).
  useEffect(() => { try { const r = localStorage.getItem('dd-annotate-presets'); if (r) setPresets(JSON.parse(r)); } catch { /* ignore */ } }, []);
  const persistPresets = (list: Preset[]) => { setPresets(list); try { localStorage.setItem('dd-annotate-presets', JSON.stringify(list)); } catch { /* quota */ } };
  const saveCurrentPreset = () => {
    if (tool === 'select') return;
    const label = tool === 'text' ? 'Text' : tool === 'highlight' ? 'Highlight' : tool === 'pen' ? 'Pen' : 'Shape';
    persistPresets([{ id: Math.random().toString(36).slice(2), name: `${label} · ${weight}`, tool, color, weight, family, bold, italic, underline }, ...presets].slice(0, 12));
  };
  const applyPreset = (p: Preset) => { setTool(p.tool); setColor(p.color); setWeight(p.weight); setFamily(p.family); setBold(p.bold); setItalic(p.italic); setUnderline(p.underline); };
  const deletePreset = (id: string) => persistPresets(presets.filter((p) => p.id !== id));

  // Page tools — hand this file straight into a dedicated page tool (no re-upload).
  const handoffTo = (href: string) => { if (!file) return; setHandoff({ files: [file], from: 'Annotate PDF' }); router.push(href); };

  // ---- ⌘K: publish Annotate's deterministic commands to the global palette ----
  const cmdApi = useRef<Record<string, () => void>>({});
  cmdApi.current = {
    select: () => setTool('select'), highlight: () => setTool('highlight'), draw: () => setTool('pen'),
    text: () => setTool('text'), shapes: () => setTool(shape), sign: () => setSigOpen(true),
    image: () => imgFileRef.current?.click(),
    placeSig: () => { const s = library.find((i) => i.kind === 'image'); if (s) placeFromLibrary(s); else setSigOpen(true); },
    library: () => setLibOpen(true), save: () => { void apply(); }, undo: () => undo(), clear: () => clearPage(),
    next: () => setSel((s) => Math.min(pageCount - 1, s + 1)), prev: () => setSel((s) => Math.max(0, s - 1)),
  };
  useEffect(() => {
    if (!file) { clearEditorContext(); return; }
    setEditorContext({
      toolLabel: 'Annotate',
      pageCount,
      goToPage: (n) => setSel(Math.max(0, Math.min(pageCount - 1, n - 1))),
      commands: [
        { id: 'a-sig', label: 'Place my signature', hint: 'from My Library', icon: SignatureIcon, run: () => cmdApi.current.placeSig() },
        { id: 'a-sign', label: 'Draw a signature', icon: SignatureIcon, run: () => cmdApi.current.sign() },
        { id: 'a-image', label: 'Insert an image', icon: ImagePlus, run: () => cmdApi.current.image() },
        { id: 'a-library', label: 'Open My Library', icon: Star, run: () => cmdApi.current.library() },
        { id: 'a-highlight', label: 'Highlight tool', keywords: 'marker', icon: Highlighter, run: () => cmdApi.current.highlight() },
        { id: 'a-draw', label: 'Draw / pen tool', icon: Pen, run: () => cmdApi.current.draw() },
        { id: 'a-text', label: 'Add text', icon: Type, run: () => cmdApi.current.text() },
        { id: 'a-shapes', label: 'Shapes tool', icon: Square, run: () => cmdApi.current.shapes() },
        { id: 'a-select', label: 'Select / move tool', keywords: 'multi select group', icon: MousePointer2, run: () => cmdApi.current.select() },
        { id: 'a-next', label: 'Next page', run: () => cmdApi.current.next() },
        { id: 'a-prev', label: 'Previous page', run: () => cmdApi.current.prev() },
        { id: 'a-save', label: 'Save PDF', icon: Highlighter, run: () => cmdApi.current.save() },
        { id: 'a-undo', label: 'Undo', run: () => cmdApi.current.undo() },
        { id: 'a-clear', label: 'Clear this page', icon: Trash2, run: () => cmdApi.current.clear() },
      ],
    });
    return () => clearEditorContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageCount]);

  // Remove the loaded file and reset the editing state (used by the shell's × and
  // the empty-state after Done). Same teardown the old file chip used.
  const removeFile = () => { clearSession('annotate'); if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setAnnos({}); setImages([]); setSelImg(null); imgCache.current.clear(); };

  const brandToggle = (
    <label className="flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={brandName} onChange={(e) => setBrandName(e.target.checked)} className="size-3.5 accent-primary" />
      Add &ldquo;-diemdesk&rdquo; to the file name
    </label>
  );

  // The live annotation surface — the exact page image + overlay canvas + text
  // draft + image/signature overlays. This is the tool's core editing surface;
  // its refs and pointer handlers are unchanged.
  const surface = (
    <div className="flex items-start justify-center">
      {preview ? (
        <div ref={wrapRef} className="relative inline-block leading-[0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={`Page ${sel + 1}`} className="max-h-[42rem] max-w-full rounded border bg-white shadow-md" draggable={false} />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full touch-none ${tool === 'select' ? 'cursor-default' : tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} onDoubleClick={onDblClick}
          />
          {/* Live snap / alignment guides (dashed rose lines) while dragging */}
          {snapGuides?.v != null && (
            <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px" style={{ left: `${snapGuides.v * 100}%`, background: 'repeating-linear-gradient(#f43f5e 0 5px, transparent 5px 10px)' }} />
          )}
          {snapGuides?.h != null && (
            <div className="pointer-events-none absolute left-0 right-0 z-20 h-px" style={{ top: `${snapGuides.h * 100}%`, background: 'repeating-linear-gradient(90deg, #f43f5e 0 5px, transparent 5px 10px)' }} />
          )}
          {textDraft && (
            <div className="absolute z-10 flex items-start gap-1" style={{ left: `${textDraft.x * 100}%`, top: `${textDraft.y * 100}%` }}>
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
                className="rounded border-2 border-primary bg-white/95 px-1.5 py-0.5 text-sm shadow-lg outline-none"
                style={{ color, fontFamily: FAMILIES[family].css, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', textDecoration: underline ? 'underline' : 'none' }}
              />
              {/* Cancel/delete the text being typed. onMouseDown preventDefault keeps
                  the input focused so onBlur doesn't commit it before we cancel. */}
              <button onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()} onClick={() => setTextDraft(null)}
                aria-label="Delete text" title="Delete"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white shadow"><X className="size-3" /></button>
            </div>
          )}
          {/* "＋ click to add text" hint — follows the cursor when Text is armed */}
          {tool === 'text' && !textDraft && (
            <div ref={hintRef} className="pointer-events-none absolute left-0 top-0 z-20 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground opacity-0 shadow transition-opacity">
              <Plus className="size-3" /> Click to add text
            </div>
          )}
          {/* Draggable image / signature overlays (composited into the page at export) */}
          {pageImages.filter((im) => !im.hidden).map((im) => (
            <div key={im.id}
              onPointerDown={(e) => imgDown(e, im.id, 'move')} onPointerMove={imgMove} onPointerUp={imgUp}
              className={`absolute rounded-sm ${tool === 'select'
                ? `pointer-events-none ${group.includes(`i${im.id}`) ? 'ring-2 ring-primary' : ''}`
                : `cursor-move ${selImg === im.id ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/40'}`}`}
              style={{ left: `${im.x * 100}%`, top: `${im.y * 100}%`, width: `${im.w * 100}%`, opacity: im.opacity ?? 1 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.src} alt="" className="pointer-events-none block w-full select-none" draggable={false} />
              {selImg === im.id && (
                <div onPointerDown={(e) => imgDown(e, im.id, 'resize')} onPointerMove={imgMove} onPointerUp={imgUp}
                  className="absolute -bottom-1.5 -right-1.5 z-10 size-3.5 cursor-nwse-resize rounded-sm border-2 border-primary bg-white" aria-label="Resize" />
              )}
            </div>
          ))}
          {/* Floating contextual toolbar — appears right at the selected object
              (Notion/Docs style) so actions live where your cursor is, not in a
              distant menu. Sits above the object, flips below near the top edge. */}
          {selBox && (
            <div className="pointer-events-none absolute z-30" style={{ left: `${selBox.x * 100}%`, top: `${selBox.y * 100}%` }}>
              <div className={`pointer-events-auto absolute left-0 flex items-center gap-0.5 rounded-xl bg-foreground p-1 shadow-lift ${selBox.y < 0.12 ? 'top-7' : '-top-2 -translate-y-full'}`}>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={duplicateSelected} title="Duplicate (Ctrl+D)" aria-label="Duplicate"
                  className="flex size-7 items-center justify-center rounded-lg text-background transition-colors hover:bg-background/20"><Copy className="size-3.5" /></button>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={saveToLibrary} title="Save to My Library" aria-label="Save to Library"
                  className="flex size-7 items-center justify-center rounded-lg text-background transition-colors hover:bg-background/20"><Star className="size-3.5" /></button>
                <span className="mx-0.5 h-4 w-px bg-background/25" />
                <button onPointerDown={(e) => e.stopPropagation()} onClick={deleteSelected} title="Delete (Del)" aria-label="Delete"
                  className="flex size-7 items-center justify-center rounded-lg text-red-300 transition-colors hover:bg-red-500/25"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          )}
          {/* Select tool: marquee rubber-band while dragging empty space */}
          {tool === 'select' && marquee && (
            <div className="pointer-events-none absolute z-20 rounded-sm border border-primary bg-primary/10"
              style={{ left: `${Math.min(marquee.x0, marquee.x1) * 100}%`, top: `${Math.min(marquee.y0, marquee.y1) * 100}%`, width: `${Math.abs(marquee.x1 - marquee.x0) * 100}%`, height: `${Math.abs(marquee.y1 - marquee.y0) * 100}%` }} />
          )}
          {/* Select tool: group bounding box + group action toolbar */}
          {tool === 'select' && group.length > 0 && (() => {
            const b = groupBox(); if (!b) return null;
            return (
              <div className="pointer-events-none absolute z-30" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                <div className="absolute inset-0 rounded-sm border-2 border-dashed border-primary" />
                <div className={`pointer-events-auto absolute left-0 flex items-center gap-0.5 rounded-xl bg-foreground p-1 shadow-lift ${b.y < 0.12 ? 'top-7' : '-top-2 -translate-y-full'}`}>
                  <span className="px-1.5 text-[11px] font-semibold text-background">{group.length} selected</span>
                  <span className="mx-0.5 h-4 w-px bg-background/25" />
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={duplicateGroup} title="Duplicate (Ctrl+D)" aria-label="Duplicate group"
                    className="flex size-7 items-center justify-center rounded-lg text-background transition-colors hover:bg-background/20"><Copy className="size-3.5" /></button>
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={deleteGroup} title="Delete (Del)" aria-label="Delete group"
                    className="flex size-7 items-center justify-center rounded-lg text-red-300 transition-colors hover:bg-red-500/25"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      )}
    </div>
  );

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={imgFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { pickImageFile(e.target.files); e.currentTarget.value = ''; }} />
      {sigOpen && <SignatureMaker onClose={() => setSigOpen(false)} onCreate={(url, aspect) => addImageSrc(url, aspect)} />}

      {tooBig ? (
        <Card><CardContent className="p-5">
          <UpgradeNotice fileName={tooBig.name} sizeText={fmtBytes(tooBig.size)} limitText={fmtBytes(FREE_MAX_BYTES)} onReset={() => { setTooBig(null); inputRef.current?.click(); }} />
        </CardContent></Card>
      ) : !file ? (
        <Card><CardContent className="p-5">
          {handoffNote && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
              <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
            </p>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Highlight, draw and comment — the document never leaves your device</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
          {error && <UploadError error={error} />}
        </CardContent></Card>
      ) : done ? (
        <Card><CardContent className="p-5">
          <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/annotate-pdf" fromLabel="Annotate PDF" editAgainLabel="Annotate more" onEditAgain={() => setDone(null)} onStartOver={removeFile} />
        </CardContent></Card>
      ) : (
        <div>
          {handoffNote && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
              <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
            </p>
          )}
          <EditorShell
            toolName="Annotate"
            toolIcon={<Highlighter className="size-4 text-primary" />}
            fileName={file.name}
            pageInfo={`${pageCount} page${pageCount === 1 ? '' : 's'}`}
            onClose={removeFile}
            onUndo={undo}
            canUndo={(annos[sel] || []).length > 0}
            onExport={apply}
            exportLabel="Save PDF"
            exporting={busy}
            exportDisabled={markedPages.length === 0}
            toolbar={
              <>
                {toolBtn('select', <MousePointer2 className="size-4" />, 'Select')}
                <span className="mx-0.5 h-6 w-px bg-border/70" />
                {toolBtn('highlight', <Highlighter className="size-4" />, 'Highlight')}
                {toolBtn('pen', <Pen className="size-4" />, 'Draw')}
                <div className="relative" ref={shapesRef}>
                  <button
                    onClick={() => { setTool(shape); setTextDraft(null); setShapesOpen((o) => !o); }}
                    aria-pressed={isShape(tool)} aria-haspopup="menu" aria-expanded={shapesOpen} title="Shapes"
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${isShape(tool) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-accent'}`}>
                    {SHAPE_META[shape].icon} <span className="hidden md:inline">Shapes</span> <ChevronDown className={`size-3.5 transition-transform ${shapesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {shapesOpen && (
                    <div role="menu" className="absolute left-0 top-full z-20 mt-1 w-40 rounded-xl border bg-card p-1 shadow-lift">
                      {SHAPE_KINDS.map((s) => (
                        <button key={s} role="menuitem" onClick={() => { setShape(s); setTool(s); setTextDraft(null); setShapesOpen(false); }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent ${tool === s ? 'text-primary' : ''}`}>
                          {SHAPE_META[s].icon} {SHAPE_META[s].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {toolBtn('text', <Type className="size-4" />, 'Text')}
                <span className="mx-0.5 h-6 w-px bg-border/70" />
                {actionBtn(() => setSigOpen(true), <SignatureIcon className="size-4" />, 'Sign')}
                {actionBtn(() => imgFileRef.current?.click(), <ImagePlus className="size-4" />, 'Image')}
                {/* My Library — one-click reuse of saved signatures, stamps & text */}
                <div className="relative" ref={libRef}>
                  <button onClick={() => setLibOpen((o) => !o)} aria-haspopup="menu" aria-expanded={libOpen} title="My Library"
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${libOpen ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent'}`}>
                    <Star className="size-4" /> <span className="hidden md:inline">Library</span>
                    {library.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{library.length}</span>}
                    <ChevronDown className={`size-3.5 transition-transform ${libOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {libOpen && (
                    <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border bg-card p-2 shadow-lift">
                      <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">My Library</p>
                      {library.length === 0 ? (
                        <p className="px-2 py-5 text-center text-xs text-muted-foreground">Nothing saved yet. Select a signature, stamp or text and tap the <Star className="mb-0.5 inline size-3" /> to save it here for one-click reuse on any file.</p>
                      ) : (
                        <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto">
                          {library.map((it) => (
                            <div key={it.id} className="group relative">
                              <button onClick={() => placeFromLibrary(it)} title={`Place ${it.name}`}
                                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-white p-1 transition-colors hover:border-primary">
                                {it.kind === 'image'
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={it.src} alt={it.name} className="max-h-full max-w-full object-contain" />
                                  : <span className="line-clamp-3 break-words text-[10px] leading-tight" style={{ fontFamily: FAMILIES[it.family as Family].css, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? 'italic' : 'normal' }}>{it.text}</span>}
                              </button>
                              <button onClick={() => deleteFromLibrary(it.id)} aria-label={`Remove ${it.name}`}
                                className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-destructive text-white shadow group-hover:flex"><X className="size-2.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="mx-0.5 h-6 w-px bg-border/70" />
                <button title="Clear page" onClick={clearPage} disabled={!(annos[sel] || []).length && !pageImages.length}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/80 transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/80"><Trash2 className="size-4" /> <span className="hidden md:inline">Clear</span></button>
              </>
            }
            contextBar={
              <>
                <div className="flex items-center gap-1.5 px-0.5">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => { setColor(c); patchSelected({ color: c }); }} aria-label={`colour ${c}`} aria-pressed={color === c}
                      className={`size-6 rounded-full ring-offset-1 ring-offset-card transition-all ${color === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                  ))}
                  {recentColors.filter((c) => !COLORS.includes(c)).slice(0, 4).map((c) => (
                    <button key={c} onClick={() => { setColor(c); patchSelected({ color: c }); }} aria-label={`recent colour ${c}`} aria-pressed={color === c}
                      className={`size-6 rounded-full ring-offset-1 ring-offset-card transition-all ${color === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                  ))}
                  {/* Custom colour — the OS colour wheel + hex, beyond the presets */}
                  <label className="relative flex size-6 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-border transition-all hover:ring-primary/60" title="Custom colour" style={{ background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}>
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#111827'} onChange={(e) => applyCustomColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour picker" />
                    <Plus className="size-3 text-white drop-shadow" />
                  </label>
                </div>
                {tool !== 'text' ? (
                  <>
                    <span className="mx-0.5 h-6 w-px bg-border/70" />
                    <label className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                      Size
                      <input type="range" min={1} max={10} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="dd-range w-20" />
                    </label>
                  </>
                ) : (
                  <>
                    <span className="mx-0.5 h-6 w-px bg-border/70" />
                    <span className="pl-0.5 text-xs font-medium text-muted-foreground">Font</span>
                    <FontSelect value={family} onChange={pickFamily} className="w-40" />
                    <div className="flex items-center gap-1">
                      <button onClick={() => { const v = !bold; setBold(v); patchSelected({ bold: v }); }} aria-pressed={bold} aria-label="Bold"
                        disabled={!FAMILIES[family].bold}
                        title={!FAMILIES[family].bold ? `${FAMILIES[family].label} has no bold style` : undefined}
                        className={`flex size-9 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${bold ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}><Bold className="size-4" /></button>
                      <button onClick={() => { const v = !italic; setItalic(v); patchSelected({ italic: v }); }} aria-pressed={italic} aria-label="Italic"
                        disabled={!FAMILIES[family].italic}
                        title={!FAMILIES[family].italic ? `${FAMILIES[family].label} has no italic style` : undefined}
                        className={`flex size-9 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${italic ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}><Italic className="size-4" /></button>
                      <button onClick={() => { const v = !underline; setUnderline(v); patchSelected({ underline: v }); }} aria-pressed={underline} aria-label="Underline"
                        className={`flex size-9 items-center justify-center rounded-lg border transition-all ${underline ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}><Underline className="size-4" /></button>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      Size
                      <input type="range" min={1} max={16} value={weight} onChange={(e) => { const n = Number(e.target.value); setWeight(n); patchSelected({ size: fontFrac(n) }); }} className="dd-range w-24" />
                      <span className="w-8 tabular-nums text-foreground">{Math.round(fontFrac(weight) * 792)}pt</span>
                    </label>
                  </>
                )}
              </>
            }
            thumbnails={pageCount > 1 ? (
              <PageStrip orientation="vertical" handle={handle} count={pageCount} selected={sel} onSelect={(i) => { setTextDraft(null); setSel(i); }} />
            ) : undefined}
            properties={
              <div className="space-y-3 text-sm">
                {(() => {
                  const layers = pageLayers();
                  return layers.length > 0 ? (
                    <div className="rounded-xl border bg-card p-2 shadow-soft">
                      <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><LayersIcon className="size-3.5 text-primary" /> Layers <span className="text-foreground/45">· {layers.length}</span></div>
                      <div className="max-h-44 space-y-0.5 overflow-y-auto">
                        {layers.map((L) => (
                          <div key={L.key} className={`group flex items-center gap-1 rounded-md px-1.5 py-1 ${L.selected ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-accent'}`}>
                            <button onClick={() => selectLayer(L.key)} className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${L.hidden ? 'opacity-45' : ''}`}>
                              <L.Icon className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate text-xs">{L.label}</span>
                            </button>
                            {L.canMove && (
                              <>
                                <button onClick={() => moveLayer(L.key, -1)} title="Bring forward" aria-label="Bring forward" className="hidden size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:flex"><ChevronUp className="size-3.5" /></button>
                                <button onClick={() => moveLayer(L.key, 1)} title="Send back" aria-label="Send back" className="hidden size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:flex"><ChevronDown className="size-3.5" /></button>
                              </>
                            )}
                            <button onClick={() => toggleLayerHidden(L.key)} title={L.hidden ? 'Show' : 'Hide'} aria-label={L.hidden ? 'Show layer' : 'Hide layer'} className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{L.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
                            <button onClick={() => deleteLayer(L.key)} title="Delete" aria-label="Delete layer" className="hidden size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex"><Trash2 className="size-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                {tool === 'select' ? (
                  group.length > 0 ? (
                    /* Group inspector — align, distribute-lite, duplicate, delete. */
                    <>
                      <p className="flex items-center gap-1.5 font-semibold text-foreground"><MousePointer2 className="size-4 text-primary" /> {group.length} selected</p>
                      {group.length >= 2 && (
                        <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Align</div>
                          <div className="mt-1.5 grid grid-cols-6 gap-1">
                            {([['left', AlignStartVertical], ['hcenter', AlignCenterVertical], ['right', AlignEndVertical], ['top', AlignStartHorizontal], ['vcenter', AlignCenterHorizontal], ['bottom', AlignEndHorizontal]] as const).map(([edge, Icon]) => (
                              <button key={edge} onClick={() => alignGroup(edge)} title={`Align ${edge}`} aria-label={`Align ${edge}`}
                                className="flex aspect-square items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"><Icon className="size-4" /></button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={duplicateGroup} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors hover:bg-accent"><Copy className="size-3.5" /> Duplicate</button>
                        <button onClick={deleteGroup} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="size-3.5" /> Delete</button>
                      </div>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><MoveDiagonal className="size-3" /> Arrow keys move the group · Shift-click to add/remove</p>
                    </>
                  ) : (
                    <div>
                      <p className="flex items-center gap-1.5 font-semibold text-foreground"><MousePointer2 className="size-4 text-primary" /> Select</p>
                      <p className="mt-1 text-xs text-muted-foreground">Drag a box around objects to select them, or click one. Shift-click to add more — then align, move, duplicate or delete them together.</p>
                    </div>
                  )
                ) : selBox ? (
                  /* Object inspector — precise, design-tool-style controls for the
                     selected text or image. */
                  <>
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 font-semibold text-foreground">
                        {selImage ? <ImagePlus className="size-4 text-primary" /> : <Type className="size-4 text-primary" />}
                        {selImage ? 'Image' : 'Text'}
                      </p>
                      <span className="text-[11px] uppercase tracking-wide text-primary">selected</span>
                    </div>
                    <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">X</div>
                          <div className="mt-0.5 rounded-md border px-2 py-1 text-xs tabular-nums">{Math.round(selBox.x * 100)}<span className="text-muted-foreground">%</span></div>
                        </div>
                        <div>
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Y</div>
                          <div className="mt-0.5 rounded-md border px-2 py-1 text-xs tabular-nums">{Math.round(selBox.y * 100)}<span className="text-muted-foreground">%</span></div>
                        </div>
                        {selImage ? (
                          <div className="col-span-2">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Width</div>
                            <div className="mt-0.5 flex items-center gap-1">
                              <button onClick={() => resizeImage(-0.03)} aria-label="Narrower" className="flex size-6 items-center justify-center rounded-md border transition-colors hover:bg-accent"><Minus className="size-3" /></button>
                              <span className="min-w-[3ch] flex-1 text-center text-xs tabular-nums">{Math.round(selImage.w * 100)}%</span>
                              <button onClick={() => resizeImage(0.03)} aria-label="Wider" className="flex size-6 items-center justify-center rounded-md border transition-colors hover:bg-accent"><Plus className="size-3" /></button>
                            </div>
                          </div>
                        ) : selTextA ? (
                          <div className="col-span-2">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Size</div>
                            <div className="mt-0.5 rounded-md border px-2 py-1 text-xs tabular-nums">{Math.round(selTextA.size * 792)}pt</div>
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><MoveDiagonal className="size-3" /> Arrow keys nudge · Shift for bigger steps</p>
                    </div>
                    <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Align to page</div>
                      <div className="mt-1.5 grid grid-cols-6 gap-1">
                        {([['left', AlignStartVertical], ['hcenter', AlignCenterVertical], ['right', AlignEndVertical], ['top', AlignStartHorizontal], ['vcenter', AlignCenterHorizontal], ['bottom', AlignEndHorizontal]] as const).map(([edge, Icon]) => (
                          <button key={edge} onClick={() => alignSelected(edge)} title={`Align ${edge} on page`} aria-label={`Align ${edge} on page`}
                            className="flex aspect-square items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"><Icon className="size-4" /></button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Opacity</span><span className="tabular-nums text-foreground">{Math.round(selOpacity * 100)}%</span>
                      </div>
                      <input type="range" min={10} max={100} value={Math.round(selOpacity * 100)} onChange={(e) => setSelOpacity(Number(e.target.value) / 100)} className="dd-range mt-1.5 w-full" aria-label="Opacity" />
                    </div>
                    {selTextA && (
                      <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Colour</div>
                        <div className="mt-1.5 flex gap-1.5">
                          {COLORS.map((c) => (
                            <button key={c} onClick={() => { setColor(c); patchSelected({ color: c }); }} aria-label={`colour ${c}`}
                              className={`size-6 rounded-full ring-offset-1 ring-offset-card transition-all ${selTextA.color === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={duplicateSelected} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors hover:bg-accent"><Copy className="size-3.5" /> Duplicate</button>
                      <button onClick={deleteSelected} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="size-3.5" /> Delete</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-foreground">{tool === 'text' ? 'Text' : tool === 'highlight' ? 'Highlight' : tool === 'pen' ? 'Draw' : 'Shape'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tool === 'text' ? 'Click to select & drag to move · restyle with the bar above · double-click to edit the words.'
                          : tool === 'highlight' ? 'Drag across the page to highlight. Adjust colour and size above.'
                          : tool === 'pen' ? 'Draw freehand. Adjust colour and size above.'
                          : 'Drag to draw the shape. Adjust colour and size above.'}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-card p-2.5 shadow-soft text-xs text-muted-foreground">
                      {markedPages.length ? `${markedPages.length} page${markedPages.length === 1 ? '' : 's'} marked up.` : 'Nothing marked up yet — pick a tool and start.'}
                      <span className="mt-1 block">Everything stays on your device.</span>
                    </div>
                  </>
                )}
                <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Style presets</span>
                    <button onClick={saveCurrentPreset} disabled={tool === 'select'} title="Save the current tool, colour & size" className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-accent disabled:opacity-40"><Plus className="size-3" /> Save</button>
                  </div>
                  {presets.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Pick a tool, colour &amp; size, then Save to reuse the whole look in one click.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {presets.map((p) => (
                        <div key={p.id} className="group relative">
                          <button onClick={() => applyPreset(p)} title={`Apply ${p.name}`} className="flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2 text-[11px] transition-colors hover:border-primary/50 hover:bg-accent">
                            <span className="size-3 rounded-full ring-1 ring-border" style={{ backgroundColor: p.color }} /> {p.name}
                          </button>
                          <button onClick={() => deletePreset(p.id)} aria-label={`Delete preset ${p.name}`} className="absolute -right-1 -top-1 hidden size-3.5 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"><X className="size-2" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {file && (
                  <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                    <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Page tools</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => handoffTo('/rotate-pdf')} title="Rotate pages — opens Rotate PDF with this file" className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"><RotateCw className="size-4" /> Rotate</button>
                      <button onClick={() => handoffTo('/delete-pages-from-pdf')} title="Delete pages — opens Delete Pages with this file" className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"><FileMinus className="size-4" /> Delete</button>
                      <button onClick={() => handoffTo('/reorder-pdf')} title="Reorder pages — opens Organise/Reorder with this file" className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"><ArrowLeftRight className="size-4" /> Organise</button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">Opens the page tool with this file — no re-upload. Save your markup first.</p>
                  </div>
                )}
                <div className="border-t pt-3">{brandToggle}</div>
              </div>
            }
          >
            {surface}
            {/* Mobile page nav (the vertical rail is hidden below sm) */}
            {pageCount > 1 && (
              <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { setTextDraft(null); setSel(i); }} className="mt-3 sm:hidden" />
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {markedPages.length ? `${markedPages.length} page${markedPages.length === 1 ? '' : 's'} marked up` : 'Pick a tool and mark up the page — everything stays on your device.'}
            </p>
            {/* Brand-name option for small screens (the properties panel is hidden below lg) */}
            <div className="mt-2 lg:hidden">{brandToggle}</div>
          </EditorShell>
          {error && <UploadError error={error} />}
        </div>
      )}
    </>
  );
}
