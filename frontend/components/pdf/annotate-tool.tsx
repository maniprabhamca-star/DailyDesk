'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, Highlighter, Pen, Square, Circle, Minus, ArrowUpRight, ChevronDown, Type, Undo2, Trash2, Zap, Bold, Italic, Underline, Signature as SignatureIcon, ImagePlus, Plus } from 'lucide-react';
import { SignatureMaker } from './signature-maker';
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
import { FAMILIES, type Family } from '@/lib/fonts';
import { FontSelect } from '@/components/app/font-select';

// Annotate PDF — highlight, draw, box and type on a live page preview, then
// flatten the markup onto the original pages with the shared place-image rewrite
// (a transparent full-page PNG per page). 100% on-device: the file and your
// notes never leave the browser. Coordinates are stored as page fractions so the
// on-screen canvas and the high-res export stay pixel-perfect at any size.

type ShapeKind = 'rect' | 'circle' | 'line' | 'arrow';
type Tool = 'highlight' | 'pen' | ShapeKind | 'text';
type Pt = { x: number; y: number };
type Stroke = { kind: 'pen' | 'highlight'; color: string; w: number; pts: Pt[] };
type ShapeA = { kind: ShapeKind; color: string; w: number; a: Pt; b: Pt };
type TextA = { kind: 'text'; color: string; size: number; at: Pt; text: string; family: Family; bold: boolean; italic: boolean; underline: boolean };
type Anno = Stroke | ShapeA | TextA;
// Images + signatures live as draggable overlays (not on the stroke canvas) and
// are composited into the page at export. x/y = top-left fraction, w = width
// fraction of the page, aspect = image height/width (in px).
type ImageItem = { id: string; page: number; x: number; y: number; w: number; aspect: number; src: string };
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
    if (a.kind === 'rect' || a.kind === 'circle' || a.kind === 'line' || a.kind === 'arrow') {
      ctx.globalAlpha = 1;
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
      ctx.globalAlpha = 1;
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

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); return; }
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
  // Deselect when switching tool or page.
  useEffect(() => { setSelIdx(null); }, [tool, sel]);
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
    setSelImg(null); // clicking the page deselects any image/signature
    const p = frac(e);
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
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    // "＋ click to add text" hint follows the cursor while the Text tool is armed.
    if (tool === 'text' && !textDraft && !textDrag.current && hintRef.current && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      hintRef.current.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
      hintRef.current.style.opacity = '1';
    }
    if (textDrag.current) {
      const d = textDrag.current; const q = frac(e);
      moveText(d.idx, { x: Math.min(1, Math.max(0, q.x - d.ox)), y: Math.min(1, Math.max(0, q.y - d.oy)) });
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
    if (textDrag.current) { textDrag.current = null; return; }
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
    setImages((arr) => arr.map((im) => {
      if (im.id !== d.id) return im;
      if (d.mode === 'move') {
        const hFrac = im.w * im.aspect * (r.width / r.height);
        const x = Math.min(Math.max((e.clientX - r.left - d.ox) / r.width, 0), Math.max(0, 1 - im.w));
        const y = Math.min(Math.max((e.clientY - r.top - d.oy) / r.height, 0), Math.max(0, 1 - hFrac));
        return { ...im, x, y };
      }
      const w = Math.min(Math.max(d.startW + (e.clientX - d.ox) / r.width, 0.05), 1 - im.x);
      return { ...im, w };
    }));
  }
  function imgUp() { imgDrag.current = null; }
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
        for (const im of images.filter((i) => i.page === idx)) {
          const el = imgCache.current.get(im.src);
          if (el) { const w = im.w * rp.w; ctx.drawImage(el, im.x * rp.w, im.y * rp.h, w, w * im.aspect); }
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

  return (
    <Card>
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        <input ref={imgFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { pickImageFile(e.target.files); e.currentTarget.value = ''; }} />
        {sigOpen && <SignatureMaker onClose={() => setSigOpen(false)} onCreate={(url, aspect) => addImageSrc(url, aspect)} />}
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
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setAnnos({}); setImages([]); setSelImg(null); imgCache.current.clear(); }}><X className="size-4" /></Button>
          </div>
        )}

        {file && !done && (
          <div className="mt-4">
            {/* Premium toolbar — one cohesive bar, grouped by dividers */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-soft">
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
              <span className="mx-0.5 h-6 w-px bg-border/70" />
              <div className="flex items-center gap-1.5 px-0.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => { setColor(c); patchSelected({ color: c }); }} aria-label={`colour ${c}`} aria-pressed={color === c}
                    className={`size-6 rounded-full ring-offset-1 ring-offset-card transition-all ${color === c ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/50'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              {tool !== 'text' && (
                <>
                  <span className="mx-0.5 h-6 w-px bg-border/70" />
                  <label className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                    Size
                    <input type="range" min={1} max={10} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="dd-range w-20" />
                  </label>
                </>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <button title="Undo (Ctrl+Z)" onClick={undo} disabled={!(annos[sel] || []).length}
                  className="flex size-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"><Undo2 className="size-4" /></button>
                <button title="Clear page" onClick={clearPage} disabled={!(annos[sel] || []).length && !pageImages.length}
                  className="flex size-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/70"><Trash2 className="size-4" /></button>
              </div>
            </div>

            {/* Text options — font + bold/italic/underline (Text tool only) */}
            {tool === 'text' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2 shadow-soft">
                <span className="pl-1 text-xs font-medium text-muted-foreground">Font</span>
                <FontSelect value={family} onChange={pickFamily} className="w-44" />
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
                <span className="ml-auto text-[11px] text-muted-foreground">Click to select &amp; drag to move · restyle with the toolbar · double-click to edit words</span>
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
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onLeave} onDoubleClick={onDblClick}
                  />
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
                  {pageImages.map((im) => (
                    <div key={im.id}
                      onPointerDown={(e) => imgDown(e, im.id, 'move')} onPointerMove={imgMove} onPointerUp={imgUp}
                      className={`absolute cursor-move rounded-sm ${selImg === im.id ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/40'}`}
                      style={{ left: `${im.x * 100}%`, top: `${im.y * 100}%`, width: `${im.w * 100}%` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.src} alt="" className="pointer-events-none block w-full select-none" draggable={false} />
                      {selImg === im.id && (
                        <>
                          <button onPointerDown={(e) => { e.stopPropagation(); deleteImage(im.id); }} aria-label="Delete"
                            className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow"><X className="size-3" /></button>
                          <div onPointerDown={(e) => imgDown(e, im.id, 'resize')} onPointerMove={imgMove} onPointerUp={imgUp}
                            className="absolute -bottom-1.5 -right-1.5 z-10 size-3.5 cursor-nwse-resize rounded-sm border-2 border-primary bg-white" aria-label="Resize" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              )}
            </div>

            {pageCount > 1 && <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={(i) => { setTextDraft(null); setSel(i); }} className="mt-2" />}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {markedPages.length ? `${markedPages.length} page${markedPages.length === 1 ? '' : 's'} marked up` : 'Pick a tool and mark up the page — everything stays on your device.'}
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
            <Button className="mt-2 w-full" size="lg" onClick={apply} disabled={busy || markedPages.length === 0}>
              {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Highlighter className="size-4" /> Save annotated PDF</>}
            </Button>
          </>
        )}

        {done && <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/annotate-pdf" fromLabel="Annotate PDF" />}
      </CardContent>
    </Card>
  );
}
