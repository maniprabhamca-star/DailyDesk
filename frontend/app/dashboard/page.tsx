'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw, ShieldCheck, BarChart3, Users, UserPlus, MousePointerClick, Repeat, AlertTriangle } from 'lucide-react';
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
};

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
type ErrData = { groups: ErrGroup[]; last_24h: number };

type ToolHealth = { slug: string; ok: boolean | null; detail: string | null; fail_streak: number; auto_disabled: boolean; checked_at: string };
type HealthData = { tools: ToolHealth[]; heartbeat: { checked_at: string } | null; now: string };

export default function DashboardPage() {
  const isOwner = useIsOwner();
  const [stats, setStats] = useState<Stats | null>(null);
  const [errs, setErrs] = useState<ErrData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

            {health && (
              <section className="mt-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <AlertTriangle className="size-4 text-primary" /> Tool health (auto-monitor)
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">A canary probes the server tools on a schedule. If one fails repeatedly it auto-disables (users see “temporarily unavailable”) and re-enables on recovery. Client tools also surface real errors below.</p>
                {(() => {
                  const stale = !health.heartbeat || (Date.now() - new Date(health.heartbeat.checked_at).getTime()) > 25 * 60 * 1000;
                  return (
                    <>
                      <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${stale ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                        <span className={`size-2 rounded-full ${stale ? 'bg-destructive' : 'bg-emerald-500'}`} />
                        {health.heartbeat ? (stale ? `Monitor may be down — last ran ${new Date(health.heartbeat.checked_at).toLocaleString()}` : `Monitor healthy — last ran ${new Date(health.heartbeat.checked_at).toLocaleString()}`) : 'Monitor has not run yet'}
                      </p>
                      {health.tools.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {health.tools.map((t) => {
                            const state = t.auto_disabled ? 'disabled' : t.ok ? 'ok' : 'failing';
                            const tone = state === 'ok' ? 'bg-emerald-500' : state === 'failing' ? 'bg-amber-500' : 'bg-destructive';
                            const label = state === 'ok' ? 'Healthy' : state === 'failing' ? `Failing (${t.fail_streak}×)` : 'Auto-disabled';
                            return (
                              <div key={t.slug} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm shadow-soft">
                                <span className="flex items-center gap-2 font-medium"><span className={`size-2.5 rounded-full ${tone}`} /> {t.slug}</span>
                                <span className="text-xs text-muted-foreground">{label} · {t.detail || ''} · {new Date(t.checked_at).toLocaleTimeString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </section>
            )}

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
