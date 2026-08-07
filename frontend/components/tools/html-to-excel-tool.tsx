'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Download, Loader2, AlertTriangle, X, ShieldCheck, Trash2, Table2, Link2, Code2,
} from 'lucide-react';
import { downloadBlob } from '@/lib/download';
import { KeepGoing } from '@/components/app/keep-going';
import { tablesFromHtml, sheetName, type HtmlTable } from '@/lib/html-tables';
import { buildXlsx, toCsv, type Cell } from '@/lib/xlsx';

type Source = 'file' | 'paste' | 'url';
type Fmt = 'xlsx' | 'csv';
type Layout = 'sheet' | 'combine';

export function HtmlToExcelTool() {
  const [tables, setTables] = useState<HtmlTable[] | null>(null);
  const [origin, setOrigin] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Source>('file');
  const [paste, setPaste] = useState('');
  const [url, setUrl] = useState('');
  const [header, setHeader] = useState(true);
  const [fmt, setFmt] = useState<Fmt>('xlsx');
  const [layout, setLayout] = useState<Layout>('sheet');
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function load(html: string, from: string) {
    const found = tablesFromHtml(html);
    if (!found.length) {
      setTables(null);
      setError(
        'No data tables in that page. Some sites draw their “tables” with styled <div>s, which look like a table but aren’t one — there’s nothing structured to export.',
      );
      return;
    }
    setTables(found);
    setOrigin(from);
    setActive(0);
    setError(null);
  }

  async function pickFile(f?: File) {
    if (!f) return;
    if (!/\.(html?|xhtml)$/i.test(f.name) && !f.type.includes('html')) {
      setError('Please choose an .html file — or paste the page source instead.');
      return;
    }
    setBusy(true);
    try {
      load(await f.text(), f.name);
    } finally {
      setBusy(false);
    }
  }

  async function fetchUrl() {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(/^https?:\/\//i.test(u) ? u : `https://${u}`);
      if (!res.ok) throw new Error(String(res.status));
      load(await res.text(), u);
    } catch {
      setTables(null);
      setError(
        'Your browser wasn’t allowed to read that page directly — most sites block other pages from fetching them, and we don’t proxy it through a server because then your browsing would pass through us. Open the page, save it (Ctrl+S) or copy its source, and drop it here instead.',
      );
    } finally {
      setBusy(false);
    }
  }

  const t = tables?.[active];

  function editCell(r: number, c: number, value: string) {
    setTables((prev) => {
      if (!prev) return prev;
      const next = prev.map((tbl, i) => (i === active ? { ...tbl, rows: tbl.rows.map((row) => [...row]) } : tbl));
      next[active].rows[r][c] = value;
      return next;
    });
  }
  function deleteRow(r: number) {
    setTables((prev) => {
      if (!prev) return prev;
      const next = prev.map((tbl, i) => (i === active ? { ...tbl, rows: tbl.rows.filter((_, x) => x !== r) } : tbl));
      return next;
    });
  }

  const stats = useMemo(() => {
    if (!tables) return null;
    return { tables: tables.length, rows: tables.reduce((n, x) => n + x.rows.length, 0) };
  }, [tables]);

  async function doExport() {
    if (!tables?.length) return;
    setExporting(true);
    try {
      const stem = (origin || 'tables').replace(/^https?:\/\//i, '').replace(/[^\w.-]+/g, '-').replace(/\.html?$/i, '').slice(0, 40) || 'tables';
      const chosen = layout === 'combine' ? [combined(tables)] : tables;
      if (fmt === 'csv') {
        const rows = layout === 'combine' ? chosen[0].rows : tables.flatMap((x, i) => (i ? [[], ...x.rows] : x.rows));
        downloadBlob(new Blob([toCsv(rows as Cell[][])], { type: 'text/csv;charset=utf-8' }), `${stem}.csv`);
      } else {
        const taken = new Set<string>();
        const blob = await buildXlsx(chosen.map((x) => ({ name: sheetName(x.name, taken), rows: x.rows })));
        downloadBlob(blob, `${stem}.xlsx`);
      }
    } catch {
      setError('Could not build the spreadsheet. Try exporting one table at a time.');
    } finally {
      setExporting(false);
    }
  }

  function reset() {
    setTables(null);
    setError(null);
    setPaste('');
    setUrl('');
  }

  if (!tables) {
    return (
      <div>
        <div className="mb-3 inline-flex rounded-xl border p-0.5 text-xs">
          {([['file', 'Drop a file', Upload], ['paste', 'Paste HTML', Code2], ['url', 'From a URL', Link2]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setTab(id); setError(null); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'file' && (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pickFile(e.dataTransfer.files?.[0]); }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            </span>
            <span className="mt-4 text-base font-semibold">Drop a saved web page</span>
            <span className="mt-1 text-sm text-muted-foreground">every table on it becomes a sheet — read on your device, never uploaded</span>
            <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm">Choose .html file</span>
          </button>
        )}

        {tab === 'paste' && (
          <div className="rounded-2xl border bg-card p-4">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste the page source here — right-click the page, View source, select all, copy."
              className="h-44 w-full resize-y rounded-xl border bg-background p-3 font-mono text-xs outline-none focus:border-primary"
            />
            <div className="mt-3 flex justify-end">
              <button onClick={() => load(paste, 'pasted-html')} disabled={!paste.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
                <Table2 className="size-4" /> Find the tables
              </button>
            </div>
          </div>
        )}

        {tab === 'url' && (
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void fetchUrl(); }}
                placeholder="example.com/page-with-a-table"
                className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button onClick={() => void fetchUrl()} disabled={!url.trim() || busy}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Table2 className="size-4" />} Fetch
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your browser fetches the page directly, so nothing passes through us. Many sites refuse that — if this one does,
              save the page and drop the file instead.
            </p>
          </div>
        )}

        <input ref={inputRef} type="file" accept=".html,.htm,.xhtml,text/html" aria-label="Choose an HTML file" className="dd-file-input"
          onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />

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
            {stats?.tables} table{stats?.tables === 1 ? '' : 's'} · {stats?.rows} rows
          </span>
          <button onClick={reset} aria-label="Start over" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {tables.length > 1 && (
          <div className="flex flex-wrap gap-1.5 border-b bg-muted/20 px-4 py-2.5">
            {tables.map((x, i) => (
              <button key={i} onClick={() => setActive(i)} title={`${x.name} — ${x.hint}`}
                className={`max-w-[240px] truncate rounded-lg border px-2.5 py-1 text-xs font-medium transition ${i === active ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                {x.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-sm">
          <b className="truncate">{t?.name}</b>
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {t?.rows.length} rows × {t?.cols} cols
          </span>
          <span className="text-[11px] text-muted-foreground">{t?.hint}</span>
        </div>

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

        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          <div className="inline-flex overflow-hidden rounded-lg border">
            <button onClick={() => setFmt('xlsx')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${fmt === 'xlsx' ? 'bg-emerald-700 text-white' : 'text-muted-foreground'}`}><FileSpreadsheet className="size-3.5" /> Excel .xlsx</button>
            <button onClick={() => setFmt('csv')} className={`px-3 py-1.5 text-xs font-semibold ${fmt === 'csv' ? 'bg-emerald-700 text-white' : 'text-muted-foreground'}`}>.csv</button>
          </div>
          {tables.length > 1 && (
            <select value={layout} onChange={(e) => setLayout(e.target.value as Layout)} className="rounded-lg border bg-card px-2.5 py-1.5 text-xs">
              <option value="sheet">{fmt === 'csv' ? 'All tables, one after another' : 'One sheet per table'}</option>
              <option value="combine">Combine into one</option>
            </select>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="size-4 accent-emerald-600" />
            First row is a header
          </label>
          <button onClick={() => void doExport()} disabled={exporting}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download {fmt === 'xlsx' ? 'spreadsheet' : 'CSV'}
          </button>
        </div>

        {error && <p className="border-t px-4 py-2.5 text-xs text-destructive">{error}</p>}
      </div>

      <PrivacyNote />
      <KeepGoing exclude="/html-to-excel" title="Do more, privately" />
    </div>
  );
}

/** Stack every table into one sheet, with its name as a divider row. */
function combined(tables: HtmlTable[]): HtmlTable {
  const cols = tables.reduce((n, t) => Math.max(n, t.cols), 0);
  const rows: Cell[][] = [];
  tables.forEach((t, i) => {
    if (i) rows.push(new Array(cols).fill(''));
    rows.push([t.name, ...new Array(Math.max(0, cols - 1)).fill('')]);
    t.rows.forEach((r) => rows.push([...r, ...new Array(Math.max(0, cols - r.length)).fill('')]));
  });
  return { name: 'All tables', hint: 'combined', rows, cols };
}

function PrivacyNote() {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p><b>Read on your device.</b> The page is parsed in your browser and the spreadsheet is written there too — nothing is uploaded, stored, or seen by anyone but you.</p>
    </div>
  );
}
