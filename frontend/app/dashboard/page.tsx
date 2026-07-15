'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, ShieldCheck, BarChart3, Users, UserPlus, MousePointerClick, Repeat,
  AlertTriangle, Activity, Crown, Play, CalendarDays, Globe, Link2, MonitorSmartphone,
  Chrome, MessageSquare, Star, TrendingUp, SearchX,
} from 'lucide-react';
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
  range?: { from: string; to: string } | null;
  bots?: number;
  signups_range?: number | null;
  countries?: { country: string; visitors: number }[];
  sources?: { source: string; visitors: number }[];
  devices?: { device: string; visitors: number }[];
  browsers?: { browser: string; visitors: number }[];
  trend?: { d: string; visitors: number; uses: number }[];
  search_misses?: { q: string; count: number; visitors: number }[];
  feedback_recent?: { at: string; category: string | null; rating: number | null; message: string; page: string | null }[];
  feedback_summary?: { total: number; last_7d: number; avg_rating: number | null } | null;
};

const SIZE_ORDER = ['<50MB', '50-100MB', '100MB-1GB', '1-2GB', '>2GB'];

type RangeKey = 'all' | 'today' | '7d' | '30d' | 'custom';
const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' }, { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }, { key: 'custom', label: 'Custom' },
];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
function presetDates(key: RangeKey): { from: string; to: string } | null {
  const now = new Date(); const to = isoDay(now);
  if (key === 'today') return { from: to, to };
  if (key === '7d') { const f = new Date(now); f.setDate(now.getDate() - 6); return { from: isoDay(f), to }; }
  if (key === '30d') { const f = new Date(now); f.setDate(now.getDate() - 29); return { from: isoDay(f), to }; }
  return null;
}

// Country code → flag emoji + English name (no data files — Intl + regional-indicator letters).
function flagEmoji(cc: string): string {
  if (!/^[A-Z]{2}$/i.test(cc)) return '🏳️';
  return String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
const regionName = (() => {
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (cc: string) => { try { return dn.of(cc) || cc; } catch { return cc; } }; }
  catch { return (cc: string) => cc; }
})();

