'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/plan';
import { api } from '@/lib/api';

// The "Go Pro" CTA. Adapts to state: logged-out → register; free + logged-in →
// start Stripe Checkout; already Pro → confirm. On returning from Checkout
// (?upgraded=1) it refreshes the plan so Pro takes effect without a re-login.
export function ProCheckout({ className = '', size, interval = 'month' }: { className?: string; size?: 'sm' | 'lg' | 'icon'; interval?: 'month' | 'year' }) {
  const { user, loading, refreshUser } = useAuth();
  const plan = usePlan();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('upgraded') === '1') void refreshUser().then(() => setMsg('🎉 You’re on Pro — thank you!'));
    else if (p.get('canceled') === '1') setMsg('Checkout canceled — no charge was made.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upgrade() {
    setBusy(true); setMsg(null);
    try {
      const res = await api.post('/api/stripe/create-checkout-session', { interval });
      if (res?.url) { window.location.href = res.url as string; return; }
      setMsg('Could not start checkout. Please try again.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not start checkout.');
    }
    setBusy(false);
  }

  let btn;
  if (loading) {
    btn = <Button size={size} className={className} disabled><Loader2 className="size-4 animate-spin" /></Button>;
  } else if (plan === 'pro') {
    btn = <Button size={size} className={className} disabled><Check className="size-4" /> You’re on Pro</Button>;
  } else if (!user) {
    btn = <Button asChild size={size} className={className}><Link href="/register">Go Pro</Link></Button>;
  } else {
    btn = (
      <Button size={size} className={className} onClick={upgrade} disabled={busy}>
        {busy ? <><Loader2 className="size-4 animate-spin" /> Starting…</> : 'Go Pro'}
      </Button>
    );
  }

  return <>{btn}{msg && <p className="mt-2 text-center text-xs font-medium text-emerald-600">{msg}</p>}</>;
}
