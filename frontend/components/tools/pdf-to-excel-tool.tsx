'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Loader2, Download, FileSpreadsheet, ShieldCheck, AlertTriangle, Trash2, Table2, FileText, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { ShareButton } from '@/components/app/share-button';
import { KeepGoing } from '@/components/app/keep-going';
import { openPdf, renderPage, dprTarget, type PdfHandle } from '@/lib/pdf-render';
import { extractTables, type Table } from '@/lib/pdf-tables';
import { buildXlsx, toCsv, coerce, type Sheet } from '@/lib/xlsx';
import { useFileHandoff } from '@/lib/file-handoff';
import { aiPost, AI_FALLBACK_MSG } from '@/lib/ai-doc';
import { usePlan } from '@/lib/plan';
import { useRouter } from 'next/navigation';

type Fmt = 'xlsx' | 'csv';
type Layout = 'sheet' | 'combine';

export function PdfToExcelTool() {
  const plan = usePlan();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [handle, setHandle] = useState<PdfHandle | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready'>('idle');
  const [readPct, setReadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noTables, setNoTables] = useState(false);
  const [preview, setPreview] = useState<{ url: string; box: { left: number; top: number; width: number; height: number } | null } | null>(null);
  const [fmt, setFmt] = useState<Fmt>('xlsx');
  const [layout, setLayout] = useState<Layout>('sheet');
  const [header, setHeader] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const aiUndo = useRef<Map<number, string[][]>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { handle?.destroy?.(); }, [handle]);

  const renderPreview = useCallback(async (h: PdfHandle, t: Table) => {
    try {
      const img = await renderPage(h, t.page - 1, dprTarget(340, 2, 1100));
      // Percentages of the page, so the box scales with the w-full <img> regardless
      // of the rendered pixel size. Small padding so it hugs the content nicely.
      const pad = 1.2;
      const box = {
        left: Math.max(0, (t.bbox.x0 / t.pageW) * 100 - pad),
        top: Math.max(0, ((t.pageH - t.bbox.y1) / t.pageH) * 100 - pad),
        width: ((t.bbox.x1 - t.bbox.x0) / t.pageW) * 100 + pad * 2,
        height: ((t.bbox.y1 - t.bbox.y0) / t.pageH) * 100 + pad * 2,
      };
      setPreview({ url: img.url, box });
    } catch { setPreview(null); }
  }, []);

  const loadFile = useCallback(async (f?: File) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF.'); return; }
    setError(null); setNoTables(false); setTables([]); setActive(0); setPreview(null);
    setStatus('reading'); setReadPct(0);
    try {
      const h = await openPdf(f);
      setHandle(h); setFile(f);
      const { tables: found, hasText } = await extractTables(f, setReadPct);
      setTables(found);
      setStatus('ready');
      if (!found.length) { setNoTables(true); if (!hasText) setError('scanned'); }
      else void renderPreview(h, found[0]);
    } catch {
      setError('Could not open that PDF. It may be corrupt or password-protected.');
      setStatus('idle');
    }
  }, [renderPreview]);

  useFileHandoff(loadFile);

  useEffect(() => {
    if (handle && tables[active]) void renderPreview(handle, tables[active]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const reset = () => {
    handle?.destroy?.();
    setFile(null); setHandle(null); setTables([]); setActive(0); setStatus('idle');
    setPreview(null); setNoTables(false); setError(null);
  };

  // AI clean-up (Pro): sends the ACTIVE table's text to the AI, which fixes the
  // structure (merged title rows, split numeric columns) without touching values.
  // The one explicit exception to this tool's on-device promise — stated in the UI.
  const aiCleanup = useCallback(async () => {
    const tbl = tables[active];
    if (!tbl || aiBusy) return;
    // Free users get the pricing page, not a dead error (same as Redact's presets).
    if (plan !== 'pro') { router.push('/pricing'); return; }
    setAiBusy(true); setAiMsg(null);
    const r = await aiPost<{ rows: string[][] }>('/api/ai/table-cleanup', { rows: tbl.rows });
    if (r.ok && r.data?.rows?.length) {
      aiUndo.current.set(active, tbl.rows);
      const rows = r.data.rows;
      setTables((ts) => ts.map((t, i) => (i !== active ? t : { ...t, rows, cols: Math.max(...rows.map((x) => x.length)) })));
      setAiMsg({ kind: 'ok', text: 'AI reorganized the grid — values untouched. Review it, then export (or undo).' });
    } else {
      setAiMsg({ kind: 'err', text: r.message || AI_FALLBACK_MSG });
    }
    setAiBusy(false);
  }, [tables, active, aiBusy, plan, router]);

  const aiRevert = useCallback(() => {
    const prev = aiUndo.current.get(active);
    if (!prev) return;
    aiUndo.current.delete(active);
    setTables((ts) => ts.map((t, i) => (i !== active ? t : { ...t, rows: prev, cols: Math.max(...prev.map((x) => x.length)) })));
    setAiMsg(null);
  }, [active]);

  const editCell = (r: number, c: number, val: string) => {
    setTables((ts) => ts.map((t, i) => (i !== active ? t : { ...t, rows: t.rows.map((row, ri) => (ri !== r ? row : row.map((cell, ci) => (ci === c ? val : cell)))) })));
  };
  const deleteRow = (r: number) => {
    setTables((ts) => ts.map((t, i) => (i !== active ? t : { ...t, rows: t.rows.filter((_, ri) => ri !== r) })));
  };

  // Combine all tables into one row set, optionally dropping repeated header rows.
  const combinedRows = useCallback((): string[][] => {
    if (!tables.length) return [];
    const out: string[][] = [...tables[0].rows];
    const firstHeader = header ? JSON.stringify(tables[0].rows[0]) : null;
    for (let i = 1; i < tables.length; i++) {
      const rows = tables[i].rows;
      const start = firstHeader && rows[0] && JSON.stringify(rows[0]) === firstHeader ? 1 : 0;
      out.push(...rows.slice(start));
    }
    return out;
  }, [tables, header]);

  const makeExport = useCallback(async (): Promise<{ blob: Blob; name: string }> => {
    const base = (file?.name || 'tables.pdf').replace(/\.[^.]+$/, '');
    if (fmt === 'csv') {
      const rows = layout === 'combine' || tables.length === 1 ? combinedRows() : tables[active].rows;
      return { blob: new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), name: `${base}.csv` };
    }
    const sheets: Sheet[] = layout === 'combine'
      ? [{ name: 'Tables', rows: combinedRows().map((row) => row.map((c) => coerce(c))) }]
      : tables.map((t) => ({ name: `Page ${t.page}`, rows: t.rows.map((row) => row.map((c) => coerce(c))) }));
    return { blob: await buildXlsx(sheets), name: `${base}.xlsx` };
  }, [file, fmt, layout, active, tables, combinedRows]);

  const doExport = useCallback(async () => {
    if (!tables.length || exporting) return;
    setExporting(true);
    try { const { blob, name } = await makeExport(); downloadBlob(blob, name); }
    finally { setExporting(false); }
  }, [tables, exporting, makeExport]);

  // Pre-build the export so Share can hand it over within the click gesture.
  const shareCache = useRef<{ blob: Blob; name: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (tables.length) void makeExport().then((f) => { if (alive) shareCache.current = f; });
    else shareCache.current = null;
    return () => { alive = false; };
  }, [tables, makeExport]);

  // ---- empty state ---------------------------------------------------------
  if (status === 'idle') {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void loadFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop a PDF with tables</span>
          <span className="mt-1 text-sm text-muted-foreground">bank statements, invoices, reports — converted on your device, never uploaded</span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} />
        {error && error !== 'scanned' && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        <PrivacyNote />
      </div>
    );
  }

  // ---- no tables found -----------------------------------------------------
  if (status === 'ready' && noTables) {
    return (
      <div>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-6" /></span>
          <h3 className="mt-3 text-lg font-bold">No tables in this PDF</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {error === 'scanned'
              ? 'This looks like a scanned PDF with no selectable text. Run it through OCR first, then convert it here.'
              : 'This looks like a form or a letter rather than a spreadsheet — its lines don’t repeat a table layout. Rather than hand you a scrambled grid, we’d point you somewhere better:'}
          </p>
          {error !== 'scanned' && (
            <p className="mx-auto mt-3 max-w-md text-[13px] text-muted-foreground">
              If it’s a <b className="text-foreground">fillable form</b>, use <a href="/fill-pdf-form" className="font-semibold text-primary underline">Fill PDF form</a>. To pull out the words, try <a href="/pdf-to-word" className="font-semibold text-primary underline">PDF to Word</a>.
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {error === 'scanned'
              ? <Button asChild><a href="/ocr-pdf">Run OCR first</a></Button>
              : <Button asChild><a href="/fill-pdf-form">Open Fill PDF form</a></Button>}
            <Button variant="outline" onClick={reset}>Try another PDF</Button>
          </div>
        </div>
        <PrivacyNote />
      </div>
    );
  }

  const t = tables[active];

  // ---- loaded: preview + grid + export ------------------------------------
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {/* file header — which document you're looking at */}
        <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2.5">
          <FileText className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={file?.name}>{file?.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {tables.length} {tables.length === 1 ? 'table' : 'tables'} found
          </span>
        </div>
        {/* tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b bg-muted/30 px-3 pt-2">
          {tables.map((tb, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3.5 py-2 text-xs font-semibold transition ${i === active ? 'border-border bg-card text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Table2 className="size-3.5" /> Page {tb.page} <span className="font-normal text-muted-foreground/70">· {tb.rows.length}×{tb.cols}</span>
            </button>
          ))}
          <button onClick={reset} className="ml-auto mb-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"><X className="size-3.5" /> New file</button>
        </div>

        <div className="grid gap-0 md:grid-cols-[260px_1fr]">
          {/* page preview + highlight */}
          <aside className="border-b bg-muted/20 p-4 md:border-b-0 md:border-r">
            <div className="relative overflow-hidden rounded-lg border bg-white">
              {status === 'reading' ? (
                <div className="flex aspect-[1/1.3] items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
              ) : preview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={`Page ${t?.page}`} className="w-full object-contain" draggable={false} />
                  {preview.box && <BoxOverlay box={preview.box} />}
                </div>
              ) : null}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block size-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-500/10" /> Detected table region on page {t?.page}</p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] leading-snug text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="mt-px size-3.5 shrink-0" />
              <span>Columns aligned from the page layout — check the grid and fix any cell before exporting.</span>
            </div>
          </aside>

          {/* editable grid */}
          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-sm">
              <b>Page {t?.page} · Table</b>
              <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{t?.rows.length} rows × {t?.cols} cols</span>
              <div className="ml-auto flex items-center gap-2">
                {aiUndo.current.has(active) && (
                  <button onClick={aiRevert} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    <Undo2 className="size-3.5" /> Undo
                  </button>
                )}
                <button onClick={() => void aiCleanup()} disabled={aiBusy} title="Fixes split columns and stray title rows. Sends this table's text to the AI — the one exception to on-device."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-600 transition hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-400">
                  {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {aiBusy ? 'Cleaning…' : 'AI clean-up'}
                  <span className="rounded bg-gradient-to-r from-amber-500 to-orange-500 px-1 text-[9px] font-extrabold uppercase text-white">Pro</span>
                </button>
              </div>
            </div>
            {aiMsg && (
              <div className={`border-b px-4 py-2 text-xs ${aiMsg.kind === 'ok' ? 'bg-violet-500/5 text-violet-700 dark:text-violet-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
                {aiMsg.text}
              </div>
            )}
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {t?.rows.map((row, r) => (
                    <tr key={r} className={`group ${header && r === 0 ? 'bg-muted/50 font-semibold' : r % 2 ? 'bg-muted/20' : ''}`}>
                      <td className="w-8 border border-border/60 bg-muted/40 text-center align-middle text-[10px] text-muted-foreground">
                        <span className="group-hover:hidden">{r + 1}</span>
                        <button onClick={() => deleteRow(r)} title="Delete row" className="mx-auto hidden text-destructive group-hover:block"><Trash2 className="size-3" /></button>
                      </td>
                      {row.map((cell, c) => (
                        <td key={c} contentEditable suppressContentEditableWarning
                          onBlur={(e) => editCell(r, c, e.currentTarget.textContent || '')}
                          className="max-w-[280px] truncate whitespace-nowrap border border-border/60 px-2.5 py-1.5 outline-none focus:bg-emerald-500/5 focus:ring-1 focus:ring-emerald-500/40">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* export bar */}
            <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
              <div className="inline-flex overflow-hidden rounded-lg border">
                <button onClick={() => setFmt('xlsx')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${fmt === 'xlsx' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}><FileSpreadsheet className="size-3.5" /> Excel .xlsx</button>
                <button onClick={() => setFmt('csv')} className={`px-3 py-1.5 text-xs font-semibold ${fmt === 'csv' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>.csv</button>
              </div>
              {tables.length > 1 && (
                <select value={layout} onChange={(e) => setLayout(e.target.value as Layout)} className="rounded-lg border bg-card px-2.5 py-1.5 text-xs">
                  <option value="sheet">{fmt === 'csv' ? 'Combine all tables' : 'One sheet per table'}</option>
                  <option value="combine">Combine into one</option>
                </select>
              )}
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="size-4 accent-emerald-600" /> First row is a header</label>
              <div className="ml-auto flex items-center gap-2">
                <ShareButton size="sm" title="Extracted tables" label="Share" get={() => (shareCache.current ? [shareCache.current] : [])} />
                <button onClick={() => void doExport()} disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download {fmt === 'xlsx' ? 'spreadsheet' : 'CSV'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <PrivacyNote />
      <KeepGoing exclude="/pdf-to-excel" title="Do more, privately" />
    </div>
  );
}

// Highlight box over the rendered page image, positioned in % of the page.
function BoxOverlay({ box }: { box: { left: number; top: number; width: number; height: number } }) {
  return (
    <span className="pointer-events-none absolute rounded border-2 border-emerald-500 bg-emerald-500/10"
      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }} />
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p>
        <b>Your data never leaves your computer.</b> Every big competitor uploads your PDF to their servers to convert it —
        the worst place for a bank statement. DiemDesk reads the page layout with the same in-browser engine as our other
        tools, so nothing is uploaded, stored, or seen by anyone but you.
      </p>
    </div>
  );
}
