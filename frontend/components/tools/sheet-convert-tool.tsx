'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, Loader2, AlertTriangle, X, ShieldCheck, Trash2, Code2, Copy, Check } from 'lucide-react';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { csvToSheets, jsonToSheets, readXlsx, rowsToJson, sheetName, xmlToSheets, type Sheet } from '@/lib/sheet-io';
import { buildXlsx, toCsv, type Cell } from '@/lib/xlsx';

export type SheetInput = 'xlsx' | 'csv' | 'json' | 'xml';
export type SheetOutput = 'xlsx' | 'csv' | 'json';

const ACCEPT: Record<SheetInput, string> = {
  xlsx: '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: '.csv,.tsv,.txt,text/csv',
  json: '.json,application/json,text/plain',
  xml: '.xml,text/xml,application/xml',
};

const LABEL: Record<SheetOutput, string> = { xlsx: 'Excel .xlsx', csv: '.csv', json: '.json' };

export function SheetConvertTool({
  from, to, dropTitle, dropHint, pasteHint,
}: {
  from: SheetInput;
  to: SheetOutput[];
  dropTitle: string;
  dropHint: string;
  pasteHint?: string;
}) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [origin, setOrigin] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [header, setHeader] = useState(true);
  const [fmt, setFmt] = useState<SheetOutput>(to[0]);
  const [layout, setLayout] = useState<'sheet' | 'combine'>('sheet');
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const textual = from !== 'xlsx';

  function parseText(text: string, name: string) {
    const found = from === 'csv' ? csvToSheets(text, 'Sheet 1') : from === 'json' ? jsonToSheets(text) : xmlToSheets(text);
    if (!found.length) throw new Error(
      from === 'json'
        ? 'No list of records in that JSON. This converts an array of objects — a single value has nothing to lay out in rows.'
        : from === 'xml'
          ? 'No repeating element in that XML, so there are no rows to build.'
          : 'That file has no rows in it.',
    );
    setSheets(found);
    setOrigin(name);
    setActive(0);
    setError(null);
  }

  async function pickFile(f?: File) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      if (from === 'xlsx') {
        const found = await readXlsx(f);
        if (!found.length) throw new Error('No sheets with data in that workbook.');
        setSheets(found); setOrigin(f.name); setActive(0);
      } else {
        parseText(await f.text(), f.name);
      }
    } catch (e) {
      setSheets(null);
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  function runPaste() {
    try {
      parseText(paste, from === 'json' ? 'pasted.json' : from === 'xml' ? 'pasted.xml' : 'pasted.csv');
    } catch (e) {
      setSheets(null);
      setError(e instanceof Error ? e.message : 'Could not read that.');
    }
  }

  const t = sheets?.[active];

  function editCell(r: number, c: number, value: string) {
    setSheets((prev) => {
      if (!prev) return prev;
      const next = prev.map((s, i) => (i === active ? { ...s, rows: s.rows.map((row) => [...row]) } : s));
      next[active].rows[r][c] = value;
      return next;
    });
  }
  function deleteRow(r: number) {
    setSheets((prev) => (prev ? prev.map((s, i) => (i === active ? { ...s, rows: s.rows.filter((_, x) => x !== r) } : s)) : prev));
  }

  const stats = useMemo(
    () => (sheets ? { sheets: sheets.length, rows: sheets.reduce((n, s) => n + s.rows.length, 0) } : null),
    [sheets],
  );

  const jsonText = useMemo(() => (fmt === 'json' && t ? rowsToJson(t.rows, header) : ''), [fmt, t, header]);

  function combined(all: Sheet[]): Sheet {
    const cols = all.reduce((n, s) => Math.max(n, ...s.rows.map((r) => r.length)), 0);
    const rows: Cell[][] = [];
    all.forEach((s, i) => {
      if (i) rows.push(new Array(cols).fill(''));
      rows.push([s.name, ...new Array(Math.max(0, cols - 1)).fill('')]);
      s.rows.forEach((r) => rows.push([...r, ...new Array(Math.max(0, cols - r.length)).fill('')]));
    });
    return { name: 'All sheets', rows };
  }

  async function doExport() {
    if (!sheets?.length) return;
    setExporting(true);
    try {
      const stem = (origin || 'data').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 40) || 'data';
      if (fmt === 'json') {
        downloadBlob(new Blob([rowsToJson((t ?? sheets[0]).rows, header)], { type: 'application/json' }), `${stem}.json`);
      } else if (fmt === 'csv') {
        const rows = layout === 'combine' || sheets.length === 1
          ? (layout === 'combine' ? combined(sheets).rows : sheets[0].rows)
          : sheets.flatMap((s, i) => (i ? [[], ...s.rows] : s.rows));
        downloadBlob(new Blob([toCsv(rows as Cell[][])], { type: 'text/csv;charset=utf-8' }), `${stem}.csv`);
      } else {
        const chosen = layout === 'combine' ? [combined(sheets)] : sheets;
        const taken = new Set<string>();
        downloadBlob(await buildXlsx(chosen.map((s) => ({ name: sheetName(s.name, taken), rows: s.rows }))), `${stem}.xlsx`);
      }
    } catch {
      setError('Could not build that file. Try exporting one sheet at a time.');
    } finally {
      setExporting(false);
    }
  }

  async function copyJson() {
    try { await navigator.clipboard.writeText(jsonText); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  function reset() { setSheets(null); setError(null); setPaste(''); }

  if (!sheets) {
    return (
      <div>
        {textual && (
          <div className="mb-3 inline-flex rounded-xl border p-0.5 text-xs">
            {([['file', 'Drop a file', Upload], ['paste', `Paste ${from.toUpperCase()}`, Code2]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setTab(id); setError(null); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        )}

        {(!textual || tab === 'file') && (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pickFile(e.dataTransfer.files?.[0]); }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            </span>
            <span className="mt-4 text-base font-semibold">{dropTitle}</span>
            <span className="mt-1 text-sm text-muted-foreground">{dropHint}</span>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose file</span>
          </button>
        )}

        {textual && tab === 'paste' && (
          <div className="rounded-2xl border bg-card p-4">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={pasteHint || `Paste your ${from.toUpperCase()} here`}
              className="h-44 w-full resize-y rounded-xl border bg-background p-3 font-mono text-xs outline-none focus:border-primary" />
            <div className="mt-3 flex justify-end">
              <button onClick={runPaste} disabled={!paste.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
                <FileSpreadsheet className="size-4" /> Convert
              </button>
            </div>
          </div>
        )}

        <input ref={inputRef} type="file" accept={ACCEPT[from]} className="dd-file-input" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}
        <PrivacyNote />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <FileSpreadsheet className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={origin}>{origin}</span>
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {stats?.sheets} sheet{stats?.sheets === 1 ? '' : 's'} · {stats?.rows} rows
          </span>
          <button onClick={reset} aria-label="Start over" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {sheets.length > 1 && (
          <div className="flex flex-wrap gap-1.5 border-b bg-muted/20 px-4 py-2.5">
            {sheets.map((s, i) => (
              <button key={i} onClick={() => setActive(i)} title={s.name}
                className={`max-w-[240px] truncate rounded-lg border px-2.5 py-1 text-xs font-medium transition ${i === active ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-sm">
          <b className="truncate">{t?.name}</b>
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {t?.rows.length} rows × {Math.max(0, ...(t?.rows.map((r) => r.length) ?? [0]))} cols
          </span>
        </div>

        {fmt === 'json' ? (
          <pre className="max-h-[380px] overflow-auto bg-muted/20 p-4 font-mono text-[12px] leading-relaxed">{jsonText}</pre>
        ) : (
          <div className="max-h-[380px] overflow-auto">
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
        )}

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          {to.length > 1 && (
            <div className="inline-flex overflow-hidden rounded-lg border">
              {to.map((f) => (
                <button key={f} onClick={() => setFmt(f)}
                  className={`px-3 py-1.5 text-xs font-semibold ${fmt === f ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>
                  {LABEL[f]}
                </button>
              ))}
            </div>
          )}
          {sheets.length > 1 && fmt !== 'json' && (
            <select value={layout} onChange={(e) => setLayout(e.target.value as 'sheet' | 'combine')} className="rounded-lg border bg-card px-2.5 py-1.5 text-xs">
              <option value="sheet">{fmt === 'csv' ? 'All sheets, one after another' : 'Keep every sheet'}</option>
              <option value="combine">Combine into one</option>
            </select>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="size-4 accent-emerald-600" />
            First row is a header
          </label>
          <div className="ml-auto flex items-center gap-2">
            {fmt === 'json' && (
              <button onClick={() => void copyJson()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
              </button>
            )}
            <button onClick={() => void doExport()} disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download {LABEL[fmt]}
            </button>
          </div>
        </div>

        {error && <p className="border-t px-4 py-2.5 text-xs text-destructive">{error}</p>}
      </div>

      <PrivacyNote />
      <KeepGoing title="Do more, privately" />
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Converted on your device.</b> Your file is read and written inside this browser tab — nothing is uploaded, which matters when the spreadsheet is a payroll run or a customer list.</p>
    </div>
  );
}
