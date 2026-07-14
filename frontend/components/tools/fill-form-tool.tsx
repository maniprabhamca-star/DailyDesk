'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, X, Download, Loader2, Type, Check, Calendar, PenLine, Undo2, Trash2,
  ChevronLeft, ChevronRight, MousePointer2, ClipboardCheck, Info, AlignLeft, AlignCenter,
  AlignRight, ChevronDown, Eraser, RotateCcw, ListChecks, Lock, PenTool,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { BigFileHint } from '@/components/app/big-file-hint';
import { KeepGoing } from '@/components/app/keep-going';
import { openPdf, renderPage, type PdfHandle } from '@/lib/pdf-render';
import {
  extractNativeFields, exportFilledPdf, fontFamilyFor, glyphFor,
  type FillEl, type FillKind, type NativeField, type NativeValue, type FieldCustom, type FontKey,
} from '@/lib/fill-pdf';

const MAX_W = 520, MAX_H = 680;
let idc = 0;
const uid = () => `e${++idc}`;
const todayStr = () => new Date().toLocaleDateString();

type Tool = 'select' | FillKind;
const TOOLS: { id: Tool; label: string; icon: typeof Type }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'check', label: 'Check', icon: Check },
  { id: 'x', label: 'X mark', icon: X },
  { id: 'date', label: 'Date', icon: Calendar },
  { id: 'signature', label: 'Signature', icon: PenLine },
];

const FONTS: { id: FontKey; label: string }[] = [
  { id: 'Helvetica', label: 'Helvetica' },
  { id: 'Times', label: 'Times' },
  { id: 'Courier', label: 'Courier' },
];
const SWATCHES = ['#111827', '#1e3a8a', '#b91c1c', '#15803d'];

