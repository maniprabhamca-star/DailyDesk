'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [checked, setChecked] = useState(false); // has the URL been read yet?
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Token comes in the URL (?token=…). Read it client-side to avoid a Suspense
  // boundary for useSearchParams during static generation.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
    setChecked(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      {done ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Done — your password has been reset. You can sign in with it now.</p>
          <Button asChild size="lg" className="mt-6 w-full"><Link href="/login">Log in</Link></Button>
        </>
      ) : checked && !token ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">This reset link is missing or broken. Please request a new one.</p>
          <Link href="/forgot" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Request a new link</Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Pick a new password for your account.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={busy || !token}>
              {busy ? 'Saving…' : 'Reset password'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">Back to log in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
