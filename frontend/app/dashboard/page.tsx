'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw, ShieldCheck, BarChart3, Users, UserPlus, MousePointerClick, Repeat, AlertTriangle, Activity, Crown, Play } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { useIsOwner } from '@/lib/plan';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Stats = {
  registered_users: number;
  signups_24h: number; signups_7d: number;
  unique_visitors: number;
  dau: number; wau: number; mau: number;
  returning_visitors: number;
  total_tool_uses: number;
  top_tools: { module: string; uses: number }[];
  pro_subscribers: number;
  pro_active_30d: number;
  pro_waitlist: number;
  size_buckets?: Record<string, number>;
  size_by_tool?: { module: string; bucket: string; c: number }[];
};

const SIZE_ORDER = ['<50MB', '50-100MB', '100MB-1GB', '1-2GB', '>2GB'];

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> <span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

type ErrGroup = { message: string; source: string | null; count: number; last_seen: string; visitors: number; last_path: string | null };
type ByTool = { tool: string; count: number; last_seen: string };
type ErrData = { groups: ErrGroup[]; last_24h: number; by_tool?: ByTool[] };

type ToolHealth = { slug: string; ok: boolean | null; detail: string | null; fail_streak: number; auto_disabled: boolean; checked_at: string };
type HealthData = { tools: ToolHealth[]; heartbeat: { checked_at: string } | null; browserHeartbeat?: { checked_at: string } | null; now: string };