export function FillFormTool() {
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [pageImg, setPageImg] = useState<{ url: string; w: number; h: number } | null>(null);

  // native AcroForm layer
  const [nativeFields, setNativeFields] = useState<NativeField[]>([]);
  const [nativeValues, setNativeValues] = useState<Record<string, NativeValue>>({});
  const [nativeCustom, setNativeCustom] = useState<Record<string, FieldCustom>>({});
  const [selKey, setSelKey] = useState<string | null>(null);
  const [flatten, setFlatten] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const [enterAdvance, setEnterAdvance] = useState(true);

  // place-anywhere overlay layer
  const [tool, setTool] = useState<Tool>('select');
  const [els, setEls] = useState<FillEl[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [sigName, setSigName] = useState('');
  const [sigDraft, setSigDraft] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  const disp = pageImg ? (() => { const s = Math.min(MAX_W / pageImg.w, MAX_H / pageImg.h); return { w: pageImg.w * s, h: pageImg.h * s }; })() : null;
  const sel = els.find((e) => e.id === selId) || null;
  const selField = nativeFields.find((f) => f.key === selKey) || null;
  const hasNative = nativeFields.length > 0;

  useEffect(() => () => { handle?.destroy?.(); }, [handle]);

  // Overlay text-like item: jump to typing. Depend ONLY on selId (see history:
  // depending on `sel` re-selects on every keystroke and overwrites each char).
  useEffect(() => {
    const el = els.find((e) => e.id === selId);
    if (el && (el.kind === 'text' || el.kind === 'date' || el.kind === 'signature')) {
      const t = setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 30);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  // Selecting a native text/dropdown field focuses its in-place control. Depend
  // on selKey + pageIdx (a cross-page jump re-renders the control after paging).
  useEffect(() => {
    if (!selKey) return;
    const f = nativeFields.find((x) => x.key === selKey);
    if (!f || (f.type !== 'text' && f.type !== 'dropdown')) return;
    const t = setTimeout(() => {
      const el = stageRef.current?.querySelector(`[data-fkey="${CSS.escape(selKey)}"]`) as HTMLInputElement | HTMLSelectElement | null;
      el?.focus();
      if (el && 'select' in el && f.type === 'text') (el as HTMLInputElement).select?.();
    }, 45);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, pageIdx]);

  async function loadFile(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setError(null); setDone(null); setEls([]); setSelId(null); setSelKey(null); setPageIdx(0);
    setNativeValues({}); setNativeCustom({});
    try {
      const h = await openPdf(f);
      setHandle(h); setNumPages(h.numPages); setFile(f);
      const img = await renderPage(h, 0, 1600);
      setPageImg({ url: img.url, w: img.w, h: img.h });
      const fields = await extractNativeFields(f);
      setNativeFields(fields);
      // Real form → keep it editable by default and start in Select (click fields);
      // flat scan → lock on export and start with the Text tool (place your own).
      setFlatten(fields.length === 0);
      setTool(fields.length ? 'select' : 'text');
    } catch {
      setError('Could not open that PDF.');
    }
  }

  const gotoPage = useCallback(async (i: number) => {
    if (!handle || i < 0 || i >= numPages) return;
    setPageIdx(i); setSelId(null);
    try { const img = await renderPage(handle, i, 1600); setPageImg({ url: img.url, w: img.w, h: img.h }); } catch { /* ignore stale */ }
  }, [handle, numPages]);

  // ── native field helpers ──────────────────────────────────────────────────
  const tv = (name: string) => { const v = nativeValues[name]; return typeof v === 'string' ? v : ''; };
  const cv = (name: string) => nativeValues[name] === true;
  const setV = (name: string, v: NativeValue) => setNativeValues((p) => ({ ...p, [name]: v }));
  const cust = (name: string): FieldCustom => nativeCustom[name] || {};
  const setCust = (name: string, patch: Partial<FieldCustom>) => setNativeCustom((p) => ({ ...p, [name]: { ...p[name], ...patch } }));

  const isFilled = (f: NativeField) => {
    const v = nativeValues[f.name];
    if (f.type === 'checkbox') return v === true;
    if (f.type === 'optionlist') return Array.isArray(v) && v.length > 0;
    return typeof v === 'string' && v.trim().length > 0;
  };
  const filledCount = nativeFields.filter(isFilled).length;

  const gotoField = useCallback((order: number) => {
    if (!nativeFields.length) return;
    const n = nativeFields.length;
    const f = nativeFields[((order % n) + n) % n];
    setSelId(null); setSelKey(f.key);
    if (f.page !== pageIdx) void gotoPage(f.page);
  }, [nativeFields, pageIdx, gotoPage]);

  function onFieldKey(e: React.KeyboardEvent, f: NativeField) {
    if (e.key === 'Tab') { e.preventDefault(); gotoField(f.order + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Enter' && enterAdvance && !(f.type === 'text' && f.multiline)) { e.preventDefault(); gotoField(f.order + 1); }
    else if (e.key === 'Escape') { (e.target as HTMLElement).blur(); setSelKey(null); }
  }

  function applyToAllText() {
    if (!selField) return;
    const c = cust(selField.name);
    setNativeCustom((prev) => {
      const next = { ...prev };
      for (const f of nativeFields) if (f.type === 'text') next[f.name] = { ...next[f.name], ...c };
      return next;
    });
  }

  // ── overlay helpers (place-anywhere) ──────────────────────────────────────
  function placeAt(e: React.PointerEvent) {
    if (tool === 'select') { setSelKey(null); setSelId(null); return; }
    if (!disp) return;
    const r = (stageRef.current as HTMLElement).getBoundingClientRect();
    const xFrac = Math.min(0.98, Math.max(0, (e.clientX - r.left) / r.width));
    const yFrac = Math.min(0.98, Math.max(0, (e.clientY - r.top) / r.height));
    if (tool === 'signature' && !sigName) return; // need a signature first
    const kind = tool as FillKind;
    const text = kind === 'date' ? todayStr() : kind === 'signature' ? sigName : kind === 'text' ? 'Text' : '';
    const el: FillEl = { id: uid(), page: pageIdx, kind, text, xFrac, yFrac, fontFrac: kind === 'signature' ? 0.03 : 0.02, color: kind === 'signature' ? '#1e3a8a' : '#111827' };
    setEls((p) => [...p, el]); setSelKey(null); setSelId(el.id); setTool('select');
  }

  function onElDown(e: React.PointerEvent, el: FillEl) {
    e.stopPropagation();
    if (tool !== 'select') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelKey(null); setSelId(el.id);
    drag.current = { id: el.id, sx: e.clientX, sy: e.clientY, ox: el.xFrac, oy: el.yFrac };
  }
  function onElMove(e: React.PointerEvent) {
    if (!drag.current || !disp) return;
    const dx = (e.clientX - drag.current.sx) / disp.w;
    const dy = (e.clientY - drag.current.sy) / disp.h;
    setEls((p) => p.map((el) => el.id === drag.current!.id ? { ...el, xFrac: Math.min(0.99, Math.max(0, drag.current!.ox + dx)), yFrac: Math.min(0.99, Math.max(0, drag.current!.oy + dy)) } : el));
  }
  function onElUp() { drag.current = null; }

  const patch = (id: string, p: Partial<FillEl>) => setEls((els) => els.map((e) => e.id === id ? { ...e, ...p } : e));
  const del = (id: string) => { setEls((els) => els.filter((e) => e.id !== id)); setSelId(null); };

  async function exportPdf() {
    if (!file) return;
    setBusy(true); setError(null); setSelId(null); setSelKey(null);
    try {
      const native = hasNative ? { values: nativeValues, custom: nativeCustom, fields: nativeFields, flatten } : undefined;
      const blob = await exportFilledPdf(file, els, native);
      const name = `${file.name.replace(/\.pdf$/i, '')}-filled.pdf`;
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export the PDF.');
    } finally { setBusy(false); }
  }

  function reset() {
    handle?.destroy?.(); setHandle(null); setFile(null); setPageImg(null);
    setEls([]); setSelId(null); setNativeFields([]); setNativeValues({}); setNativeCustom({}); setSelKey(null);
    setDone(null); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const pageEls = els.filter((e) => e.page === pageIdx);
  const pageFields = nativeFields.filter((f) => f.page === pageIdx);
  const canExport = els.length > 0 || filledCount > 0 || (hasNative && flatten);

  // pixel box for a native field on the displayed page
  const boxOf = (f: NativeField) => disp ? { left: f.rect.x * disp.w, top: f.rect.y * disp.h, width: f.rect.w * disp.w, height: f.rect.h * disp.h } : { left: 0, top: 0, width: 0, height: 0 };

  return (
    <div className="mx-auto max-w-4xl">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />

      {!file ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center rounded-xl border-2 border-dashed bg-card px-6 py-12 text-center transition hover:border-primary/50 hover:bg-muted/30">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Upload className="size-6 text-muted-foreground" /></span>
          <span className="mt-4 text-sm font-medium">Drop a PDF form here, or click to choose</span>
          <span className="mt-1 text-xs text-muted-foreground">Real form fields or a flat scan · filled on your device — never uploaded</span>
        </button>
      ) : done ? (
        <div className="rounded-xl border bg-card p-4 shadow-soft">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ Filled PDF ready</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasNative && !flatten
              ? `${filledCount} field${filledCount === 1 ? '' : 's'} filled · stays editable — the recipient can still change it.`
              : `${filledCount + els.length} item${filledCount + els.length === 1 ? '' : 's'} added · flattened so it can’t be changed.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download filled PDF</Button>
            <Button variant="outline" onClick={() => setDone(null)}>Back to editing</Button>
            <Button variant="ghost" onClick={reset}><Upload className="size-4" /> New PDF</Button>
          </div>
        </div>
      ) : (
        <>
          {hasNative ? (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs text-foreground">
              <ClipboardCheck className="size-4 shrink-0 text-primary" />
              This PDF has <b>{nativeFields.length} fillable field{nativeFields.length === 1 ? '' : 's'}</b>
              {nativeFields.some((f) => f.required) && <> (<b className="text-amber-600 dark:text-amber-400">{nativeFields.filter((f) => f.required).length} required</b>)</>}.
              Click a field to type, or press <kbd className="rounded border bg-card px-1 font-mono text-[10px]">Tab</kbd> to move between them.
            </p>
          ) : (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-foreground">
              <Info className="size-4 shrink-0 text-amber-500" /> This is a <b>flat form</b> (no embedded fields) — fill it by placing your own text. <b>Pick&nbsp;Text</b> above, click a blank line, then just type.
            </p>
          )}

          {/* place-anywhere toolbar (works on any PDF, over fields or blank space) */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-1.5">
            <span className="pl-1 pr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add</span>
            {TOOLS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTool(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${tool === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card'}`}>
                <t.icon className="size-3.5" /> {t.label}
              </button>
            ))}
            <span className="flex-1" />
            <button type="button" onClick={() => { setEls((p) => p.slice(0, -1)); setSelId(null); }} disabled={!els.length}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card disabled:opacity-40"><Undo2 className="size-3.5" /> Undo</button>
          </div>

          {tool === 'signature' && !sigName && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border bg-card p-2.5">
              <PenLine className="size-4 shrink-0 text-primary" />
              <input value={sigDraft} onChange={(e) => setSigDraft(e.target.value)} placeholder="Type your signature…" className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm" style={{ fontFamily: fontFamilyFor('signature'), fontSize: 18 }} />
              <Button size="sm" onClick={() => sigDraft.trim() && setSigName(sigDraft.trim())}>Use it</Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
            {/* page stage */}
            <div className="overflow-auto">
              {disp && pageImg ? (
                <div ref={stageRef} className="relative mx-auto shadow-md" style={{ width: disp.w, height: disp.h, cursor: tool === 'select' ? 'default' : 'crosshair' }} onPointerDown={placeAt}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pageImg.url} alt={`Page ${pageIdx + 1}`} width={disp.w} height={disp.h} draggable={false} className="rounded-sm border" />

                  {/* native field hotspots */}
                  {pageFields.map((f) => {
                    const b = boxOf(f);
                    const on = selKey === f.key;
                    const c = cust(f.name);
                    const ring = on ? 'ring-2 ring-primary' : showFields ? (f.required ? 'ring-1 ring-amber-500/60' : 'ring-1 ring-primary/40') : 'ring-0';
                    const bg = showFields || on ? (on ? 'bg-card' : 'bg-primary/[0.07]') : 'bg-transparent';
                    const common = `absolute rounded-[3px] ${ring} ${bg}`;
                    const fontPx = Math.max(8, Math.min(b.height * 0.62, 20));
                    if (f.type === 'checkbox') {
                      return (
                        <button key={f.key} type="button" data-fkey={f.key} onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setSelId(null); setSelKey(f.key); setV(f.name, !cv(f.name)); }}
                          className={`${common} grid place-items-center font-bold text-primary`} style={{ left: b.left, top: b.top, width: b.width, height: b.height, fontSize: fontPx }}>
                          {cv(f.name) ? '✓' : ''}
                        </button>
                      );
                    }
                    if (f.type === 'dropdown') {
                      return (
                        <select key={f.key} data-fkey={f.key} value={tv(f.name)} onPointerDown={(e) => e.stopPropagation()}
                          onFocus={() => { setSelId(null); setSelKey(f.key); }} onKeyDown={(e) => onFieldKey(e, f)}
                          onChange={(e) => setV(f.name, e.target.value)}
                          className={`${common} appearance-none px-1 text-primary outline-none`} style={{ left: b.left, top: b.top, width: b.width, height: b.height, fontSize: fontPx }}>
                          <option value="">Select…</option>
                          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      );
                    }
                    if (f.type === 'radio' || f.type === 'optionlist') {
                      const label = f.type === 'radio' ? (tv(f.name) || 'Choose…') : (Array.isArray(nativeValues[f.name]) ? (nativeValues[f.name] as string[]).join(', ') || 'Choose…' : 'Choose…');
                      return (
                        <button key={f.key} type="button" data-fkey={f.key} onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setSelId(null); setSelKey(f.key); }}
                          className={`${common} flex items-center gap-1 truncate px-1 text-left text-primary`} style={{ left: b.left, top: b.top, width: b.width, height: b.height, fontSize: fontPx }}>
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    }
                    // text / date
                    return (
                      <input key={f.key} data-fkey={f.key} value={tv(f.name)} maxLength={f.maxLen || undefined}
                        onPointerDown={(e) => e.stopPropagation()} onFocus={() => { setSelId(null); setSelKey(f.key); }}
                        onKeyDown={(e) => onFieldKey(e, f)} onChange={(e) => setV(f.name, e.target.value)}
                        className={`${common} bg-clip-padding px-1 outline-none placeholder:text-muted-foreground/50`}
                        style={{ left: b.left, top: b.top, width: b.width, height: b.height, fontSize: c.size && c.size !== 'auto' ? c.size : fontPx, color: c.color || '#111827', textAlign: c.align || 'left', fontFamily: c.font === 'Times' ? 'Georgia, serif' : c.font === 'Courier' ? 'monospace' : 'Arial, sans-serif' }} />
                    );
                  })}

                  {/* place-anywhere overlays */}
                  {pageEls.map((el) => (
                    <div key={el.id} onPointerDown={(e) => onElDown(e, el)} onPointerMove={onElMove} onPointerUp={onElUp}
                      className={`absolute whitespace-pre leading-none ${selId === el.id ? 'outline outline-2 outline-primary/70' : ''}`}
                      style={{ left: `${el.xFrac * 100}%`, top: `${el.yFrac * 100}%`, fontFamily: fontFamilyFor(el.kind), fontWeight: el.kind === 'check' || el.kind === 'x' ? 700 : 400, fontSize: el.fontFrac * disp.h, color: el.color, cursor: tool === 'select' ? 'move' : 'inherit', padding: '1px 2px' }}>
                      {glyphFor(el.kind, el.text) || ' '}
                    </div>
                  ))}
                </div>
              ) : <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}

              {numPages > 1 && (
                <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <button onClick={() => gotoPage(pageIdx - 1)} disabled={pageIdx === 0} className="rounded-md border p-1 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                  Page {pageIdx + 1} / {numPages}
                  <button onClick={() => gotoPage(pageIdx + 1)} disabled={pageIdx === numPages - 1} className="rounded-md border p-1 disabled:opacity-40"><ChevronRight className="size-4" /></button>
                </div>
              )}
            </div>

            {/* side controls */}
            <div className="flex flex-col gap-3">
              {/* native: field navigator + list */}
              {hasNative && (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Field </span>
                      <b className="tabular-nums">{selField ? selField.order + 1 : '–'}</b>
                      <span className="text-muted-foreground"> / {nativeFields.length}</span>
                      {selField && <span className="block truncate font-mono text-[10px] text-primary">{selField.name}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => gotoField((selField ? selField.order : 0) - 1)} className="grid size-6 place-items-center rounded border bg-card hover:border-primary hover:text-primary" title="Previous (Shift+Tab)"><ChevronLeft className="size-3.5" /></button>
                      <button onClick={() => gotoField((selField ? selField.order : -1) + 1)} className="grid size-6 place-items-center rounded border bg-card hover:border-primary hover:text-primary" title="Next (Tab)"><ChevronRight className="size-3.5" /></button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-auto rounded-lg border">
                    {nativeFields.map((f) => (
                      <button key={f.key} onClick={() => gotoField(f.order)}
                        className={`flex w-full items-center gap-2 border-b px-2.5 py-1.5 text-left text-[11px] last:border-b-0 ${selKey === f.key ? 'bg-primary/[0.08]' : 'hover:bg-muted/50'}`}>
                        <span className={`size-2 shrink-0 rounded-full border ${isFilled(f) ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40'}`} />
                        <span className="flex-1 truncate font-mono text-[10px]">{f.name}</span>
                        {f.required && <span className="font-bold text-amber-500" title="required">*</span>}
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{f.type}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* customize: native field selected */}
              {selField ? (
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customize <span className="rounded-full border border-primary/30 bg-primary/[0.08] px-1.5 py-0.5 text-[10px] normal-case text-primary">{selField.type}</span>
                  </p>

                  {selField.type === 'text' && (
                    <>
                      <label className="text-[11px] text-muted-foreground">Value</label>
                      {selField.multiline ? (
                        <textarea value={tv(selField.name)} maxLength={selField.maxLen || undefined} onChange={(e) => setV(selField.name, e.target.value)} rows={2}
                          className="mb-2 mt-1 w-full resize-none rounded-md border border-primary/50 bg-background px-2.5 py-1.5 text-sm ring-1 ring-primary/20" />
                      ) : (
                        <input value={tv(selField.name)} maxLength={selField.maxLen || undefined} onChange={(e) => setV(selField.name, e.target.value)} placeholder="Type here…"
                          className="mb-2 mt-1 w-full rounded-md border border-primary/50 bg-background px-2.5 py-1.5 text-sm ring-1 ring-primary/20" />
                      )}
                      {selField.maxLen ? <p className="-mt-1 mb-2 text-right text-[10px] text-muted-foreground">{tv(selField.name).length}/{selField.maxLen}</p> : null}

                      <label className="text-[11px] text-muted-foreground">Font</label>
                      <div className="mb-2 mt-1 flex gap-1">
                        {FONTS.map((ft) => (
                          <button key={ft.id} onClick={() => setCust(selField.name, { font: ft.id })}
                            className={`flex-1 rounded-md border px-1 py-1 text-[11px] ${(cust(selField.name).font || 'Helvetica') === ft.id ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}>{ft.label}</button>
                        ))}
                      </div>

                      <label className="flex items-center justify-between text-[11px] text-muted-foreground">Size
                        <button onClick={() => setCust(selField.name, { size: cust(selField.name).size === 'auto' || cust(selField.name).size == null ? 12 : 'auto' })}
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cust(selField.name).size == null || cust(selField.name).size === 'auto' ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Auto-fit</button>
                      </label>
                      <input type="range" min={6} max={24} step={1} disabled={cust(selField.name).size == null || cust(selField.name).size === 'auto'}
                        value={cust(selField.name).size && cust(selField.name).size !== 'auto' ? (cust(selField.name).size as number) : 12}
                        onChange={(e) => setCust(selField.name, { size: parseInt(e.target.value) })} className="mb-2 mt-1 w-full disabled:opacity-40" />

                      <label className="text-[11px] text-muted-foreground">Colour</label>
                      <div className="mb-2 mt-1 flex items-center gap-2">
                        {SWATCHES.map((col) => (
                          <button key={col} onClick={() => setCust(selField.name, { color: col })} className={`size-5 rounded-full border ${(cust(selField.name).color || '#111827') === col ? 'ring-2 ring-primary ring-offset-1' : ''}`} style={{ background: col }} />
                        ))}
                        <label className="grid size-5 cursor-pointer place-items-center rounded-full border text-[9px]" style={{ background: 'conic-gradient(from 0deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' }}>
                          <input type="color" className="sr-only" value={cust(selField.name).color || '#111827'} onChange={(e) => setCust(selField.name, { color: e.target.value })} />
                        </label>
                      </div>

                      <label className="text-[11px] text-muted-foreground">Align</label>
                      <div className="mb-2 mt-1 flex overflow-hidden rounded-md border">
                        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                          <button key={a} onClick={() => setCust(selField.name, { align: a })}
                            className={`grid flex-1 place-items-center border-r py-1.5 last:border-r-0 ${(cust(selField.name).align || 'left') === a ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><Icon className="size-3.5" /></button>
                        ))}
                      </div>

                      <div className="mt-1 flex gap-1.5">
                        <button onClick={() => setV(selField.name, '')} className="flex flex-1 items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] text-muted-foreground hover:text-foreground"><Eraser className="size-3" /> Clear</button>
                        <button onClick={() => { setV(selField.name, ''); setNativeCustom((p) => { const n = { ...p }; delete n[selField.name]; return n; }); }} className="flex flex-1 items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" /> Reset</button>
                      </div>
                      <button onClick={applyToAllText} className="mt-1.5 w-full rounded-md border border-dashed border-primary/40 bg-primary/[0.06] py-1.5 text-[11px] font-medium text-primary">Apply font · size · colour to all fields</button>
                    </>
                  )}

                  {selField.type === 'checkbox' && (
                    <button onClick={() => setV(selField.name, !cv(selField.name))}
                      className="flex w-full items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-sm font-medium">
                      <span className={`grid size-4 place-items-center rounded border ${cv(selField.name) ? 'border-primary bg-primary text-primary-foreground' : ''}`}>{cv(selField.name) && <Check className="size-3" />}</span>
                      {cv(selField.name) ? 'Checked' : 'Unchecked'}
                    </button>
                  )}

                  {selField.type === 'radio' && (
                    <div className="flex flex-col gap-1">
                      {(selField.options || []).map((o) => (
                        <button key={o} onClick={() => setV(selField.name, o)}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${tv(selField.name) === o ? 'border-primary bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}>
                          <span className={`grid size-3.5 place-items-center rounded-full border ${tv(selField.name) === o ? 'border-primary' : ''}`}>{tv(selField.name) === o && <span className="size-1.5 rounded-full bg-primary" />}</span>{o}
                        </button>
                      ))}
                    </div>
                  )}

                  {selField.type === 'dropdown' && (
                    <select value={tv(selField.name)} onChange={(e) => setV(selField.name, e.target.value)} className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm">
                      <option value="">Select…</option>
                      {(selField.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}

                  {selField.type === 'optionlist' && (
                    <div className="flex flex-col gap-1">
                      {(selField.options || []).map((o) => {
                        const arr = Array.isArray(nativeValues[selField.name]) ? nativeValues[selField.name] as string[] : [];
                        const on = arr.includes(o);
                        return (
                          <button key={o} onClick={() => setV(selField.name, on ? arr.filter((x) => x !== o) : [...arr, o])}
                            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${on ? 'border-primary bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}>
                            <span className={`grid size-3.5 place-items-center rounded border ${on ? 'border-primary bg-primary text-primary-foreground' : ''}`}>{on && <Check className="size-2.5" />}</span>{o}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : sel ? (
                /* customize: overlay element selected */
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Placed {sel.kind}</p>
                  {(sel.kind === 'text' || sel.kind === 'date' || sel.kind === 'signature') && (
                    <input ref={editRef} value={sel.text} onChange={(e) => patch(sel.id, { text: e.target.value })} onFocus={(e) => e.currentTarget.select()} placeholder="Type here…"
                      className="mb-2 w-full rounded-md border border-primary/50 bg-background px-2.5 py-1.5 text-sm ring-1 ring-primary/20" style={{ fontFamily: fontFamilyFor(sel.kind) }} />
                  )}
                  <label className="text-[11px] text-muted-foreground">Size</label>
                  <input type="range" min={0.01} max={0.06} step={0.002} value={sel.fontFrac} onChange={(e) => patch(sel.id, { fontFrac: parseFloat(e.target.value) })} className="mb-2 w-full" />
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Colour</label>
                    {SWATCHES.slice(0, 3).map((c) => (
                      <button key={c} onClick={() => patch(sel.id, { color: c })} className={`size-5 rounded-full border ${sel.color === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} style={{ background: c }} />
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => del(sel.id)}><Trash2 className="size-3.5" /> Delete</Button>
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {hasNative ? 'Click a field on the page (or in the list) to fill and customize it. Use the toolbar to add text anywhere there’s no field.' : 'Pick a tool, then click the page to place it. Select an item to edit, resize, recolour or delete.'}
                  <p className="mt-2 font-medium text-foreground">{filledCount + els.length} item{filledCount + els.length === 1 ? '' : 's'} added</p>
                </div>
              )}

              {/* toggles + export mode */}
              {hasNative && (
                <div className="rounded-xl border bg-card p-3">
                  <button onClick={() => setShowFields((v) => !v)} className="flex w-full items-center justify-between py-1 text-xs">
                    <span className="flex items-center gap-1.5"><ListChecks className="size-3.5 text-muted-foreground" /> Highlight all fields</span>
                    <span className={`relative h-4 w-7 rounded-full transition ${showFields ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${showFields ? 'left-3.5' : 'left-0.5'}`} /></span>
                  </button>
                  <button onClick={() => setEnterAdvance((v) => !v)} className="flex w-full items-center justify-between py-1 text-xs">
                    <span className="flex items-center gap-1.5"><ChevronDown className="size-3.5 text-muted-foreground" /> Enter jumps to next field</span>
                    <span className={`relative h-4 w-7 rounded-full transition ${enterAdvance ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${enterAdvance ? 'left-3.5' : 'left-0.5'}`} /></span>
                  </button>

                  <p className="mb-1.5 mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">When you download</p>
                  <button onClick={() => setFlatten(false)} className={`mb-1.5 flex w-full items-start gap-2 rounded-lg border p-2 text-left ${!flatten ? 'border-emerald-500/50 bg-emerald-500/[0.07]' : 'hover:bg-muted/40'}`}>
                    <PenTool className={`mt-0.5 size-3.5 shrink-0 ${!flatten ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                    <span><span className="block text-xs font-semibold">Keep it fillable</span><span className="block text-[10px] text-muted-foreground">Recipient can still change or sign it.</span></span>
                  </button>
                  <button onClick={() => setFlatten(true)} className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left ${flatten ? 'border-slate-400/60 bg-slate-500/[0.08]' : 'hover:bg-muted/40'}`}>
                    <Lock className={`mt-0.5 size-3.5 shrink-0 ${flatten ? 'text-slate-600 dark:text-slate-300' : 'text-muted-foreground'}`} />
                    <span><span className="block text-xs font-semibold">Flatten &amp; lock</span><span className="block text-[10px] text-muted-foreground">Answers baked in — no one can edit them.</span></span>
                  </button>
                </div>
              )}

              {file && <BigFileHint bytes={file.size} weight="light" />}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button className="w-full" size="lg" onClick={exportPdf} disabled={busy || !canExport}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> Building…</> : <><Download className="size-4" /> {hasNative && !flatten ? 'Download fillable PDF' : 'Download filled PDF'}</>}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={reset}><X className="size-3.5" /> New PDF</Button>
            </div>
          </div>
        </>
      )}

      <KeepGoing />
    </div>
  );
}
