'use client';

import { useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/currency';

// Pro launch waitlist form (free-first phase). Captures email + an optional
// "most-wanted feature" vote, then posts to /api/waitlist which stores it and
// sends a branded confirmation. Founding-member hook drives sign-ups now.
const FEATURES = [
  { id: 'batch', label: 'Batch' },
  { id: 'vault', label: 'File Vault' },
  { id: 'ai', label: 'AI assistants' },
  { id: 'ocr', label: 'OCR' },
];

export function ProWaitlist({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const foundingRate = useCurrency() === 'INR' ? '₹417/mo' : '$4.99/mo';
  const [email, setEmail] = useState(user?.email || '');
  const [feature, setFeature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/waitlist', { email: email.trim(), feature });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div id="pro-waitlist" className={`rounded-xl border border-primary/30 bg-primary/[0.06] p-4 text-center ${className}`}>
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-5" /></span>
        <p className="mt-2 text-sm font-semibold">You’re on the list</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">We’ll email you the day Pro opens — your founding rate of {foundingRate} for life is saved.</p>
      </div>
    );
  }

  return (
    <form id="pro-waitlist" onSubmit={join} className={`scroll-mt-24 ${className}`}>
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
      <p className="mb-1.5 mt-3 text-xs font-medium text-muted-foreground">Which Pro feature do you want most? <span className="font-normal">(optional)</span></p>
      <div className="flex flex-wrap gap-1.5">
        {FEATURES.map((f) => (
          <button type="button" key={f.id} onClick={() => setFeature(feature === f.id ? null : f.id)} aria-pressed={feature === f.id}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${feature === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
        {busy ? <><Loader2 className="size-4 animate-spin" /> Joining…</> : <><Bell className="size-4" /> Notify me at launch</>}
      </Button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Founding members lock in {foundingRate} for life.</p>
    </form>
  );
}
