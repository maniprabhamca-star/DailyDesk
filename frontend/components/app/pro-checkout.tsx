'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, Clock, Bell, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { usePlan, isAtLeast, isExactly } from '@/lib/plan';
import { api } from '@/lib/api';
import { BILLING_ENABLED, WAITLIST_MODE } from '@/lib/flags';

const LABEL: Record<'pro' | 'business', string> = { pro: 'Pro', business: 'Business' };

// The paid CTA. Adapts to state: logged-out → register; below this tier and
// logged-in → start Stripe Checkout; already on this tier or above → confirm.
// On returning from Checkout (?upgraded=1) it refreshes the plan so the new
// tier takes effect without a re-login.
//
// `sells` is which tier this particular button is for. It has to be explicit:
// the pricing page shows two paid cards at once, and a button that always sold
// Pro would charge $5.98 to somebody who clicked Business — a quiet, expensive
// bug with no error anywhere. The value is sent to the server, which re-derives
// the price from its own table; this prop picks a product, not a price.
export function ProCheckout({
  className = '',
  size,
  interval = 'month',
  sells = 'pro',
  variant,
}: {
  className?: string;
  size?: 'sm' | 'lg' | 'icon';
  interval?: 'month' | 'year';
  sells?: 'pro' | 'business';
  variant?: 'primary' | 'outline' | 'secondary' | 'ghost';
}) {
  const { user, loading, refreshUser } = useAuth();
  const plan = usePlan();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const name = LABEL[sells];

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // Says the tier they actually landed on, read back from the server after
    // the refresh — not the tier this button happens to sell. Two paid cards
    // share the page, and both of them see ?upgraded=1 on the way back.
    if (p.get('upgraded') === '1') {
      void refreshUser().then(() => setMsg('upgraded'));
    } else if (p.get('canceled') === '1') {
      setMsg('Checkout canceled — no charge was made.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upgrade() {
    setBusy(true); setMsg(null);
    try {
      const res = await api.post('/api/stripe/create-checkout-session', { interval, plan: sells });
      if (res?.url) { window.location.href = res.url as string; return; }
      setMsg('Could not start checkout. Please try again.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not start checkout.');
    }
    setBusy(false);
  }

  // Free-first launch: collect a launch waitlist instead of charging. The full
  // form lives on the pricing Pro card; everywhere else links to it.
  if (WAITLIST_MODE) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href="/pricing#pro-waitlist"><Bell className="size-4" /> Notify me at launch</Link>
      </Button>
    );
  }

  // Free-launch period: billing is off — show the paid tiers as "coming soon".
  if (!BILLING_ENABLED) {
    return (
      <Button size={size} className={className} variant="secondary" disabled>
        <Clock className="size-4" /> {name} — coming soon
      </Button>
    );
  }

  let btn;
  if (loading) {
    btn = <Button size={size} variant={variant} className={className} disabled><Loader2 className="size-4 animate-spin" /></Button>;
  } else if (isAtLeast(plan, sells)) {
    // Already on this tier or above it. Compared by ORDER, not by name: a
    // Business subscriber looking at the Pro card has nothing to buy there
    // either, and offering them Pro would be offering a downgrade at a price.
    btn = <Button size={size} variant={variant} className={className} disabled><Check className="size-4" /> You’re on {LABEL[plan as 'pro' | 'business'] ?? name}</Button>;
  } else if (!user) {
    btn = <Button asChild size={size} variant={variant} className={className}><Link href="/register">Get {name}</Link></Button>;
  } else if (isExactly(plan, 'pro') && sells === 'business') {
    // A Pro subscriber moving up is a Stripe plan change with proration, not a
    // second subscription — selling it from this button would recreate the exact
    // two-subscription problem the Business tier exists to remove. The server
    // refuses this combination for the same reason, so the button must not
    // pretend otherwise. Until B6 ships, it is a conversation.
    // See docs/designs/business-tier-pricing.html §B6.
    btn = (
      <Button asChild size={size} variant={variant} className={className}>
        <a href="mailto:support@diemdesk.com?subject=Move%20me%20to%20Business">
          <Mail className="size-4" /> Email us to move up
        </a>
      </Button>
    );
  } else {
    btn = (
      <Button size={size} variant={variant} className={className} onClick={upgrade} disabled={busy}>
        {busy ? <><Loader2 className="size-4 animate-spin" /> Starting…</> : `Get ${name}`}
      </Button>
    );
  }

  return (
    <>
      {btn}
      {msg === 'upgraded' ? (
        <p className="mt-2 text-center text-xs font-medium text-emerald-600">
          🎉 You’re on {LABEL[plan as 'pro' | 'business'] ?? name} — thank you!
        </p>
      ) : msg ? (
        <p className="mt-2 text-center text-xs font-medium text-emerald-600">{msg}</p>
      ) : null}
    </>
  );
}
