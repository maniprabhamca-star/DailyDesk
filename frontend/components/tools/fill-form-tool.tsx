'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, Type, Check, Calendar, PenLine, Undo2, Trash2, ChevronLeft, ChevronRight, MousePointer2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob as download } from '@/lib/download';
import { BigFileHint } from '@/components/app/big-file-hint';
import { KeepGoing } from '@/components/app/keep-going';
import { openPdf, renderPage, type PdfHandle } from '@/lib/pdf-render';
import { detectFieldCount, exportFilledPdf, fontFamilyFor, glyphFor, type FillEl, type FillKind } from '@/lib/fill-pdf';

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

export function FillFormTool() {
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [pageImg, setPageImg] = useState<{ url: string; w: number; h: number } | null>(null);
  const [fieldCount, setFieldCount] = useState(0);
  const [tool, setTool] = useState<Tool>('text');
  const [els, setEls] = useState<FillEl[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [sigName, setSigName] = useState('');
  const [sigDraft, setSigDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blob: Blob; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  const disp = pageImg ? (() => { const s = Math.min(MAX_W / pageImg.w, MAX_H / pageImg.h); return { w: pageImg.w * s, h: pageImg.h * s }; })() : null;
  const sel = els.find((e) => e.id === selId) || null;

  useEffect(() => () => { handle?.destroy?.(); }, [handle]);

  async function loadFile(f?: File) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setError(null); setDone(null); setEls([]); setSelId(null); setPageIdx(0);
    try {
      const h = await openPdf(f);
      setHandle(h); setNumPages(h.numPages); setFile(f);
      const img = await renderPage(h, 0, 1600);
      setPageImg({ url: img.url, w: img.w, h: img.h });
      setFieldCount(await detectFieldCount(f));
    } catch {
      setError('Could not open that PDF.');
    }
  }

  const gotoPage = useCallback(async (i: number) => {
    if (!handle || i < 0 || i >= numPages) return;
    setPageIdx(i); setSelId(null);
    try { const img = await renderPage(handle, i, 1600); setPageImg({ url: img.url, w: img.w, h: img.h }); } catch { /* ignore stale */ }
  }, [handle, numPages]);

  function placeAt(e: React.PointerEvent) {
    if (tool === 'select' || !disp) return;
    const r = (stageRef.current as HTMLElement).getBoundingClientRect();
    const xFrac = Math.min(0.98, Math.max(0, (e.clientX - r.left) / r.width));
    const yFrac = Math.min(0.98, Math.max(0, (e.clientY - r.top) / r.height));
    if (tool === 'signature' && !sigName) return; // need a signature first
    const kind = tool as FillKind;
    const text = kind === 'date' ? todayStr() : kind === 'signature' ? sigName : kind === 'text' ? 'Text' : '';
    const el: FillEl = { id: uid(), page: pageIdx, kind, text, xFrac, yFrac, fontFrac: kind === 'signature' ? 0.03 : 0.02, color: kind === 'signature' ? '#1e3a8a' : '#111827' };
    setEls((p) => [...p, el]); setSelId(el.id); setTool('select');
  }

  function onElDown(e: React.PointerEvent, el: FillEl) {
    e.stopPropagation();
    if (tool !== 'select') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelId(el.id);
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
    setBusy(true); setError(null); setSelId(null);
    try {
      const blob = await exportFilledPdf(file, els);
      const name = `${file.name.replace(/\.pdf$/i, '')}-filled.pdf`;
      setDone({ blob, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export the PDF.');
    } finally { setBusy(false); }
  }

  function reset() {
    handle?.destroy?.(); setHandle(null); setFile(null); setPageImg(null); setEls([]); setSelId(null); setDone(null); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const pageEls = els.filter((e) => e.page === pageIdx);

  return (
    <div className="mx-auto max-w-3xl">
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
          <p className="mt-1 text-xs text-muted-foreground">{els.length} item{els.length === 1 ? '' : 's'} added · flattened so it can’t be changed.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => download(done.blob, done.name)}><Download className="size-4" /> Download filled PDF</Button>
            <Button variant="outline" onClick={() => setDone(null)}>Back to editing</Button>
            <Button variant="ghost" onClick={reset}><Upload className="size-4" /> New PDF</Button>
          </div>
        </div>
      ) : (
        <>
          {fieldCount > 0 && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs text-foreground">
              <ClipboardCheck className="size-4 shrink-0 text-primary" /> This PDF has <b>{fieldCount} fillable field{fieldCount === 1 ? '' : 's'}</b>. Place text right on them, or use the toolbar anywhere.
            </p>
          )}

          {/* toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-1.5">
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

          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            {/* page stage */}
            <div className="overflow-auto">
              {disp && pageImg ? (
                <div ref={stageRef} className="relative mx-auto shadow-md" style={{ width: disp.w, height: disp.h, cursor: tool === 'select' ? 'default' : 'crosshair' }} onPointerDown={placeAt}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pageImg.url} alt={`Page ${pageIdx + 1}`} width={disp.w} height={disp.h} draggable={false} className="rounded-sm border" />
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
            <div>
              {sel ? (
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected {sel.kind}</p>
                  {(sel.kind === 'text' || sel.kind === 'date' || sel.kind === 'signature') && (
                    <input value={sel.text} onChange={(e) => patch(sel.id, { text: e.target.value })} placeholder="Type…"
                      className="mb-2 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm" style={{ fontFamily: fontFamilyFor(sel.kind) }} />
                  )}
                  <label className="text-[11px] text-muted-foreground">Size</label>
                  <input type="range" min={0.01} max={0.06} step={0.002} value={sel.fontFrac} onChange={(e) => patch(sel.id, { fontFrac: parseFloat(e.target.value) })} className="mb-2 w-full" />
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Color</label>
                    {['#111827', '#1e3a8a', '#b91c1c'].map((c) => (
                      <button key={c} onClick={() => patch(sel.id, { color: c })} className={`size-5 rounded-full border ${sel.color === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} style={{ background: c }} />
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => del(sel.id)}><Trash2 className="size-3.5" /> Delete</Button>
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Pick a tool, then click the page to place it. Select an item to edit, resize, recolour or delete.
                  <p className="mt-2 font-medium text-foreground">{els.length} item{els.length === 1 ? '' : 's'} placed</p>
                </div>
              )}

              {file && <BigFileHint bytes={file.size} weight="light" />}
              {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button className="mt-3 w-full" size="lg" onClick={exportPdf} disabled={busy || !els.length}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> Building…</> : <><Download className="size-4" /> Download filled PDF</>}
              </Button>
              <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={reset}><X className="size-3.5" /> New PDF</Button>
            </div>
          </div>
        </>
      )}

      <KeepGoing />
    </div>
  );
}