export default function DashboardPage() {
  const isOwner = useIsOwner();
  const [stats, setStats] = useState<Stats | null>(null);
  const [errs, setErrs] = useState<ErrData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testsBusy, setTestsBusy] = useState(false);
  const [testsMsg, setTestsMsg] = useState<string | null>(null);

  async function runTests() {
    setTestsBusy(true); setTestsMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      const ownerKey = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s*)ddadmin=([^;]+)/)?.[1] ?? null) : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (ownerKey) headers['x-owner-key'] = decodeURIComponent(ownerKey);
      const res = await fetch(`${API}/api/events/run-tests`, { method: 'POST', headers });
      const data = await res.json().catch(() => ({}));
      setTestsMsg(res.ok ? (data.started ? 'Tests started — results update in ~1 min, then hit Refresh.' : (data.note || 'Already running.')) : 'Could not start the tests.');
    } catch { setTestsMsg('Could not start the tests.'); }
    finally { setTestsBusy(false); }
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      // Owner bypass: the ddadmin cookie also authorises the dashboard (no app login).
      const ownerKey = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s*)ddadmin=([^;]+)/)?.[1] ?? null) : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (ownerKey) headers['x-owner-key'] = decodeURIComponent(ownerKey);
      const res = await fetch(`${API}/api/events/stats`, { headers });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Not available — log in as the owner account (or open from a browser with the owner bypass).');
        throw new Error(`Request failed (${res.status})`);
      }
      setStats(await res.json());
      // Errors + tool health are best-effort — don't fail the dashboard if they 500.
      try { const er = await fetch(`${API}/api/events/errors`, { headers }); if (er.ok) setErrs(await er.json()); } catch { /* ignore */ }
      try { const hr = await fetch(`${API}/api/events/health`, { headers }); if (hr.ok) setHealth(await hr.json()); } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stats.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOwner) void load(); else setLoading(false); }, [isOwner, load]);

  const maxUse = stats?.top_tools.reduce((m, t) => Math.max(m, t.uses), 0) || 1;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usage dashboard</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-600" /> First-party data from your own server — no third-party trackers.
            </p>
          </div>
          {isOwner && <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>}
        </div>

        {!isOwner ? (
          <div className="mt-10 rounded-xl border bg-card p-8 text-center text-muted-foreground">This page is available to the owner account only.</div>
        ) : loading ? (
          <div className="mt-16 flex justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div>
        ) : stats ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric icon={Users} label="Registered users" value={stats.registered_users} sub={`+${stats.signups_24h} today · +${stats.signups_7d} this week`} />
              <Metric icon={UserPlus} label="Unique visitors" value={stats.unique_visitors} />
              <Metric icon={MousePointerClick} label="Total tool uses" value={stats.total_tool_uses} />
              <Metric icon={Repeat} label="Returning visitors" value={stats.returning_visitors} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <Metric icon={BarChart3} label="Active today (DAU)" value={stats.dau} />
              <Metric icon={BarChart3} label="This week (WAU)" value={stats.wau} />
              <Metric icon={BarChart3} label="This month (MAU)" value={stats.mau} />
            </div>

            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Crown className="size-4 text-amber-500" /> Pro</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Metric icon={Crown} label="Pro subscribers" value={stats.pro_subscribers} sub="active paid plans" />
                <Metric icon={Activity} label="Pro active (30d)" value={stats.pro_active_30d} sub="used a tool while Pro" />
                <Metric icon={UserPlus} label="Pro waitlist" value={stats.pro_waitlist} sub="notify-me signups" />
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold">Top tools</h2>
              {stats.top_tools.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No tool usage recorded yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {stats.top_tools.map((t) => (
                    <div key={t.module} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm font-medium">{t.module}</span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div className="h-full rounded bg-primary/70" style={{ width: `${Math.max(4, (t.uses / maxUse) * 100)}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{t.uses.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {stats.size_buckets && (() => {
              const buckets = stats.size_buckets!;
              const total = SIZE_ORDER.reduce((s, b) => s + (buckets[b] || 0), 0);
              const maxB = Math.max(1, ...SIZE_ORDER.map((b) => buckets[b] || 0));
              const big = (buckets['100MB-1GB'] || 0) + (buckets['1-2GB'] || 0) + (buckets['>2GB'] || 0);
              return (
                <section className="mt-8">
                  <h2 className="text-lg font-semibold">File sizes</h2>
                  <p className="mt-1 text-xs text-muted-foreground">How large real users’ files are (largest file per upload; bucket only — no filenames or bytes). The in-browser guard warns above ~1.6&nbsp;GB on an 8&nbsp;GB device.</p>
                  {total === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No file selections recorded yet.</p>
                  ) : (
                    <>
                      <div className="mt-3 space-y-2">
                        {SIZE_ORDER.map((b) => {
                          const n = buckets[b] || 0;
                          const heavy = b === '1-2GB' || b === '>2GB';
                          return (
                            <div key={b} className="flex items-center gap-3">
                              <span className="w-24 shrink-0 text-sm font-medium tabular-nums">{b}</span>
                              <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                                <div className={`h-full rounded ${heavy ? 'bg-red-500/70' : 'bg-primary/70'}`} style={{ width: `${Math.max(2, (n / maxB) * 100)}%` }} />
                              </div>
                              <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{n.toLocaleString()} · {Math.round((n / total) * 100)}%</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {big.toLocaleString()} of {total.toLocaleString()} uploads ({Math.round((big / total) * 100)}%) were ≥100&nbsp;MB
                        {stats.size_by_tool && stats.size_by_tool.length ? ` — mostly ${stats.size_by_tool.slice(0, 3).map((t) => `${t.module} (${t.bucket})`).join(', ')}` : ''}.
                      </p>
                    </>
                  )}
                </section>
              );
            })()}

            {health && (() => {
              const stale = !health.heartbeat || (Date.now() - new Date(health.heartbeat.checked_at).getTime()) > 25 * 60 * 1000;
              const errByTool = new Map((errs?.by_tool || []).map((t) => [t.tool, t.count]));
              const healthy = health.tools.filter((t) => t.ok && !t.auto_disabled).length;
              const failing = health.tools.filter((t) => !t.ok && !t.auto_disabled).length;
              const disabled = health.tools.filter((t) => t.auto_disabled).length;
              return (
                <section className="mt-8">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="size-4 text-primary" /> Tool health (auto-monitor)</h2>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${stale ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                        <span className={`size-2 rounded-full ${stale ? 'bg-destructive' : 'bg-emerald-500 animate-pulse'}`} />
                        {health.heartbeat ? (stale ? `Monitor down — last ran ${new Date(health.heartbeat.checked_at).toLocaleTimeString()}` : `Live · checked ${new Date(health.heartbeat.checked_at).toLocaleTimeString()}`) : 'Monitor not run yet'}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => void runTests()} disabled={testsBusy}><Play className="size-3.5" /> {testsBusy ? 'Starting…' : 'Run tests now'}</Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">The Node canary runs tool cores every 10 min; a headless-browser (Playwright) canary drives the in-browser tools with a real file every 30 min. A failing tool auto-disables (users see “temporarily unavailable”) and re-enables on recovery; you’re emailed either way. <b className="text-foreground">Run tests now</b> fires both immediately — results appear below after ~1 min (hit Refresh).</p>
                  {health.browserHeartbeat && <p className="mt-1 text-[11px] text-muted-foreground">Browser (Playwright) tests last ran {new Date(health.browserHeartbeat.checked_at).toLocaleTimeString()}.</p>}
                  {testsMsg && <p className="mt-1 text-xs font-medium text-primary">{testsMsg}</p>}

                  {/* summary KPI tiles */}
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-2xl font-bold text-emerald-600">{healthy}</p><p className="text-xs text-muted-foreground">Healthy</p></div>
                    <div className={`rounded-xl border p-4 shadow-soft ${failing ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}><p className={`text-2xl font-bold ${failing ? 'text-amber-600' : ''}`}>{failing}</p><p className="text-xs text-muted-foreground">Failing</p></div>
                    <div className={`rounded-xl border p-4 shadow-soft ${disabled ? 'border-destructive/40 bg-destructive/5' : 'bg-card'}`}><p className={`text-2xl font-bold ${disabled ? 'text-destructive' : ''}`}>{disabled}</p><p className="text-xs text-muted-foreground">Auto-disabled</p></div>
                  </div>

                  {/* per-tool KPI cards */}
                  {health.tools.length > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {health.tools.map((t) => {
                        const state = t.auto_disabled ? 'disabled' : t.ok ? 'ok' : 'failing';
                        const tone = state === 'ok' ? { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', ring: 'border-emerald-500/30', label: 'Healthy' }
                          : state === 'failing' ? { dot: 'bg-amber-500', text: 'text-amber-600', ring: 'border-amber-500/40', label: `Failing ${t.fail_streak}×` }
                          : { dot: 'bg-destructive', text: 'text-destructive', ring: 'border-destructive/40', label: 'Auto-disabled' };
                        const errs7d = errByTool.get(t.slug) || 0;
                        return (
                          <div key={t.slug} className={`rounded-xl border ${tone.ring} bg-card p-4 shadow-soft`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold">{t.slug}</span>
                              <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.text}`}><span className={`size-2 rounded-full ${tone.dot}`} />{tone.label}</span>
                            </div>
                            <p className="mt-2 truncate text-xs text-muted-foreground">{t.detail || '—'}</p>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>checked {new Date(t.checked_at).toLocaleTimeString()}</span>
                              <span className={errs7d ? 'font-medium text-amber-600' : ''}>{errs7d ? `${errs7d} err/7d` : 'no user errors'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}

            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="size-4 text-amber-500" /> Client errors
                {errs && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{errs.last_24h} in 24h</span>}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Uncaught JS errors real browsers hit — first-party, so you catch a broken tool without any third-party tracker.</p>
              {!errs || errs.groups.length === 0 ? (
                <p className="mt-3 rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">No errors reported. 🎉</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {errs.groups.map((g, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 text-sm shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 break-words font-medium">{g.message}</p>
                        <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{g.count}×</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{g.last_path || g.source || ''} · {g.visitors} visitor{g.visitors === 1 ? '' : 's'} · last {new Date(g.last_seen).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-8 text-xs text-muted-foreground">
              Traffic &amp; audience stats (visitors, sources, countries) live in Cloudflare Web Analytics. This page shows tool engagement from your own database.
            </p>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
