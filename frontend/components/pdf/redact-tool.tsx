'use client';
import { UploadError, wrongTypeError } from '@/components/app/upload-error';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, EyeOff, Trash2, Zap, ShieldCheck, Search, Sparkles, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadBlob as download } from '@/lib/download';
import { PdfDone } from '@/components/app/pdf-done';
import { takeHandoff } from '@/lib/handoff';
import { openPdf, renderPage, dprTarget, getPdfjs, type PdfHandle, type RenderedPage } from '@/lib/pdf-render';
import { PageStrip } from '@/components/pdf/page-strip';
import { EditorShell } from '@/components/pdf/editor-shell';
import { setEditorContext, clearEditorContext } from '@/lib/command-registry';
import { saveSession, loadSessionAsync, clearSession } from '@/lib/editor-session';
import { Mail, Phone, CreditCard, Hash, Info, History } from 'lucide-react';
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

// Pro "pattern presets": auto-find common sensitive data across the whole
// document. Each tests a single text run (pdf.js emits text per run) — a match
// means that run gets boxed for the user to review before the true-removal
// export. Deliberately greedy (covers the whole run that contains a match)
// because for redaction over-covering is safe and under-covering is not.
const PATTERNS: { id: string; label: string; test: RegExp }[] = [
  { id: 'email', label: 'Emails', test: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { id: 'phone', label: 'Phone numbers', test: /(?:\+?\d[\s().-]?){7,}\d/ },
  { id: 'ssn', label: 'SSNs', test: /\b\d{3}-\d{2}-\d{4}\b/ },
  { id: 'card', label: 'Card numbers', test: /\b(?:\d[ -]?){13,16}\b/ },
];

// Draw the redaction boxes onto ctx (W×H). Used for both the on-screen overlay
// (boxes only, over the page <img>) and the export (composited over the raster).
function drawBoxes(ctx: CanvasRenderingContext2D, W: number, H: number, list: Box[], style: Style, label = 'REDACTED') {
  const text = label.trim();
  for (const b of list) {
    const x = Math.min(b.a.x, b.b.x) * W, y = Math.min(b.a.y, b.b.y) * H;
    const w = Math.abs(b.b.x - b.a.x) * W, h = Math.abs(b.b.y - b.a.y) * H;
    if (w < 1 || h < 1) continue;
    ctx.globalAlpha = 1;
    ctx.fillStyle = style === 'white' ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, w, h);
    if (style === 'white') { ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    if (style === 'label' && text) {
      const fs = Math.max(8, Math.min(h * 0.55, w / (text.length * 0.62)));
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
    }
  }
}

export function RedactTool() {
  const plan = usePlan();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState<{ name: string; size: number } | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [style, setStyle] = useState<Style>('black');
  const [labelText, setLabelText] = useState('REDACTED');
  const [boxes, setBoxes] = useState<Record<number, Box[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string; secs: number; verified?: { pages: number; beforeChars: number; afterChars: number } } | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [brandName, setBrandName] = useState(false); // opt-in "-diemdesk" filename suffix
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState<string | null>(null); // label of the scan in flight
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [restorable, setRestorable] = useState<{ name: string; run: () => void } | null>(null); // saved session offered on the dropzone

  const isPro = plan === 'pro'; // owner cookie / Pro email resolve to 'pro' via usePlan()

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const live = useRef<Box | null>(null);

  async function loadOne(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError(wrongTypeError(f.name)); return; }
    if (!canProcessSize(f.size, plan)) { setError(null); setTooBig({ name: f.name, size: f.size }); return; }
    setTooBig(null); setError(null); setDone(null); setBusy(true); setBoxes({}); setPreview(null);
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
    // No handoff — OFFER the last session as a "pick up where you left off" prompt
    // on the dropzone, instead of silently reloading the old file.
    let alive = true;
    void loadSessionAsync<{ boxes: Record<number, Box[]> }>('redact').then((sess) => {
      if (!alive || !sess) return;
      setRestorable({ name: sess.file.name, run: () => {
        setRestorable(null);
        setBoxes(sess.data.boxes || {});
        setBusy(true);
        void openPdf(sess.file).then((hh) => { setHandle(hh); setPageCount(hh.numPages); setSel(0); setFile(sess.file); }).catch(() => clearSession('redact')).finally(() => setBusy(false));
      } });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (handle) void handle.destroy(); }, [handle]);
  // Persist the redaction session (in-memory) across in-app navigation.
  useEffect(() => { if (file) saveSession('redact', file, { boxes }); }, [file, boxes]);

  // Keep the previous page visible until the next render is ready (no
  // collapse-to-spinner flicker on page change). A fresh file clears preview in
  // loadOne, so the first page still shows a clean loading state.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    const dpr = dprTarget(560, 2.2, 1700);
    void renderPage(handle, sel, dpr).then((p) => {
      if (cancelled) return;
      setPreview(p);
      if (sel + 1 < pageCount) void renderPage(handle, sel + 1, dpr).catch(() => {});
      if (sel - 1 >= 0) void renderPage(handle, sel - 1, dpr).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [handle, sel, pageCount]);

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
    drawBoxes(ctx, c.width, c.height, list, style, labelText);
  }, [boxes, sel, style, labelText]);

  useEffect(() => { repaint(); }, [repaint, preview]);
  useEffect(() => {
    const onResize = () => repaint();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [repaint]);

  // Ctrl/Cmd+Z removes the last redaction box on the current page (ignored while
  // typing in the search or label fields).
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

  // Pro: scan every page's text layer and box each run that matches `test`, so
  // the user reviews the candidates before the true-removal export. Positions
  // come from pdf.js — each run's transform maps to device pixels via the
  // page viewport, then to page fractions (resolution-independent, matching how
  // manual boxes are stored). Never redacts blindly: it only adds boxes.
  const scan = useCallback(async (test: (s: string) => boolean, label: string) => {
    if (!handle || scanning) return;
    setScanning(label); setScanNote(null); setError(null);
    try {
      const pdfjs = await getPdfjs();
      const next: Record<number, Box[]> = {};
      for (const k of Object.keys(boxes)) next[Number(k)] = [...boxes[Number(k)]];
      let hits = 0; let firstHit = -1; let textRuns = 0;
      for (let i = 0; i < handle.numPages; i++) {
        const page = await handle.doc.getPage(i + 1);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        for (const it of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
          const s = it.str;
          if (s && s.trim()) textRuns++;
          if (!s || !s.trim() || !it.transform || !test(s)) continue;
          const m = pdfjs.Util.transform(vp.transform, it.transform);
          const fontH = Math.hypot(m[2], m[3]) || (it.height || 8);
          const w = (it.width || 0) * vp.scale;
          const left = m[4];
          const top = m[5] - fontH; // baseline → top edge
          const pad = fontH * 0.2;
          const a = { x: Math.max(0, (left - pad) / vp.width), y: Math.max(0, (top - pad) / vp.height) };
          const b = { x: Math.min(1, (left + w + pad) / vp.width), y: Math.min(1, (top + fontH + pad) / vp.height) };
          if (b.x - a.x < 0.004 || b.y - a.y < 0.004) continue;
          (next[i] ||= []).push({ a, b });
          hits++; if (firstHit < 0) firstHit = i;
        }
      }
      setBoxes(next);
      if (firstHit >= 0) setSel(firstHit);
      setScanNote(hits
        ? `Found ${hits} match${hits === 1 ? '' : 'es'} for ${label} — review the boxes on each page, then Redact & download.`
        : textRuns === 0
          ? `This looks like a scanned PDF — it has no selectable text, so search can't read it. Draw redaction boxes by hand (that always works), or run OCR to add a text layer first (coming to Pro).`
          : `No matches for ${label} in this document's text.`);
    } catch {
      setError('Could not scan this PDF’s text. It may be a scanned/image-only PDF — draw the boxes by hand instead.');
    } finally { setScanning(null); }
  }, [handle, boxes, scanning]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    const needle = q.toLowerCase();
    void scan((s) => s.toLowerCase().includes(needle), `“${q}”`);
  };

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
          // createImageBitmap, not img.decode(blobURL) — the latter can hang on
          // some engines and would freeze the whole redaction export.
          const bitmap = await createImageBitmap(await (await fetch(rp.url)).blob());
          ctx.drawImage(bitmap, 0, 0, rp.w, rp.h);
          bitmap.close();
          drawBoxes(ctx, rp.w, rp.h, boxes[i], style, labelText);
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
      const verifyBytes = new Uint8Array(bytes); // dedicated copy — pdf.js detaches what it parses
      const name = `${file.name.replace(/\.pdf$/i, '')}-redacted${brandName ? '-diemdesk' : ''}.pdf`;
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      download(blob, name);

      // Prove the redaction did what it claims: count selectable characters on
      // the redacted pages BEFORE, then in the OUTPUT. Rasterized pages have no
      // text layer, so "after" should be 0 — the difference between "looks
      // redacted" (a box over live text you can still copy) and "is redacted".
      let verified: { pages: number; beforeChars: number; afterChars: number } | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const charsOnPage = async (pageProxy: any) => {
          const tc = await pageProxy.getTextContent();
          let t = 0;
          for (const it of tc.items as Array<{ str?: string }>) t += (it.str || '').length;
          return t;
        };
        let beforeChars = 0;
        for (const i of redactedPages) beforeChars += await charsOnPage(await handle.doc.getPage(i + 1));
        const pdfjs = await getPdfjs();
        const task = pdfjs.getDocument({ data: verifyBytes });
        const vdoc = await task.promise;
        let afterChars = 0;
        for (const i of redactedPages) afterChars += await charsOnPage(await vdoc.getPage(i + 1));
        await task.destroy();
        verified = { pages: redactedPages.length, beforeChars, afterChars };
      } catch { /* verification is best-effort; never block the download */ }
      setDone({ blob, name, secs: (performance.now() - t0) / 1000, verified });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redact the PDF.');
    } finally { setBusy(false); }
  }

  // Premium segmented style button (filled when active), with a swatch preview.
  const styleBtn = (id: Style, label: string, swatch: string) => (
    <button key={id} onClick={() => setStyle(id)} aria-pressed={style === id}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${style === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-accent'}`}>
      <span className="size-3 rounded-sm border border-black/20" style={{ background: swatch }} /> {label}
    </button>
  );

  // ---- ⌘K: publish Redact's deterministic commands to the global palette.
  // "Redact all emails/…" runs the REGEX presets (no AI). Pro-gated: a free user
  // is sent to pricing rather than running the scan. ----
  const cmdApi = useRef<Record<string, () => void>>({});
  cmdApi.current = {
    preset: () => {},
    redact: () => { void apply(); },
    clear: () => clearPage(),
    next: () => setSel((s) => Math.min(pageCount - 1, s + 1)),
    prev: () => setSel((s) => Math.max(0, s - 1)),
  };
  const runPreset = (id: string) => {
    if (!isPro) { router.push('/pricing'); return; }
    const p = PATTERNS.find((x) => x.id === id);
    if (p) void scan((s) => p.test.test(s), p.label);
  };
  const runPresetRef = useRef(runPreset);
  runPresetRef.current = runPreset;
  useEffect(() => {
    if (!file) { clearEditorContext(); return; }
    setEditorContext({
      toolLabel: 'Redact',
      pageCount,
      goToPage: (n) => setSel(Math.max(0, Math.min(pageCount - 1, n - 1))),
      commands: [
        { id: 'r-email', label: 'Redact all emails', hint: 'finds & boxes every email', keywords: 'email address', icon: Mail, pro: true, run: () => runPresetRef.current('email') },
        { id: 'r-phone', label: 'Redact all phone numbers', keywords: 'telephone', icon: Phone, pro: true, run: () => runPresetRef.current('phone') },
        { id: 'r-ssn', label: 'Redact all SSNs', keywords: 'social security', icon: Hash, pro: true, run: () => runPresetRef.current('ssn') },
        { id: 'r-card', label: 'Redact all card numbers', keywords: 'credit card', icon: CreditCard, pro: true, run: () => runPresetRef.current('card') },
        { id: 'r-next', label: 'Next page', run: () => cmdApi.current.next() },
        { id: 'r-prev', label: 'Previous page', run: () => cmdApi.current.prev() },
        { id: 'r-apply', label: 'Redact & download', icon: EyeOff, run: () => cmdApi.current.redact() },
        { id: 'r-clear', label: 'Clear this page', icon: Trash2, run: () => cmdApi.current.clear() },
      ],
    });
    return () => clearEditorContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageCount]);

  const removeFile = () => { clearSession('redact'); if (handle) void handle.destroy(); setHandle(null); setFile(null); setDone(null); setError(null); setBoxes({}); };

  const brandToggle = (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={brandName} onChange={(e) => setBrandName(e.target.checked)} className="size-3.5 accent-primary" />
      Add &ldquo;-diemdesk&rdquo; to the file name
    </label>
  );

  // Pro "Find & redact" — search + pattern presets. Manual box-drawing is always
  // free; free users see the locked upsell. Rendered full-width above the canvas.
  const presetIcon: Record<string, typeof Mail> = { email: Mail, phone: Phone, ssn: Hash, card: CreditCard };
  const findPanel = (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm"><Sparkles className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Find &amp; redact</h3>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"><Sparkles className="size-2.5" /> Pro</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Find &amp; box every match across the document&rsquo;s text — then truly remove them.</p>
        </div>
      </div>
      {isPro ? (
        <div className="mt-3">
          <div className="flex items-center gap-1 rounded-xl border bg-background pl-3 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="Find a word, name or number to redact everywhere…"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
            />
            <Button size="sm" onClick={runSearch} disabled={!!scanning || !query.trim()} className="my-1 mr-1 shrink-0">
              {scanning && scanning.startsWith('“') ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Find all
            </Button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Quick presets</span>
            {PATTERNS.map((p) => { const Icon = presetIcon[p.id] ?? Hash; return (
              <button
                key={p.id}
                onClick={() => void scan((s) => p.test.test(s), p.label)}
                disabled={!!scanning}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium transition-all hover:-translate-y-px hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-700 disabled:opacity-50 dark:hover:text-amber-300"
              >
                {scanning === p.label ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />} {p.label}
              </button>
            ); })}
          </div>
          {scanNote && <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" /> {scanNote}</p>}
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 sm:flex-row sm:items-center">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-500" /> <span>Drawing redaction boxes by hand is <strong className="font-semibold text-foreground">always free</strong>. Pro finds &amp; boxes every email, phone, SSN &amp; card number — or any word you type — in one click.</span>
          </p>
          <Button asChild size="sm" className="shrink-0 bg-amber-500 text-white hover:bg-amber-600 sm:ml-auto"><Link href="/pricing"><Sparkles className="size-3.5" /> Upgrade to Pro</Link></Button>
        </div>
      )}
    </div>
  );

  // The redaction surface — page image + box-drawing overlay canvas. Unchanged engine.
  const surface = (
    <div className="flex items-start justify-center">
      {preview ? (
        <div ref={wrapRef} className="relative inline-block leading-[0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={`Page ${sel + 1}`} className="max-h-[42rem] max-w-full rounded border bg-white shadow-md" draggable={false} />
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
  );

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />

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
          {restorable && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-sm">
              <History className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">Pick up where you left off — <b className="font-medium">{restorable.name}</b></span>
              <button onClick={restorable.run} className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">Restore</button>
              <button onClick={() => { clearSession('redact'); setRestorable(null); }} className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent">Start fresh</button>
            </div>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Upload className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Drop a PDF here, or click to choose</p>
            <p className="text-xs text-muted-foreground">Black out sensitive content — permanently, on your device</p>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose PDF</span>
          </div>
          {error && <UploadError error={error} />}
        </CardContent></Card>
      ) : done ? (
        <Card><CardContent className="p-5">
          {done.verified && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                {done.verified.afterChars === 0 ? <ShieldCheck className="size-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-5 shrink-0 text-amber-500" />}
                <p className="text-sm font-semibold">
                  {done.verified.afterChars === 0 ? 'Redaction verified — the text is gone, not just covered' : 'Redaction applied'}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We re-scanned the {done.verified.pages} redacted page{done.verified.pages === 1 ? '' : 's'}: {done.verified.beforeChars.toLocaleString()} selectable character{done.verified.beforeChars === 1 ? '' : 's'} →{' '}
                <span className={done.verified.afterChars === 0 ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-amber-600'}>{done.verified.afterChars.toLocaleString()} left</span>.
                {' '}Those pages are now flat images, so the hidden text can’t be selected, copied, searched, or recovered — unlike a plain black box drawn over live text.
              </p>
            </div>
          )}
          <PdfDone blob={done.blob} name={done.name} secs={done.secs} currentHref="/redact-pdf" fromLabel="Redact PDF" editAgainLabel="Redact more" onEditAgain={() => setDone(null)} onStartOver={removeFile} />
        </CardContent></Card>
      ) : (
        <div>
          {handoffNote && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
              <Zap className="size-4 shrink-0 text-primary" /> {handoffNote}
            </p>
          )}
          <EditorShell
            toolName="Redact"
            toolIcon={<EyeOff className="size-4 text-primary" />}
            fileName={file.name}
            pageInfo={`${pageCount} page${pageCount === 1 ? '' : 's'}`}
            onClose={removeFile}
            onUndo={undo}
            canUndo={(boxes[sel] || []).length > 0}
            onExport={apply}
            exportLabel="Redact"
            exporting={busy}
            exportDisabled={redactedPages.length === 0}
            toolbar={
              <>
                <span className="pl-1 text-xs font-medium text-muted-foreground">Box style</span>
                {styleBtn('black', 'Black', '#111827')}
                {styleBtn('white', 'White', '#ffffff')}
                {styleBtn('label', 'Labelled', '#111827')}
                {style === 'label' && (
                  <input
                    value={labelText}
                    onChange={(e) => setLabelText(e.target.value)}
                    maxLength={24}
                    placeholder="REDACTED"
                    aria-label="Label text"
                    className="w-32 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                )}
                <span className="mx-0.5 h-6 w-px bg-border/70" />
                <button title="Clear page" onClick={clearPage} disabled={!(boxes[sel] || []).length}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/80 transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/80"><Trash2 className="size-4" /> <span className="hidden md:inline">Clear</span></button>
              </>
            }
            thumbnails={pageCount > 1 ? (
              <PageStrip orientation="vertical" handle={handle} count={pageCount} selected={sel} onSelect={setSel} />
            ) : undefined}
            properties={
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border bg-card p-2.5 shadow-soft">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground"><ShieldCheck className="size-4 text-emerald-600" /> True redaction</p>
                  <p className="mt-1 text-xs text-muted-foreground">Drag a box over anything sensitive. On export the content underneath is permanently removed — never just covered.</p>
                </div>
                <div className="rounded-xl border bg-card p-2.5 text-xs text-muted-foreground shadow-soft">
                  {totalBoxes ? `${totalBoxes} area${totalBoxes === 1 ? '' : 's'} on ${redactedPages.length} page${redactedPages.length === 1 ? '' : 's'} marked.` : 'Nothing marked yet — drag a box over sensitive content.'}
                  <span className="mt-1 block">Everything stays on your device.</span>
                </div>
                <div className="rounded-xl border bg-card p-2.5 shadow-soft">{brandToggle}</div>
              </div>
            }
          >
            <div className="mx-auto max-w-3xl">{findPanel}</div>
            <div className="mt-3">{surface}</div>
            {pageCount > 1 && (
              <PageStrip handle={handle} count={pageCount} selected={sel} onSelect={setSel} className="mt-3 sm:hidden" />
            )}
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              {totalBoxes ? `${totalBoxes} area${totalBoxes === 1 ? '' : 's'} on ${redactedPages.length} page${redactedPages.length === 1 ? '' : 's'} — content is permanently removed on export.` : 'Drag a box over anything sensitive. The content underneath is permanently removed — never just covered.'}
            </p>
            <div className="mt-2 lg:hidden">{brandToggle}</div>
          </EditorShell>
          {error && <UploadError error={error} />}
        </div>
      )}
    </>
  );
}
