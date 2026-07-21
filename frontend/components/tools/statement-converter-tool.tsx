'use client';
import { useFileSession } from '@/lib/editor-session';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Loader2, Download, FileText, ShieldCheck, AlertTriangle, Check, X, Landmark, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/download';
import { buildXlsx, toCsv, type Cell } from '@/lib/xlsx';
import { passwordErrorKind } from '@/lib/pdf-render';
import { parseStatement, type StatementResult } from '@/lib/banks/statement';
import { formatMoney, currencySymbol, type Txn, type Currency } from '@/lib/banks/balance';
import { buildTallyXml } from '@/lib/banks/tally';
import { useCurrency, price, STATEMENT_PRICE } from '@/lib/currency';
import { getQuota, consumePages, type Quota } from '@/lib/statement-quota';
import { ShareButton } from '@/components/app/share-button';
import { KeepGoing } from '@/components/app/keep-going';
import { useFileHandoff } from '@/lib/file-handoff';

type Fmt = 'xlsx' | 'csv' | 'tally';

export function StatementConverterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<StatementResult | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready'>('idle');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fmt, setFmt] = useState<Fmt>('xlsx');
  const [exporting, setExporting] = useState(false);
  // Tally ledger mapping — these names must already exist in the user's Tally company.
  const [company, setCompany] = useState('');
  const [bankLedger, setBankLedger] = useState('');
  const [contraLedger, setContraLedger] = useState('Suspense');
  // Bank e-statements are password-protected by default, so this is the common
  // path, not an edge case. The password stays in this tab — pdf.js decrypts on
  // the device and it is never sent anywhere.
  const [locked, setLocked] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [pwWrong, setPwWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  // Billing currency from the visitor's country (NOT the statement's own currency).
  const billing = useCurrency();
  const stmtPrice = STATEMENT_PRICE[billing];
  // Page quota — only a page COUNT is sent to the server, never the statement.
  const [quota, setQuota] = useState<Quota | null>(null);
  const [overQuota, setOverQuota] = useState(false);

  const load = useCallback(async (f?: File, password?: string) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Please choose a PDF statement.'); return; }
    setError(null); setRes(null); setTxns([]); setStatus('reading'); setPct(0);
    try {
      const r = await parseStatement(f, setPct, password);
      setRes(r); setTxns(r.validation.txns); setFile(f); setStatus('ready');
      setLocked(null); setPw(''); setPwWrong(false);
    } catch (e) {
      const kind = passwordErrorKind(e);
      if (kind) {
        // Not an error — just locked. Ask for the password inline.
        setLocked(f); setPwWrong(kind === 'wrong'); setStatus('idle');
        setTimeout(() => pwRef.current?.focus(), 50);
        return;
      }
      setError('Could not open that PDF — it may be damaged.');
      setStatus('idle');
    }
  }, []);

  useFileHandoff(load);
  // Survive a background-tab discard: silently reload the last file.
  useFileSession('statement', file, load);
  useEffect(() => { if (status === 'idle') { setFile(null); setRes(null); } }, [status]);

  const reset = () => { setStatus('idle'); setFile(null); setRes(null); setTxns([]); setError(null); };

  const rows = useCallback((): Cell[][] => {
    const head = ['Date', 'Narration', 'Ref / Chq', 'Debit', 'Credit', 'Balance'];
    return [head, ...txns.map((t) => [
      t.date, t.narration, t.ref,
      t.debit == null ? '' : t.debit / 100,
      t.credit == null ? '' : t.credit / 100,
      // MUST stay blank when the bank didn't print one (US "ending daily balance"
      // statements): exporting 0.00 would invent a balance that isn't in the record.
      t.balance == null ? '' : t.balance / 100,
    ])];
  }, [txns]);

  // Build the export file for the current format — shared by Download and Share so
  // they always produce the identical file, entirely on the device.
  const makeExport = useCallback(async (): Promise<{ blob: Blob; name: string }> => {
    const base = (file?.name || 'statement.pdf').replace(/\.[^.]+$/, '');
    if (fmt === 'tally') {
      const { xml } = buildTallyXml(txns, {
        company: company.trim() || 'My Company',
        bankLedger: bankLedger.trim() || (res?.bank?.name ?? 'Bank Account'),
        contraLedger: contraLedger.trim() || 'Suspense',
      });
      return { blob: new Blob([xml], { type: 'application/xml' }), name: `${base}-tally.xml` };
    }
    if (fmt === 'csv') {
      return { blob: new Blob(['﻿' + toCsv(rows())], { type: 'text/csv;charset=utf-8' }), name: `${base}.csv` };
    }
    const summary: Cell[][] = [
      ['Bank', res?.bank?.name || 'Unknown'],
      ['Currency', res?.currency || 'INR'],
      ['Account', res?.meta.account || '—'],
      ['Period', res?.meta.period || '—'],
      ['Opening balance', res?.validation.opening == null ? '' : res.validation.opening / 100],
      ['Total debits', (res?.validation.totalDebit ?? 0) / 100],
      ['Total credits', (res?.validation.totalCredit ?? 0) / 100],
      ['Closing balance', res?.validation.closing == null ? '' : res.validation.closing / 100],
      ['Transactions', txns.length],
      ['Balance-verified', `${res?.validation.verified ?? 0} of ${res?.validation.total ?? 0}`],
    ];
    const blob = await buildXlsx([{ name: 'Transactions', rows: rows() }, { name: 'Summary', rows: summary }]);
    return { blob, name: `${base}.xlsx` };
  }, [txns, file, fmt, rows, res, company, bankLedger, contraLedger]);

  const doExport = useCallback(async () => {
    if (!txns.length || exporting) return;
    setExporting(true);
    try {
      // Meter the pages first (only a number is sent). If the free allowance is
      // spent and enforcement is on, show the upgrade prompt instead of exporting.
      const c = await consumePages(res?.numPages ?? 0);
      if (!c.allowed) { setOverQuota(true); return; }
      setQuota((q) => (q ? { ...q, used: c.used, remaining: c.remaining } : q));
      const { blob, name } = await makeExport();
      downloadBlob(blob, name);
    } finally { setExporting(false); }
  }, [txns, exporting, makeExport, res]);

  // Load the current allowance when a result is ready (for the usage display).
  useEffect(() => {
    if (status === 'ready') { setOverQuota(false); void getQuota().then(setQuota); }
  }, [status]);

  // Web Share must hand over the file within the click gesture (Safari drops the
  // gesture across an await), so keep the current export pre-built in a ref.
  const shareCache = useRef<{ blob: Blob; name: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (status === 'ready' && txns.length) {
      void makeExport().then((f) => { if (alive) shareCache.current = f; });
    } else {
      shareCache.current = null;
    }
    return () => { alive = false; };
  }, [status, txns, makeExport]);

  // ---- locked: ask for the password (the NORMAL path for bank e-statements) --
  if (status === 'idle' && locked) {
    return (
      <div>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Lock className="size-6" /></span>
          <h3 className="mt-3 text-lg font-bold">This statement is password-protected</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Normal — most banks lock e-statements. Enter the password and we’ll open it <b className="text-foreground">on your device</b>.
            The password stays in this tab and is never sent anywhere.
          </p>
          <div className="mx-auto mt-5 flex max-w-sm gap-2">
            <input
              ref={pwRef}
              type="password"
              value={pw}
              autoComplete="off"
              onChange={(e) => { setPw(e.target.value); setPwWrong(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && pw) void load(locked, pw); }}
              placeholder="Statement password"
              className={`flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 ${pwWrong ? 'border-destructive focus:ring-destructive/30' : 'focus:border-emerald-500 focus:ring-emerald-500/30'}`}
            />
            <Button onClick={() => void load(locked, pw)} disabled={!pw}>Unlock</Button>
          </div>
          {pwWrong && <p className="mt-2 text-sm text-destructive">That password didn’t work — try again.</p>}
          <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground">
            Banks often use a pattern like PAN + date of birth (e.g. <code>ABCDE1234F01011990</code>). Check the email the statement came in.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setLocked(null); setPw(''); setPwWrong(false); }}>Choose another file</Button>
          </div>
        </div>
        <Notes />
      </div>
    );
  }

  // ---- empty ---------------------------------------------------------------
  if (status === 'idle') {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void load(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Upload className="size-6" /></span>
          <span className="mt-4 text-base font-semibold">Drop your bank statement PDF</span>
          <span className="mt-1 max-w-md text-sm text-muted-foreground">
            It’s read <b className="text-foreground">on your device</b> — never uploaded. Every row is checked against the running balance before you export.
          </span>
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        <Notes />
      </div>
    );
  }

  if (status === 'reading') {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-emerald-600" />
        <p className="mt-3 text-sm font-medium">Reading your statement on this device… {Math.round(pct * 100)}%</p>
        <p className="mt-1 text-xs text-muted-foreground">Nothing is being uploaded.</p>
      </div>
    );
  }

  const v = res!.validation;
  // Format in the statement's OWN currency — "₹2,034.57" on a Wells Fargo statement
  // would be plainly wrong, and lakh grouping is wrong for USD.
  const cur: Currency = res!.currency;
  const sym = currencySymbol(cur);
  const money = (m: number | null) => formatMoney(m, cur);

  // ---- no statement found --------------------------------------------------
  if (!v.roles || !txns.length) {
    return (
      <div>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-6" /></span>
          <h3 className="mt-3 text-lg font-bold">We couldn’t find a transaction table</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {!res!.hasText
              ? 'This looks like a scanned statement with no selectable text. Run it through OCR first, then come back.'
              : 'The rows in this PDF don’t form a running-balance table, so we won’t guess — a wrong number in your books is worse than no number.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {!res!.hasText && <Button asChild><a href="/ocr-pdf">Run OCR first</a></Button>}
            <Button variant="outline" onClick={reset}>Try another statement</Button>
          </div>
        </div>
        <Notes />
      </div>
    );
  }

  const allOk = v.ok;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {/* identity */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2.5">
          <FileText className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="max-w-[240px] truncate text-sm font-semibold" title={file?.name}>{file?.name}</span>
          {res!.bank && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              <Landmark className="size-3" /> {res!.bank.name} · {Math.round(res!.bank.confidence * 100)}%
            </span>
          )}
          {res!.meta.account && <Chip>A/c {res!.meta.account}</Chip>}
          {res!.meta.period && <Chip>{res!.meta.period}</Chip>}
          <Chip>{res!.numPages} {res!.numPages === 1 ? 'page' : 'pages'}</Chip>
          <button onClick={reset} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"><X className="size-3.5" /> New file</button>
        </div>

        {/* THE TRUST BAR — the whole product's credibility */}
        <div className={`flex items-center gap-3 border-b px-4 py-3.5 ${allOk ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-white ${allOk ? 'bg-emerald-600' : 'bg-amber-500'}`}>
            {allOk ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              {allOk
                ? `All ${v.total} transactions verified against the running balance`
                : `${v.verified} of ${v.total} verified · ${v.failures.length} row${v.failures.length === 1 ? '' : 's'} don’t reconcile`}
            </span>
            <span className="block text-xs text-muted-foreground">
              {allOk
                ? 'Every row’s balance recomputes exactly from the one above it — the extraction is arithmetically proven, not guessed.'
                : 'Highlighted rows below show what the balance should have been. Fix the cell, or check the original.'}
            </span>
          </span>
        </div>

        {/* summary */}
        <div className="grid grid-cols-2 border-b sm:grid-cols-5">
          <Stat k="Opening" v={`${sym}${money(v.opening)}`} />
          <Stat k="Total debits" v={`${sym}${money(v.totalDebit)}`} tone="dr" />
          <Stat k="Total credits" v={`${sym}${money(v.totalCredit)}`} tone="cr" />
          <Stat k="Closing" v={`${sym}${money(v.closing)}`} />
          <Stat k="Transactions" v={String(v.total)} />
        </div>

        {/* table */}
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="w-8 border-b px-2 py-2" />
                <th className="border-b px-2.5 py-2 text-left font-bold">Date</th>
                <th className="border-b px-2.5 py-2 text-left font-bold">Narration</th>
                <th className="border-b px-2.5 py-2 text-left font-bold">Ref / Chq</th>
                <th className="border-b px-2.5 py-2 text-right font-bold">Debit</th>
                <th className="border-b px-2.5 py-2 text-right font-bold">Credit</th>
                <th className="border-b px-2.5 py-2 text-right font-bold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, i) => (
                <tr key={i} className={t.ok ? (i % 2 ? 'bg-muted/20' : '') : 'bg-amber-500/10'}>
                  <td className={`border-b px-2 text-center font-bold ${t.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{t.ok ? '✓' : '!'}</td>
                  <td className="whitespace-nowrap border-b px-2.5 py-1.5">{t.date}</td>
                  <td className="min-w-[220px] border-b px-2.5 py-1.5">
                    {t.narration}
                    {!t.ok && t.expected != null && (
                      <span className="mt-0.5 block text-[10.5px] text-amber-700 dark:text-amber-400">
                        ⚠ expected {sym}{money(t.expected ?? null)} — statement says {sym}{money(t.balance)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-b px-2.5 py-1.5 text-muted-foreground">{t.ref}</td>
                  <td className="whitespace-nowrap border-b px-2.5 py-1.5 text-right font-mono tabular-nums">{money(t.debit)}</td>
                  <td className="whitespace-nowrap border-b px-2.5 py-1.5 text-right font-mono tabular-nums">{money(t.credit)}</td>
                  <td className="whitespace-nowrap border-b px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{money(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* over-quota → upgrade prompt instead of export */}
        {overQuota && (
          <div className="flex flex-wrap items-center gap-3 border-t border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <span className="font-semibold text-amber-800 dark:text-amber-300">You’ve used your {stmtPrice.freePages} free statement pages this month.</span>
            <span className="text-muted-foreground">Upgrade to Statements Pro — {price(stmtPrice.proMonthly, billing)}/mo — to keep converting.</span>
            <a href="/pricing" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-amber-600">See Statements Pro</a>
          </div>
        )}

        {/* export */}
        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
          <div className="inline-flex overflow-hidden rounded-lg border">
            <button onClick={() => setFmt('xlsx')} className={`px-3 py-1.5 text-xs font-bold ${fmt === 'xlsx' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>Excel .xlsx</button>
            <button onClick={() => setFmt('csv')} className={`px-3 py-1.5 text-xs font-bold ${fmt === 'csv' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>.csv</button>
            <button onClick={() => setFmt('tally')} className={`border-l px-3 py-1.5 text-xs font-bold ${fmt === 'tally' ? 'bg-emerald-600 text-white' : 'text-emerald-700 dark:text-emerald-400'}`}>★ Tally XML</button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {quota?.pro || quota?.unlimited ? (
              <>Statements Pro · <b className="text-foreground">unlimited pages</b></>
            ) : quota ? (
              <><b className="text-foreground">{quota.used} of {quota.limit}</b> free pages used this month · Pro <b className="text-foreground">{price(stmtPrice.proMonthly, billing)}/mo</b> for {stmtPrice.proPages}</>
            ) : (
              <>Free · <b className="text-foreground">{stmtPrice.freePages} pages/mo</b> · Statements Pro <b className="text-foreground">{price(stmtPrice.proMonthly, billing)}/mo</b></>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ShareButton size="sm" title="Bank statement export" label="Share" get={() => (shareCache.current ? [shareCache.current] : [])} />
            <button onClick={() => void doExport()} disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export {v.total} transactions
            </button>
          </div>
        </div>

        {/* Tally ledger mapping — these names must already exist in the user's Tally company */}
        {fmt === 'tally' && (
          <div className="grid gap-3 border-t border-dashed bg-emerald-500/[0.06] px-4 py-3 sm:grid-cols-3">
            <Field label="Company name (in Tally)" value={company} onChange={setCompany} placeholder="Acme Traders Pvt Ltd" />
            <Field label="Bank ledger" value={bankLedger} onChange={setBankLedger} placeholder={res!.bank?.name ? `${res!.bank.name} A/c` : 'Bank A/c'} />
            <Field label="Default contra ledger" value={contraLedger} onChange={setContraLedger} placeholder="Suspense" />
            <p className="text-[11.5px] text-muted-foreground sm:col-span-3">
              Debits → <b className="text-foreground">Payment</b> vouchers · Credits → <b className="text-foreground">Receipt</b> vouchers.
              Produces a Tally Prime–ready <code className="rounded bg-muted px-1">&lt;ENVELOPE&gt;</code> import file. These ledger names must already exist in your Tally company.
            </p>
          </div>
        )}
      </div>
      <Notes />
      <KeepGoing exclude="/bank-statement-converter" title="Do more, privately" />
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
      />
    </label>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{children}</span>;
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'dr' | 'cr' }) {
  return (
    <div className="border-r px-4 py-2.5 last:border-r-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">{k}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${tone === 'dr' ? 'text-red-600 dark:text-red-400' : tone === 'cr' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{v}</div>
    </div>
  );
}

function Notes() {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-[13px] leading-relaxed">
        <Lock className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p>
          <b>Processed on your device.</b> Your statement is read in your browser — never uploaded, stored, or seen by us.
          Check for yourself: open DevTools → Network and watch zero requests leave. Every competitor uploads this file to their servers.
        </p>
      </div>
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-[13px] leading-relaxed">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          <b>Check the output before you file anything.</b> The balance check catches most extraction errors, but this is a
          conversion aid — not accounting, tax or financial advice, and not a substitute for your bank’s statement of record.
          <b> DiemDesk is not affiliated with, endorsed by, or connected to any bank</b>; bank names describe supported formats only.
        </p>
      </div>
    </div>
  );
}
