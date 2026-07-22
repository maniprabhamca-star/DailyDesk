'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Flame, LogIn, Check, Cloud, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listHabits, createHabit, toggleHabit, deleteHabit, habitsSignedIn, HabitsApiError, type Habit,
} from '@/lib/habits-api';

const COLORS = ['#6366f1', '#0d9488', '#dc2626', '#d97706', '#7c3aed', '#db2777', '#16a34a', '#0284c7'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
// last 21 days, oldest → newest (fits the row without crowding phones)
const RANGE = Array.from({ length: 21 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (20 - i)); return d; });

export function HabitsTool() {
  const [phase, setPhase] = useState<'loading' | 'signin' | 'ready'>('loading');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [cap, setCap] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capHit, setCapHit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!habitsSignedIn()) { setPhase('signin'); return; }
    let alive = true;
    listHabits().then((r) => { if (alive) { setHabits(r.habits); setCap(r.cap); setPhase('ready'); } })
      .catch((e) => { if (alive) { setError(e instanceof HabitsApiError ? e.message : 'Could not load your habits.'); setPhase('signin'); } });
    return () => { alive = false; };
  }, []);

  const atCap = cap != null && habits.length >= cap;

  const add = useCallback(async () => {
    const n = name.trim();
    if (!n) return;
    if (atCap) { setCapHit(true); return; }
    setError(null);
    try {
      const { habit } = await createHabit(n, color);
      setHabits((h) => [...h, habit]); setName(''); setAdding(false);
    } catch (e) {
      if (e instanceof HabitsApiError && e.code === 'habit-cap') { setCapHit(true); return; }
      setError(e instanceof HabitsApiError ? e.message : 'Could not add the habit.');
    }
  }, [name, color, atCap]);

  // Optimistic toggle of a given day; recompute doneToday + streak locally.
  const toggle = useCallback(async (h: Habit, date: string) => {
    const has = h.days.includes(date);
    const days = has ? h.days.filter((d) => d !== date) : [...h.days, date];
    setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, days, ...recompute(days) } : x)));
    try { await toggleHabit(h.id, date); }
    catch { // revert on failure
      setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, days: h.days, ...recompute(h.days) } : x)));
      setError('Could not save — check your connection.');
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm('Delete this habit and its history?')) return;
    try { await deleteHabit(id); setHabits((h) => h.filter((x) => x.id !== id)); setCapHit(false); }
    catch { setError('Could not delete — please try again.'); }
  }, []);

  if (phase === 'loading') return <div className="flex h-72 items-center justify-center rounded-2xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (phase === 'signin') {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400"><Flame className="size-7" /></span>
        <h2 className="mt-4 text-lg font-bold">Build streaks that stick</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Track your daily habits and watch the streaks grow — synced to your account, on every device. Sign in to start.</p>
        {error && <p className="mx-auto mt-3 max-w-sm text-sm text-amber-700 dark:text-amber-400">{error}</p>}
        <Button asChild className="mt-5"><Link href="/login"><LogIn className="mr-1.5 size-4" /> Sign in</Link></Button>
      </div>
    );
  }

  const todayIso = iso(new Date());
  return (
    <div>
      {capHit && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
          <Sparkles className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>You’re tracking {cap} habits on the free plan. <Link href="/pricing" className="font-semibold underline">Upgrade to Pro</Link> for unlimited.</span>
        </div>
      )}
      {error && <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{error} <button onClick={() => setError(null)}><X className="ml-1 inline size-3" /></button></div>}

      <div className="space-y-3">
        {habits.length === 0 && !adding && (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <Flame className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No habits yet. Add your first below.</p>
          </div>
        )}
        {habits.map((h) => (
          <div key={h.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: h.color }} />
              <b className="text-sm">{h.name}</b>
              {h.streak > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400"><Flame className="size-3" /> {h.streak}</span>}
              <button
                onClick={() => void toggle(h, todayIso)}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${h.doneToday ? 'text-white' : 'border text-muted-foreground hover:text-foreground'}`}
                style={h.doneToday ? { backgroundColor: h.color } : undefined}>
                <Check className="size-3.5" /> {h.doneToday ? 'Done today' : 'Mark today'}
              </button>
              <button onClick={() => void remove(h.id)} className="rounded p-1.5 text-muted-foreground hover:text-red-600" aria-label="Delete habit"><Trash2 className="size-4" /></button>
            </div>
            {/* 21-day grid */}
            <div className="mt-3 flex gap-[3px] overflow-x-auto">
              {RANGE.map((d) => {
                const key = iso(d); const done = h.days.includes(key); const isToday = key === todayIso;
                return (
                  <button key={key} onClick={() => void toggle(h, key)} title={key}
                    className={`size-5 shrink-0 rounded-[4px] border transition ${isToday ? 'ring-1 ring-offset-1 ring-foreground/30' : ''}`}
                    style={{ backgroundColor: done ? h.color : 'transparent', borderColor: done ? h.color : 'hsl(var(--border))' }} />
                );
              })}
            </div>
          </div>
        ))}

        {adding ? (
          <div className="rounded-2xl border bg-card p-4">
            <input value={name} autoFocus onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Habit name (e.g. Read 20 min)"
              onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`size-6 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
              ))}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
                <Button size="sm" onClick={() => void add()} className="bg-orange-600 text-white hover:bg-orange-700"><Check className="mr-1 size-3.5" /> Add habit</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)} className="w-full"><Plus className="mr-1.5 size-4" /> New habit</Button>
        )}
      </div>

      {cap != null && <p className="mt-3 text-center text-[11px] text-muted-foreground">{habits.length} / {cap} habits · <Link href="/pricing" className="font-semibold text-orange-600 hover:underline dark:text-orange-400">Pro = unlimited</Link></p>}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3.5 text-[13px] leading-relaxed text-foreground">
        <Cloud className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" />
        <p><b>Synced to your account.</b> Your habits and streaks are saved to your DiemDesk account, so they’re there on every device you sign in on.</p>
      </div>
    </div>
  );
}

// Local streak recompute after an optimistic toggle (mirrors the server logic).
function recompute(days: string[]): { doneToday: boolean; streak: number } {
  const set = new Set(days);
  const isoOf = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const doneToday = set.has(isoOf(today));
  let streak = 0; const d = new Date(today);
  if (!set.has(isoOf(d))) d.setDate(d.getDate() - 1);
  while (set.has(isoOf(d))) { streak++; d.setDate(d.getDate() - 1); }
  return { doneToday, streak };
}
