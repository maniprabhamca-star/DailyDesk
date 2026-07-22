'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Wallet, LogIn, Cloud, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getMonth, addExpense, deleteExpense, budgetSignedIn, BudgetApiError, CATEGORIES, type BudgetMonth,
} from '@/lib/budget-api';

const CAT_COLOR: Record<string, string> = {
  Food: '#f97316', Transport: '#0ea5e9', Bills: '#dc2626', Shopping: '#a855f7',
  Health: '#10b981', Fun: '#ec4899', Home: '#f59e0b', Other: '#64748b',
};
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shift = (m: string, by: number) => { const d = new Date(m + '-01T00:00:00'); d.setMonth(d.getMonth() + by); return d.toISOString().slice(0, 7); };

export function BudgetTool() {
  const [phase, setPhase] = useState<'loading' | 'signin' | 'ready'>('loading');
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<BudgetMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capHit, setCapHit] = useState(false);
  const [currency, setCurrency] = useState('₹');
  // add form
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [desc, setDesc] = useState('');

  const load = useCallback(async (m: string) => {
    setLoading(true); setError(null);
    try { setData(await getMonth(m)); }
    catch (e) { setError(e instanceof BudgetApiError ? e.message : 'Could not load your budget.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!budgetSignedIn()) { setPhase('signin'); return; }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('dd_budget_ccy') : null;
    if (saved) setCurrency(saved);
    getMonth(thisMonth()).then((d) => { setData(d); setPhase('ready'); })
      .catch((e) => { setError(e instanceof BudgetApiError ? e.message : null); setPhase('signin'); });
  }, []);

  useEffect(() => { if (phase === 'ready') void load(month); }, [month, phase, load]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('dd_budget_ccy', currency); }, [currency]);

  const add = useCallback(async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    setError(null); setCapHit(false);
    try {
      const date = month === thisMonth() ? new Date().toISOString().slice(0, 10) : `${month}-15`;
      await addExpense({ amount: amt, category, description: desc.trim(), merchant: '', date });
      setAmount(''); setDesc('');
      await load(month);
    } catch (e) {
      if (e instanceof BudgetApiError && e.code === 'expense-cap') { setCapHit(true); return; }
      setError(e instanceof BudgetApiError ? e.message : 'Could not add the expense.');
    }
  }, [amount, category, desc, month, load]);

  const remove = useCallback(async (id: string) => {
    try { await deleteExpense(id); await load(month); setCapHit(false); }
    catch { setError('Could not delete — please try again.'); }
  }, [month, load]);

  const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cats = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (phase === 'loading') return <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (phase === 'signin') {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400"><Wallet className="size-7" /></span>
        <h2 className="mt-4 text-lg font-bold">See where your money goes</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Log expenses in seconds and watch your monthly total by category — synced to your account. Sign in to start.</p>
        {error && <p className="mx-auto mt-3 max-w-sm text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <Button asChild className="mt-5"><Link href="/login"><LogIn className="mr-1.5 size-4" /> Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* left: add + list */}
      <div className="space-y-4">
        {/* add form */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-center gap-1">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border bg-background py-2 pl-2 pr-1 text-sm outline-none" aria-label="Currency">
                {['₹', '$', '€', '£', '¥'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00"
                onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
                className="w-24 rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus:border-teal-500">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} placeholder="What for? (optional)"
              onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
              className="min-w-[120px] flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-teal-500" />
            <Button onClick={() => void add()} className="bg-teal-600 text-white hover:bg-teal-700"><Plus className="mr-1 size-4" /> Add</Button>
          </div>
        </div>

        {capHit && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            <Sparkles className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>You’ve logged {data?.cap} expenses this month on the free plan. <Link href="/pricing" className="font-semibold underline">Upgrade to Pro</Link> for unlimited.</span>
          </div>
        )}
        {error && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{error} <button onClick={() => setError(null)}><X className="ml-1 inline size-3" /></button></div>}

        {/* list */}
        <div className="rounded-2xl border bg-card">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : !data || data.expenses.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No expenses logged for {monthLabel(month)} yet.</p>
          ) : (
            <ul className="divide-y">
              {data.expenses.map((e) => (
                <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CAT_COLOR[e.category] || CAT_COLOR.Other }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.description || e.category}</p>
                    <p className="text-[11px] text-muted-foreground">{e.category} · {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{fmt(e.amount)}</span>
                  <button onClick={() => void remove(e.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete"><Trash2 className="size-3.5 text-muted-foreground hover:text-red-600" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* right: month nav + total + breakdown */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-2">
          <button onClick={() => setMonth(shift(month, -1))} className="rounded p-1.5 hover:bg-muted" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
          <b className="text-sm">{monthLabel(month)}</b>
          <button onClick={() => setMonth(shift(month, 1))} disabled={month >= thisMonth()} className="rounded p-1.5 hover:bg-muted disabled:opacity-30" aria-label="Next month"><ChevronRight className="size-4" /></button>
        </div>

        <div className="rounded-2xl border bg-gradient-to-br from-teal-500/10 to-transparent p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total spent</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{fmt(data?.total ?? 0)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{data?.count ?? 0} expense{(data?.count ?? 0) === 1 ? '' : 's'}</p>
        </div>

        {cats.length > 0 && (
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">By category</p>
            <div className="space-y-2.5">
              {cats.map(([cat, amt]) => {
                const pct = data && data.total > 0 ? (amt / data.total) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{cat}</span>
                      <span className="tabular-nums text-muted-foreground">{fmt(amt)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CAT_COLOR[cat] || CAT_COLOR.Other }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data?.cap != null && <p className="text-center text-[11px] text-muted-foreground">{data.count} / {data.cap} this month · <Link href="/pricing" className="font-semibold text-teal-600 hover:underline dark:text-teal-400">Pro = unlimited</Link></p>}

        <div className="flex items-start gap-2.5 rounded-xl border border-teal-500/40 bg-teal-500/10 p-3 text-[12px] leading-relaxed text-foreground">
          <Cloud className="mt-0.5 size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
          <p><b>Synced to your account</b> — your budget is on every device you sign in on.</p>
        </div>
      </div>
    </div>
  );
}
