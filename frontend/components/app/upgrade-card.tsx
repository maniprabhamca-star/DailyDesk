'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, X } from 'lucide-react';
import { usePlan } from '@/lib/plan';
import { PRICING } from '@/lib/pricing';
import { PRO_UPSELL_ENABLED } from '@/lib/flags';

// Small, calm, dismissible bottom-right nudge on tool pages — NOT a modal, it
// never blocks the tool. Shows only when the Pro upsell is live, the visitor is
// on the free plan, and they haven't dismissed it this session. Appears after a
// short delay so it doesn't pounce the moment the page loads.
const DISMISS_KEY = 'dd_upsell_card_dismissed';

export function UpgradeCard() {
  const plan = usePlan();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!PRO_UPSELL_ENABLED || plan !== 'free') return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY)) return;
    const t = setTimeout(() => setShow(true), 6000);
    return () => clearTimeout(t);
  }, [plan]);

  if (!PRO_UPSELL_ENABLED || plan !== 'free' || !show) return null;

  const dismiss = () => {
    setShow(false);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-amber-400/50 bg-card p-3.5 shadow-lift">
      <div className="flex items-center gap-2">
        <span className="text-amber-500"><Crown className="size-[18px]" /></span>
        <p className="text-[13px] font-semibold">Bigger files with Pro</p>
        <button onClick={dismiss} aria-label="Dismiss" className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Unlimited size, batch, and priority — from ${PRICING.pro.monthly}/mo.
      </p>
      <Link
        href="/pricing"
        onClick={dismiss}
        className="mt-2.5 block rounded-lg bg-primary py-2 text-center text-[13px] font-semibold text-primary-foreground hover:opacity-90"
      >
        Upgrade
      </Link>
    </div>
  );
}
