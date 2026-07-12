'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            If <span className="font-medium text-foreground">{email}</span> is registered, a reset link is on its way — it works for 1 hour. Check your inbox (and spam, just in case).
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">← Back to log in</Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Enter your email and we’ll send you a link to set a new one.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
