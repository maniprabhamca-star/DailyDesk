'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Package, RefreshCw, ArrowLeft, Check, AlertTriangle, XCircle,
  HelpCircle, HardDriveDownload, Clock, UserRound, Bot, ListChecks,
} from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { Button } from '@/components/ui/button';
import { useIsOwner } from '@/lib/plan';

// The owner's view of what is actually true right now.
//
// Deliberately NOT a written summary of our hardening. An audit on 2026-08-30
// found ufw missing from PATH, every Node process running as root, and a
// nightly backup that never touched the database — none of which a hand-written
// page would have caught, because it would have restated what we believed
// rather than what was true. Every row here is measured server-side at request
// time, and a check that cannot run says "unknown" instead of passing.

const API = process.env.NEXT_PUBLIC_API_URL || '';

type State = 'pass' | 'warn' | 'fail' | 'unknown';
type Check = { id: string; label: string; state: State; detail: string; action: string | null; who: 'you' | 'claude' | null };
type Action = { id: string; who: 'you' | 'claude'; label: string; action: string; severity: State };
type Dep = { name: string; wanted: string; installed: string | null };
type Pkg = { name: string; count: number; deps: Dep[] } | null;
type Advisory = { name: string; severity: string; range: string; title: string | null; direct: boolean };

type Report = {
  measuredAt: string;
  actions: Action[];
  security: Check[];
  backups: Check[];
  dependencies: {
    frontend: Pkg; backend: Pkg; mcp: Pkg;
    audit: { totals?: Record<string, number> | null; items?: Advisory[]; error?: string };
  };
  runtime: { node: string; uptimeHours: number };
};

const TONE: Record<State, { icon: typeof Check; cls: string; ring: string }> = {
  pass:    { icon: Check,       cls: 'text-emerald-700 dark:text-emerald-400', ring: 'bg-emerald-500/10' },
  warn:    { icon: AlertTriangle, cls: 'text-amber-700 dark:text-amber-400',   ring: 'bg-amber-500/10' },
  fail:    { icon: XCircle,     cls: 'text-red-700 dark:text-red-400',         ring: 'bg-red-500/10' },
  unknown: { icon: HelpCircle,  cls: 'text-muted-foreground',                  ring: 'bg-muted' },
};