// ── Small shared building blocks ──────────────────────────────────────────
function Metric({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> <span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BarList({ items, empty = 'No data yet.' }: { items: { label: React.ReactNode; value: number }[]; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm">{it.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary/70" style={{ width: `${Math.max(4, (it.value / max) * 100)}%` }} /></div>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{it.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ icon: Icon, title, right, children }: { icon?: typeof Users; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">{Icon && <Icon className="size-4 text-primary" />}{title}</h2>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Daily activity: visitors as a line, tool-uses as faint bars behind.
function TrendChart({ data }: { data: { d: string; visitors: number; uses: number }[] }) {
  if (!data.length) return <p className="py-4 text-sm text-muted-foreground">No activity in this range yet.</p>;
  const n = data.length, W = Math.max(n * 16, 80), H = 100, pad = 10;
  const maxV = Math.max(1, ...data.map((d) => d.visitors));
  const maxU = Math.max(1, ...data.map((d) => d.uses));
  const x = (i: number) => (n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const yV = (v: number) => H - pad - (v / maxV) * (H - 2 * pad);
  const yUbar = (u: number) => (u / maxU) * (H - 2 * pad);
  const bw = Math.min(12, ((W - 2 * pad) / n) * 0.55);
  const line = data.map((d, i) => `${x(i)},${yV(d.visitors)}`).join(' ');
  const peak = data.reduce((m, d) => (d.visitors > m.visitors ? d : m), data[0]);
  return (
    <div>
      <div className="mb-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> Visitors</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-primary/25" /> Tool uses</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 130 }}>
        {data.map((d, i) => { const h = yUbar(d.uses); return <rect key={i} x={x(i) - bw / 2} y={H - pad - h} width={bw} height={h} rx="1" className="fill-primary/20" />; })}
        <polyline points={line} fill="none" className="stroke-primary" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0].d}</span>
        <span className="font-medium text-foreground">Peak {peak.visitors} on {peak.d}</span>
        <span>{data[n - 1].d}</span>
      </div>
    </div>
  );
}

type ErrGroup = { message: string; source: string | null; count: number; last_seen: string; visitors: number; last_path: string | null };
type ByTool = { tool: string; count: number; last_seen: string };
type ErrData = { groups: ErrGroup[]; last_24h: number; by_tool?: ByTool[] };
type ToolHealth = { slug: string; ok: boolean | null; detail: string | null; fail_streak: number; auto_disabled: boolean; checked_at: string };
type HealthData = { tools: ToolHealth[]; heartbeat: { checked_at: string } | null; browserHeartbeat?: { checked_at: string } | null; now: string };

type AudTab = 'country' | 'sources' | 'devices' | 'browsers';

export default function DashboardPage() {
  const isOwner = useIsOwner();
  const [stats, setStats] = useState<Stats | null>(null);
  const [errs, setErrs] = useState<ErrData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testsBusy, setTestsBusy] = useState(false);
  const [testsMsg, setTestsMsg] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<RangeKey>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [audTab, setAudTab] = useState<AudTab>('country');

  const dates = useMemo<{ from: string; to: string } | null>(() => {
    if (rangeKey === 'custom') return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    return presetDates(rangeKey);
  }, [rangeKey, customFrom, customTo]);

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

  const load = useCallback(async (range: { from: string; to: string } | null) => {
    setLoading(true); setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      const ownerKey = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s*)ddadmin=([^;]+)/)?.[1] ?? null) : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (ownerKey) headers['x-owner-key'] = decodeURIComponent(ownerKey);
      const qs = range ? `?from=${range.from}&to=${range.to}` : '';
      const res = await fetch(`${API}/api/events/stats${qs}`, { headers });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Not available — log in as the owner account (or open from a browser with the owner bypass).');
        throw new Error(`Request failed (${res.status})`);
      }
      setStats(await res.json());
      try { const er = await fetch(`${API}/api/events/errors`, { headers }); if (er.ok) setErrs(await er.json()); } catch { /* ignore */ }
      try { const hr = await fetch(`${API}/api/events/health`, { headers }); if (hr.ok) setHealth(await hr.json()); } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stats.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOwner) void load(dates); else setLoading(false); }, [isOwner, load, dates]);

  const rangeLabel = stats?.range ? `${stats.range.from} → ${stats.range.to}` : 'all time';

  const audItems: { label: React.ReactNode; value: number }[] = useMemo(() => {
    if (!stats) return [];
    if (audTab === 'country') return (stats.countries || []).map((c) => ({ label: <span>{flagEmoji(c.country)} {regionName(c.country)}</span>, value: c.visitors }));
    if (audTab === 'sources') return (stats.sources || []).map((s) => ({ label: s.source === 'direct' ? 'Direct / in-app' : s.source, value: s.visitors }));
    if (audTab === 'devices') return (stats.devices || []).map((d) => ({ label: d.device, value: d.visitors }));
    return (stats.browsers || []).map((b) => ({ label: b.browser, value: b.visitors }));
  }, [stats, audTab]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usage dashboard</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-emerald-600" /> First-party data from your own server — no third-party trackers.</p>
          </div>
          {isOwner && <Button size="sm" variant="outline" onClick={() => void load(dates)} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>}
        </div>

        {isOwner && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarDays className="size-3.5" /> Range</span>
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
              {RANGE_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => setRangeKey(p.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${rangeKey === p.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card'}`}>{p.label}</button>
              ))}
            </div>
            {rangeKey === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input type="date" value={customFrom} max={customTo || isoDay(new Date())} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-md border bg-background px-2 py-1" />
                <span className="text-muted-foreground">→</span>
                <input type="date" value={customTo} min={customFrom} max={isoDay(new Date())} onChange={(e) => setCustomTo(e.target.value)} className="rounded-md border bg-background px-2 py-1" />
              </div>
            )}
            <span className="text-xs text-muted-foreground">{dates ? `${dates.from} → ${dates.to}` : 'All time'}</span>
          </div>
        )}

        {!isOwner ? (
          <div className="mt-10 rounded-xl border bg-card p-8 text-center text-muted-foreground">This page is available to the owner account only.</div>
        ) : loading ? (
          <div className="mt-16 flex justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div>
        ) : stats ? (
          <>
            {/* ── Overview ── */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric icon={UserPlus} label="Unique visitors" value={stats.unique_visitors} sub={`people${stats.bots ? ` · ${stats.bots.toLocaleString()} bots filtered` : ''}`} />
              <Metric icon={MousePointerClick} label="Tool uses" value={stats.total_tool_uses} />
              <Metric icon={Repeat} label="Returning" value={stats.returning_visitors} sub={`${Math.max(0, stats.unique_visitors - stats.returning_visitors).toLocaleString()} first-time`} />
              <Metric icon={Users} label="Registered users" value={stats.registered_users} sub={`+${stats.signups_24h} today · +${stats.signups_7d} / 7d`} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Metric icon={BarChart3} label="Active today (DAU)" value={stats.dau} />
              <Metric icon={BarChart3} label="This week (WAU)" value={stats.wau} />
              <Metric icon={BarChart3} label="This month (MAU)" value={stats.mau} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Activity metrics reflect <b className="text-foreground">{rangeLabel}</b> · bots &amp; automated traffic (incl. the health canary) are excluded. DAU/WAU/MAU are fixed rolling windows.
            </p>

            {/* ── Daily activity ── */}
            <Section icon={TrendingUp} title="Daily activity"><TrendChart data={stats.trend || []} /></Section>

            {/* ── Audience (tabbed to stay compact) ── */}
            <Section icon={Globe} title="Audience"
              right={
                <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
                  {([['country', 'Country', Globe], ['sources', 'Sources', Link2], ['devices', 'Devices', MonitorSmartphone], ['browsers', 'Browsers', Chrome]] as const).map(([k, lbl, Icon]) => (
                    <button key={k} onClick={() => setAudTab(k)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition ${audTab === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card'}`}><Icon className="size-3.5" />{lbl}</button>
                  ))}
                </div>
              }>
              <div className="rounded-xl border bg-card p-4 shadow-soft">
                <BarList items={audItems} empty={audTab === 'country' ? 'No country data yet (arrives with Cloudflare on new visits).' : audTab === 'sources' ? 'No referrers yet — new visits will show their source.' : 'No data yet.'} />
                {audTab === 'sources' && <p className="mt-3 text-[11px] text-muted-foreground">“Direct / in-app” = typed the URL, a bookmark, or navigated within the site. Others are the site that linked here.</p>}
              </div>
            </Section>

            {/* ── Engagement: top tools + file sizes ── */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">Top tools</h2>
                <div className="mt-3"><BarList items={(stats.top_tools || []).map((t) => ({ label: t.module, value: t.uses }))} empty="No tool usage in this range yet." /></div>
              </div>
              {stats.size_buckets && (() => {
                const b = stats.size_buckets!; const total = SIZE_ORDER.reduce((s, k) => s + (b[k] || 0), 0);
                const maxB = Math.max(1, ...SIZE_ORDER.map((k) => b[k] || 0));
                const big = (b['100MB-1GB'] || 0) + (b['1-2GB'] || 0) + (b['>2GB'] || 0);
                return (
                  <div>
                    <h2 className="text-lg font-semibold">File sizes</h2>
                    {total === 0 ? <p className="mt-3 text-sm text-muted-foreground">No file selections in this range yet.</p> : (
                      <>
                        <div className="mt-3 space-y-2">
                          {SIZE_ORDER.map((k) => { const n = b[k] || 0; const heavy = k === '1-2GB' || k === '>2GB'; return (
                            <div key={k} className="flex items-center gap-3">
                              <span className="w-20 shrink-0 text-sm font-medium tabular-nums">{k}</span>
                              <div className="h-5 flex-1 overflow-hidden rounded bg-muted"><div className={`h-full rounded ${heavy ? 'bg-red-500/70' : 'bg-primary/70'}`} style={{ width: `${Math.max(2, (n / maxB) * 100)}%` }} /></div>
                              <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{Math.round((n / total) * 100)}%</span>
                            </div>
                          ); })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{big.toLocaleString()} of {total.toLocaleString()} uploads ({Math.round((big / total) * 100)}%) were ≥100&nbsp;MB.</p>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── ⌘K searches with no result (demand signal) ── */}
            <Section icon={SearchX} title="Searched, no result">
              <p className="-mt-1 mb-2 text-xs text-muted-foreground">What people typed into ⌘K search that matched no tool — a straight demand signal for what to build next.</p>
              <BarList items={(stats.search_misses || []).map((s) => ({ label: <span className="font-mono text-[13px]">{s.q}</span>, value: s.count }))} empty="No empty searches in this range — nobody hit a dead end. 🎉" />
            </Section>

            {/* ── Funnel + Pro ── */}
            <Section icon={Crown} title="Funnel & Pro">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Visitors', value: stats.unique_visitors, sub: rangeLabel === 'all time' ? 'all time' : 'in range' },
                  { label: stats.range ? 'New signups' : 'Registered', value: stats.range ? (stats.signups_range ?? 0) : stats.registered_users, sub: stats.range ? 'in range' : 'total' },
                  { label: 'Pro waitlist', value: stats.pro_waitlist, sub: 'notify-me' },
                  { label: 'Pro subscribers', value: stats.pro_subscribers, sub: 'paid plans' },
                ].map((s, i) => (
                  <div key={i} className="relative rounded-xl border bg-card p-4 shadow-soft">
                    <p className="text-2xl font-bold tracking-tight">{s.value.toLocaleString()}</p>
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Pro active (30d): <b className="text-foreground">{stats.pro_active_30d.toLocaleString()}</b> used a tool while on Pro.</p>
            </Section>

            {/* ── Tool health (unchanged behaviour) ── */}
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
                  {testsMsg && <p className="mt-1 text-xs font-medium text-primary">{testsMsg}</p>}
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-2xl font-bold text-emerald-600">{healthy}</p><p className="text-xs text-muted-foreground">Healthy</p></div>
                    <div className={`rounded-xl border p-4 shadow-soft ${failing ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}><p className={`text-2xl font-bold ${failing ? 'text-amber-600' : ''}`}>{failing}</p><p className="text-xs text-muted-foreground">Failing</p></div>
                    <div className={`rounded-xl border p-4 shadow-soft ${disabled ? 'border-destructive/40 bg-destructive/5' : 'bg-card'}`}><p className={`text-2xl font-bold ${disabled ? 'text-destructive' : ''}`}>{disabled}</p><p className="text-xs text-muted-foreground">Auto-disabled</p></div>
                  </div>
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

            {/* ── Client errors ── */}
            <Section icon={AlertTriangle} title="Client errors" right={errs ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{errs.last_24h} in 24h</span> : undefined}>
              <p className="-mt-1 mb-2 text-xs text-muted-foreground">Real first-party JS errors only — browser-extension &amp; third-party noise is filtered out.</p>
              {!errs || errs.groups.length === 0 ? (
                <p className="rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">No errors reported. 🎉</p>
              ) : (
                <div className="space-y-2">
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
            </Section>

            {/* ── Recent feedback ── */}
            <Section icon={MessageSquare} title="Recent feedback"
              right={stats.feedback_summary ? <span className="text-xs text-muted-foreground">{stats.feedback_summary.total} total · {stats.feedback_summary.last_7d} this week{stats.feedback_summary.avg_rating != null ? ` · ★ ${stats.feedback_summary.avg_rating}` : ''}</span> : undefined}>
              {!stats.feedback_recent || stats.feedback_recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              ) : (
                <div className="space-y-2">
                  {stats.feedback_recent.map((f, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 text-sm shadow-soft">
                      <div className="flex items-center gap-2">
                        {f.category && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{f.category}</span>}
                        {f.rating != null && <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-500"><Star className="size-3 fill-amber-500" />{f.rating}</span>}
                        <span className="ml-auto text-[11px] text-muted-foreground">{f.at}{f.page ? ` · ${f.page}` : ''}</span>
                      </div>
                      <p className="mt-1 break-words text-sm">{f.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <p className="mt-8 text-xs text-muted-foreground">
              Country comes from Cloudflare’s edge (no IP is geo-located or stored for it). Full traffic/source detail also lives in Cloudflare Web Analytics; this page shows tool engagement from your own database.
            </p>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
