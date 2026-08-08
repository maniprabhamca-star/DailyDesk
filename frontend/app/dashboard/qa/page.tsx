'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Gauge, Layers, AlertTriangle, Check, X, ChevronDown, Clock, Cpu, Activity,
} from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { useIsOwner } from '@/lib/plan';
import report from '@/lib/qa-report.generated.json';

// Owner-only QA board.
//
// Everything on this page is DERIVED from artefacts a run produced — Playwright's
// JSON reporter, Vitest's, and scripts/qa-bench.mjs. Nothing is typed by hand,
// because a coverage page that drifts from reality is worse than none: it stops
// people looking. If a number here is stale, the fix is to re-run, not to edit
// the page. `npm run qa:report` does the whole chain.

type Scenario = { file: string; group: string; title: string; ok: boolean; status: string; ms: number };

const fmtMs = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);

export default function QaDashboardPage() {
  const isOwner = useIsOwner();
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const allScenarios: Scenario[] = useMemo(
    () => [
      ...report.projects.flatMap((p: { scenarios: Scenario[] }) => p.scenarios),
      ...((report.unit?.scenarios as Scenario[] | undefined) ?? []),
    ],
    [],
  );

  const byFile = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    for (const s of allScenarios) {
      if (filter && !`${s.file} ${s.group} ${s.title}`.toLowerCase().includes(filter.toLowerCase())) continue;
      const list = map.get(s.file) ?? [];
      list.push(s);
      map.set(s.file, list);
    }
    // Array.from, not spread: the app targets ES5 and Map iteration needs
    // downlevelIteration, which we don't enable.
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [allScenarios, filter]);

  if (!isOwner) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-bold">Not your page</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This one is owner-only. <Link href="/" className="text-primary underline underline-offset-2">Back to the tools</Link>.
          </p>
        </main>
      </>
    );
  }

  const t = report.totals;
  const bench = report.bench;
  const green = t.e2eFailed === 0 && t.unitFailed === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Owner · QA</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">What we test, and what it costs</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString()} · regenerate with <code className="font-mono">npm run qa:report</code>
          </p>
        </div>

        {report.missing.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" /> Parts of this report are missing
            </p>
            <ul className="mt-2 space-y-1">
              {report.missing.map((m: string) => (
                <li key={m} className="text-[13px] text-muted-foreground">{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ---------------------------------------------------------- totals */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={green ? ShieldCheck : X}
            tone={green ? 'good' : 'bad'}
            label="Overall"
            value={green ? 'All green' : `${t.e2eFailed + t.unitFailed} failing`}
            sub={`${t.e2e + t.unit} checks`}
          />
          <Stat icon={Layers} label="End-to-end" value={`${t.e2ePassed}/${t.e2e}`} sub={`${report.projects.length} browser project(s)`} />
          <Stat icon={Check} label="Unit" value={`${t.unitPassed}/${t.unit}`} sub="engine logic, no browser" />
          <Stat
            icon={Gauge}
            label="Bench"
            value={bench ? `${bench.perf.length} perf rows` : '—'}
            sub={bench ? `${bench.stress.length} stress scenarios` : 'not run'}
          />
        </section>

        {/* ----------------------------------------------------------- areas */}
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">What the checks cover</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.areas.map((a: { id: string; label: string; count: number; passed: number; failed: number }) => (
              <button
                key={a.id}
                onClick={() => { setOpenArea(a.id); setFilter(''); }}
                className="rounded-xl border p-4 text-left transition-colors hover:border-primary/50"
              >
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {a.label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${a.failed ? 'bg-destructive/15 text-destructive' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}`}>
                    {a.failed ? `${a.failed} failing` : 'green'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{a.count} checks</p>
              </button>
            ))}
          </div>
          {openArea && <p className="mt-2 text-xs text-muted-foreground">Filter the list below to inspect them.</p>}
        </section>

        {/* ------------------------------------------------------------ perf */}
        {bench && (
          <>
            <section className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Performance — one operation, growing input</h2>
                <p className="text-xs text-muted-foreground">{bench.platform} · node {bench.node} · median of 3 after a warm-up</p>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Operation</th>
                      <th className="px-4 py-2 font-semibold">Pages</th>
                      <th className="px-4 py-2 text-right font-semibold">Time</th>
                      <th className="px-4 py-2 text-right font-semibold">Spread</th>
                      <th className="px-4 py-2 text-right font-semibold">Heap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bench.perf.map((r: { op: string; pages: number; ms: number; spreadMs?: number; heapDeltaMb: number }, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-1.5 font-medium">{r.op}</td>
                        <td className="px-4 py-1.5 tabular-nums text-muted-foreground">{r.pages}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{fmtMs(r.ms)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{r.spreadMs != null ? `±${fmtMs(r.spreadMs)}` : '—'}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{r.heapDeltaMb} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ---------------------------------------------------------- load */}
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Activity className="size-4" /> Load — many at once
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Baseline (one alone): {fmtMs(bench.load.baselineMs)}. Degradation above 1.0 means each operation got slower as the pile grew.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {bench.load.rows.map((r: { concurrency: number; totalMs: number; perOpMs: number; degradation: number }) => (
                  <div key={r.concurrency} className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">{r.concurrency} concurrent</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{fmtMs(r.perOpMs)}</p>
                    <p className="text-[11px] text-muted-foreground">each · {fmtMs(r.totalMs)} total</p>
                    <p className={`mt-1 text-[11px] font-semibold ${r.degradation > 1.5 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      ×{r.degradation} vs alone
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* -------------------------------------------------------- stress */}
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Cpu className="size-4" /> Stress — escalate until it breaks
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The last passing row is the measured ceiling. A ceiling you know is a feature; one you meet in production is an outage.
              </p>
              <div className="mt-3 space-y-2">
                {bench.stress.map((r: { scenario: string; ms?: number; heapDeltaMb?: number; outcome: string; error?: string }, i: number) => (
                  <div key={i} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${r.outcome === 'ok' ? '' : 'border-destructive/40 bg-destructive/[0.05]'}`}>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {r.outcome === 'ok'
                        ? <Check className="size-4 text-emerald-700 dark:text-emerald-400" />
                        : <X className="size-4 text-destructive" />}
                      {r.scenario}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      {r.ms != null && <span className="flex items-center gap-1 tabular-nums"><Clock className="size-3.5" /> {fmtMs(r.ms)}</span>}
                      {r.heapDeltaMb != null && <span className="tabular-nums">{r.heapDeltaMb} MB heap</span>}
                      {r.error && <span className="text-destructive">{r.error}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ------------------------------------------------------- scenarios */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Every scenario ({allScenarios.length})
            </h2>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter — try REG-, axe, sitemap…"
              aria-label="Filter scenarios"
              className="w-full max-w-xs rounded-lg border bg-background px-3 py-1.5 text-sm"
            />
          </div>

          <div className="mt-3 space-y-2">
            {byFile.map(([file, list]) => (
              <details key={file} className="rounded-xl border" open={!!filter}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <ChevronDown className="size-4 text-muted-foreground" />
                    <span className="font-mono text-[13px]">{file}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {list.filter((s) => s.ok).length}/{list.length} passing
                  </span>
                </summary>
                <ul className="divide-y border-t">
                  {list.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 px-4 py-2">
                      {s.status === 'skipped'
                        ? <span className="mt-0.5 size-4 shrink-0 rounded-full border" title="skipped" />
                        : s.ok
                          ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                          : <X className="mt-0.5 size-4 shrink-0 text-destructive" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{s.title}</span>
                        {s.group && <span className="block truncate text-[11px] text-muted-foreground">{s.group}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{s.ms ? fmtMs(s.ms) : ''}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {byFile.length === 0 && (
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nothing matches that filter.</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: {
  icon: typeof Check; label: string; value: string; sub: string; tone?: 'good' | 'bad';
}) {
  const ring = tone === 'bad' ? 'border-destructive/40 bg-destructive/[0.05]'
    : tone === 'good' ? 'border-emerald-600/35 bg-emerald-500/[0.06]' : '';
  return (
    <div className={`rounded-xl border p-4 ${ring}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" /> {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