function Row({ c }: { c: Check }) {
  const t = TONE[c.state];
  const Icon = t.icon;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${t.ring}`}>
        <Icon className={`size-3 ${t.cls}`} strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{c.label}</p>
        <p className="mt-0.5 break-words text-xs text-muted-foreground">{c.detail}</p>
        {c.action && (
          <p className={`mt-1 text-xs font-medium ${t.cls}`}>→ {c.action}</p>
        )}
      </div>
    </li>
  );
}

function Panel({ title, icon: Icon, checks }: { title: string; icon: typeof Check; checks: Check[] }) {
  const bad = checks.filter((c) => c.state === 'fail').length;
  const warn = checks.filter((c) => c.state === 'warn').length;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto flex gap-1.5 text-[11px] font-semibold">
          {bad > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-400">{bad} failing</span>}
          {warn > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">{warn} to review</span>}
          {bad === 0 && warn === 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">all clear</span>}
        </span>
      </header>
      <ul className="divide-y">{checks.map((c) => <Row key={c.id} c={c} />)}</ul>
    </section>
  );
}

function Deps({ pkg }: { pkg: Pkg }) {
  if (!pkg) return null;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{pkg.name}</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{pkg.count} shipping</span>
      </header>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody className="divide-y">
            {pkg.deps.map((d) => (
              <tr key={d.name}>
                <td className="px-4 py-1.5 font-mono">{d.name}</td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                  {d.installed || d.wanted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SystemPage() {
  const isOwner = useIsOwner();
  const [tab, setTab] = useState<'security' | 'deps'>('security');
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const headers: Record<string, string> = {};
      const t = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      if (t) headers.Authorization = `Bearer ${t}`;
      const key = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|;\s*)ddadmin=([^;]+)/)?.[1] ?? null : null;
      if (key) headers['x-owner-key'] = decodeURIComponent(key);
      const res = await fetch(`${API}/api/system`, { headers });
      if (res.status === 404) throw new Error('Not available — sign in as the owner account, or open with the owner bypass.');
      if (!res.ok) throw new Error('Could not load the report.');
      setData(await res.json());
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the report.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!isOwner) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-20 text-center">
          <h1 className="text-xl font-bold">Not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page is for the account owner.</p>
        </main>
      </div>
    );
  }

  const adv = data?.dependencies.audit;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Measured now, not written down. A check that cannot run says so rather than passing.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={busy}>
            <RefreshCw className={`mr-1.5 size-4 ${busy ? 'animate-spin' : ''}`} /> Re-check
          </Button>
        </div>

        {data && data.actions.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-2 border-b px-4 py-2.5">
              <ListChecks className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">What to do next</h2>
              <span className="ml-auto text-[11px] text-muted-foreground">{data.actions.length} open</span>
            </header>
            <div className="grid sm:grid-cols-2 sm:divide-x">
              {(['you', 'claude'] as const).map((who) => {
                const items = data.actions.filter((a) => a.who === who);
                const Icon = who === 'you' ? UserRound : Bot;
                return (
                  <div key={who} className="min-w-0">
                    <p className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Icon className="size-3.5" /> {who === 'you' ? 'Needs you' : 'Needs code'}
                    </p>
                    {items.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">Nothing outstanding.</p>
                    ) : (
                      <ul className="divide-y">
                        {items.map((a) => (
                          <li key={a.id} className="px-4 py-3">
                            <p className="flex items-start gap-2 text-sm font-medium">
                              <span className={`mt-1 size-1.5 shrink-0 rounded-full ${a.severity === 'fail' ? 'bg-red-500' : 'bg-amber-500'}`} />
                              {a.label}
                            </p>
                            <p className="mt-0.5 pl-3.5 text-xs text-muted-foreground">{a.action}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Derived from the checks below, not a list kept by hand — an item disappears when the thing it describes
              starts passing.
            </p>
          </section>
        )}

        <div className="mt-5 inline-flex gap-1 rounded-lg bg-muted p-1 text-xs">
          {([['security', 'Security & backups', ShieldCheck], ['deps', 'Dependencies', Package]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                tab === k ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {err && <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{err}</p>}
        {!data && !err && <p className="mt-5 text-sm text-muted-foreground">Checking…</p>}

        {data && tab === 'security' && (
          <div className="mt-5 space-y-4">
            <Panel title="Hardening" icon={ShieldCheck} checks={data.security} />
            <Panel title="Backups" icon={HardDriveDownload} checks={data.backups} />
          </div>
        )}

        {data && tab === 'deps' && (
          <div className="mt-5 space-y-4">
            <section className="overflow-hidden rounded-xl border bg-card">
              <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <AlertTriangle className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Advisories in shipping dependencies</h2>
              </header>
              {adv?.error ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">{adv.error}</p>
              ) : adv?.items?.length ? (
                <ul className="divide-y">
                  {adv.items.map((a) => (
                    <li key={a.name} className="px-4 py-3">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="font-mono">{a.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          a.severity === 'critical' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
                          {a.severity}
                        </span>
                        {a.direct && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">direct</span>}
                      </p>
                      {a.title && <p className="mt-0.5 text-xs text-muted-foreground">{a.title}</p>}
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{a.range}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
                  No high or critical advisories.
                </p>
              )}
              <p className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                Dependabot opens a pull request the day an advisory publishes, and CI blocks a merge on any
                unwaived high or critical. Waivers carry a reason and an expiry — see
                <span className="font-mono"> frontend/scripts/audit-gate.mjs</span>.
              </p>
            </section>

            <Deps pkg={data.dependencies.frontend} />
            <Deps pkg={data.dependencies.backend} />
            <Deps pkg={data.dependencies.mcp} />
          </div>
        )}

        {data && (
          <p className="mt-5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            Measured {new Date(data.measuredAt).toLocaleString()} · Node {data.runtime.node} · up {data.runtime.uptimeHours}h
          </p>
        )}
      </main>
    </div>
  );
}
