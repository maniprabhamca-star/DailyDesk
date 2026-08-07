'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Download, Trash2, KeyRound, HardDrive, Check, TriangleAlert, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportSessionExpired } from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type LedgerItem = { table: string; label: string; href: string | null; count: number };
type Summary = {
  memberSince: string;
  storageUsedBytes: number;
  hasPassword: boolean;
  items: LedgerItem[];
};

function authHeaders(): Record<string, string> {
  let token: string | null = null;
  try { token = localStorage.getItem('dd_token'); } catch { /* private mode */ }
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const bytes = (n: number) => {
  if (!n) return 'nothing stored';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
};

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/* ------------------------------------------------------------ the ledger */

export function AccountData({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/user/data-summary`, { headers: authHeaders() });
      if (res.status === 401) { reportSessionExpired(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not read your account summary.'); return; }
      setSummary(data as Summary);
    } catch {
      setError('Could not reach your account just now.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <section className="rounded-2xl border p-5">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={() => { setError(null); void load(); }} className="mt-2 text-xs font-semibold underline underline-offset-2">
          Try again
        </button>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border p-5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading your account…
        </p>
      </section>
    );
  }

  const held = summary.items.filter((i) => i.count > 0);

  return (
    <>
      {/* ---------------------------------------------------- what we hold */}
      <section className="rounded-2xl border p-5 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What we hold</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Everything on our servers that belongs to you. The rows reading zero are not an oversight —
          files you put through the in-browser tools never reach us, so there is nothing to list.
        </p>

        <dl className="mt-4 divide-y rounded-xl border">
          {summary.items.map((item) => (
            <div key={item.table} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="min-w-0 text-sm">
                {item.href && item.count > 0 ? (
                  <Link href={item.href} className="font-medium hover:underline">{item.label}</Link>
                ) : (
                  <span className={item.count > 0 ? 'font-medium' : 'text-muted-foreground'}>{item.label}</span>
                )}
              </dt>
              <dd className={`shrink-0 text-sm tabular-nums ${item.count > 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                {item.count > 0 ? item.count : 'none'}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="size-4" /> Storage used
            </dt>
            <dd className="shrink-0 text-sm tabular-nums text-muted-foreground">{bytes(summary.storageUsedBytes)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">
          Member since {longDate(summary.memberSince)}.
          {held.length === 0 && ' Nothing of yours is stored on our servers today.'}
        </p>
      </section>

      {/* ------------------------------------------------------- your data */}
      <section className="rounded-2xl border p-5 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your data</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Take a copy whenever you like — one JSON file with every row listed above, ready to read or
          move somewhere else. No request form, no waiting.
        </p>
        <ExportButton />
      </section>

      {/* ------------------------------------------------------ danger zone */}
      <section className="rounded-2xl border border-destructive/35 bg-destructive/[0.035] p-5 sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-destructive">Danger zone</h2>
        <div className="mt-4 space-y-4">
          <PasswordCard hasPassword={summary.hasPassword} />
          <DeleteCard email={email} items={summary.items} onDeleted={onDeleted} />
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------------- export */

function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    try {
      // Fetched rather than linked so the auth header goes with it — a plain
      // <a href> would arrive without a token and 401.
      const res = await fetch(`${API}/api/user/export`, { headers: authHeaders() });
      if (res.status === 401) { reportSessionExpired(); return; }
      if (!res.ok) { setErr('Could not build your export just now.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diemdesk-my-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErr('Could not build your export just now.');
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="outline" className="mt-4" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {busy ? 'Building your file…' : 'Download everything'}
      </Button>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </>
  );
}

/* ------------------------------------------------------------- password */

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/user/password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.status === 401) { reportSessionExpired(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || 'Could not change your password.'); return; }
      setDone(true); setOpen(false); setCurrent(''); setNext('');
    } catch {
      setErr('Could not reach your account just now.');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" /> Password</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasPassword
              ? 'Change the password you sign in with.'
              : 'You sign in with Google. Set a password if you’d like another way in.'}
          </p>
        </div>
        {done ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" /> Saved
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {hasPassword ? 'Change' : 'Set a password'}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {hasPassword && (
            <input
              type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
              placeholder="Current password" aria-label="Current password"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          )}
          <input
            type="password" value={next} onChange={(e) => setNext(e.target.value)}
            placeholder="New password — at least 8 characters" aria-label="New password"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void submit()} disabled={busy || next.length < 8}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save password
            </Button>
            <button onClick={() => { setOpen(false); setErr(null); }} className="text-xs text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- delete */

function DeleteCard({ email, items, onDeleted }: { email: string; items: LedgerItem[]; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const held = items.filter((i) => i.count > 0);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/user/account`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ confirmEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || 'Could not delete your account.'); return; }
      try {
        localStorage.removeItem('dd_token');
        localStorage.removeItem('dd_user');
      } catch { /* ignore */ }
      onDeleted();
    } catch {
      setErr('Could not reach your account just now. Nothing was changed.');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-destructive/35 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold"><Trash2 className="size-4" /> Delete your account</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Removes your account and everything listed above, straight away.
          </p>
        </div>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}
            className="border-destructive/40 text-destructive hover:bg-destructive/10">
            Delete
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-destructive/25 pt-3">
          <p className="flex gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              This deletes{' '}
              {held.length > 0
                ? held.map((i) => `${i.count} ${i.label.toLowerCase()}`).join(', ')
                : 'your account'}
              {' '}and cannot be undone. We keep no copy, so we cannot get it back for you.
              {held.length > 0 && ' Download your data first if you might want it.'}
            </span>
          </p>
          <input
            value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={`Type ${email} to confirm`} aria-label="Confirm your email address"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password" aria-label="Your password"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm" onClick={() => void submit()}
              disabled={busy || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete my account for good
            </Button>
            <button onClick={() => { setOpen(false); setErr(null); }} className="text-xs text-muted-foreground hover:underline">
              Keep my account
            </button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------- synced tools shortcut */

export function SyncedTools() {
  const tools = [
    { href: '/notes', name: 'Smart Notes', blurb: 'Quick notes, synced to your account' },
    { href: '/habits', name: 'Habit Tracker', blurb: 'Streaks and daily check-ins' },
    { href: '/budget', name: 'Budget Tracker', blurb: 'Where the money goes' },
    { href: '/file-vault', name: 'File Vault', blurb: 'End-to-end encrypted storage' },
  ];
  return (
    <section className="rounded-2xl border p-5 sm:p-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Signed in, so these follow you</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.href} href={t.href}
            className="group flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.blurb}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
