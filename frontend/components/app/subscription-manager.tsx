'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CreditCard, Loader2, RotateCcw, ShieldCheck, TriangleAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// Every paid subscription on the account, with a cancellation flow that is
// honest about two separate things:
//   • You can cancel whenever you like. We don't hide the button, and we don't
//     make you email anybody.
//   • A refund is only available inside the published window. The server checks
//     that against Stripe's own start date; this UI only reports what it says.
// It lists whatever subscriptions exist, so the Statements tier appears here
// automatically the day it ships.

type Refund = {
  eligible: boolean;
  daysSinceStart: number | null;
  daysLeft?: number;
  deadline: string | null;
  startedAt?: string;
  windowDays: number;
};

type Subscription = {
  id: string;
  status: string;
  name: string;
  interval: 'month' | 'year' | null;
  intervalLabel: string;
  price: { amount: number; currency: string; display: string } | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  refund: Refund;
};

const REASONS: { id: string; label: string }[] = [
  { id: 'too_expensive', label: 'It costs more than it’s worth to me' },
  { id: 'not_using', label: 'I’m not using it enough' },
  { id: 'missing_feature', label: 'It’s missing something I need' },
  { id: 'found_alternative', label: 'I found something better' },
  { id: 'temporary', label: 'Just pausing — I may be back' },
  { id: 'technical', label: 'Something didn’t work properly' },
  { id: 'other', label: 'Something else' },
];

const authHeaders = (): HeadersInit => {
  let token: string | null = null;
  try { token = localStorage.getItem('dd_token'); } catch { /* private mode */ }
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export function SubscriptionManager({ onChanged }: { onChanged?: () => void }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Subscription | null>(null);
  const [done, setDone] = useState<{ immediate: boolean; endsAt: string | null; refunded: boolean; refundAmount: string | null; refundCurrency: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/stripe/subscription`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A 401 is a lapsed session, not a billing problem — say the useful thing.
        setError(res.status === 401
          ? 'Your session has expired. Sign in again to manage your subscription.'
          : (data.error || 'Could not read your subscription.'));
        return;
      }
      setConfigured(data.configured !== false);
      setSubs(data.subscriptions || []);
    } catch {
      setError('Could not reach billing just now.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function resume(sub: Subscription) {
    setError(null);
    const res = await fetch(`${API}/api/stripe/resume`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ subscriptionId: sub.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Could not restart it.'); return; }
    await load();
    onChanged?.();
  }

  if (!configured) return null;

  // An error must win over the spinner, whatever else is true. It used to be
  // checked AFTER the loading guard, so any failure left `subs` null and the
  // thing span forever — which is exactly what a real user saw on /account with
  // a lapsed token. Order matters here; do not move this below.
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/[0.06] p-4">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <button onClick={() => { setError(null); void load(); }} className="mt-2 text-xs font-semibold underline underline-offset-2">
          Try again
        </button>
      </div>
    );
  }

  if (subs === null) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking your subscription…</p>;
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.07] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><Check className="size-4 text-emerald-600 dark:text-emerald-400" /> Cancelled</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {done.immediate
            ? <>Your subscription ended just now{done.refunded && done.refundAmount ? <>, and we’ve refunded <b className="text-foreground">{done.refundCurrency} {done.refundAmount}</b> to your card. Banks usually take five to ten days to show it.</> : '.'}</>
            : <>You keep everything you’ve paid for until <b className="text-foreground">{longDate(done.endsAt)}</b>, and you won’t be charged again. Nothing else to do.</>}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Thank you for the feedback — it’s read, not filed.</p>
      </div>
    );
  }

  if (!subs.length) {
    return <p className="text-sm text-muted-foreground">No paid subscription on this account.</p>;
  }

  return (
    <div className="space-y-3">
      {subs.map((sub) => (
        <div key={sub.id} className="rounded-xl border bg-background p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {sub.name}
                <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{sub.intervalLabel}</span>
                {sub.status === 'past_due' && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">Payment failed</span>
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {sub.price && <>{sub.price.currency} {sub.price.display} / {sub.interval === 'year' ? 'year' : 'month'} ·</>}
                <CalendarClock className="size-3.5" />
                {sub.cancelAtPeriodEnd
                  ? <>Ends <b className="text-foreground">{longDate(sub.currentPeriodEnd)}</b> — no further charges</>
                  : <>Renews <b className="text-foreground">{longDate(sub.currentPeriodEnd)}</b></>}
              </p>
            </div>

            {sub.cancelAtPeriodEnd ? (
              <Button variant="outline" size="sm" onClick={() => void resume(sub)}>
                <RotateCcw className="mr-1.5 size-3.5" /> Keep my subscription
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setCancelling(sub)}>Cancel</Button>
            )}
          </div>

          {/* The refund window, stated as a date rather than a rule to work out. */}
          {!sub.cancelAtPeriodEnd && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {sub.refund.eligible
                ? <>You’re inside the {sub.refund.windowDays}-day refund window until <b className="text-foreground">{longDate(sub.refund.deadline)}</b> — cancel before then and you can have your money back.</>
                : <>The {sub.refund.windowDays}-day refund window closed on {longDate(sub.refund.deadline)}. You can still cancel any time; you keep access until the period ends.</>}
            </p>
          )}
        </div>
      ))}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {cancelling && (
        <CancelDialog
          sub={cancelling}
          onClose={() => setCancelling(null)}
          onDone={(result) => { setCancelling(null); setDone(result); void load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function CancelDialog({
  sub, onClose, onDone,
}: {
  sub: Subscription;
  onClose: () => void;
  onDone: (r: { immediate: boolean; endsAt: string | null; refunded: boolean; refundAmount: string | null; refundCurrency: string | null }) => void;
}) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [requestRefund, setRequestRefund] = useState(sub.refund.eligible);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/stripe/cancel`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subscriptionId: sub.id, reason: reason || 'other', comment, requestRefund }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not cancel just now — nothing has changed.'); return; }
      // Asked for a refund and didn't get one? Say why, here, rather than
      // letting them discover it from a bank statement.
      if (requestRefund && !data.refunded) {
        setError(data.refundDeclinedReason === 'guarantee_already_used'
          ? 'Your subscription is cancelled, but the money-back guarantee is one-time and has already been used on this account — so no refund was issued. Email support@diemdesk.com if you think that’s wrong.'
          : 'Your subscription is cancelled, but the refund window has closed, so no refund was issued.');
        setBusy(false);
        return;
      }
      onDone({
        immediate: !!data.immediate,
        endsAt: data.endsAt || null,
        refunded: !!data.refunded,
        refundAmount: data.refundAmount || null,
        refundCurrency: data.refundCurrency || null,
      });
    } catch {
      setError('Could not reach billing — nothing has changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Cancel subscription" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl border bg-card p-5 shadow-lift sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Cancel {sub.name}?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sub.refund.eligible
            ? <>You’re still inside the {sub.refund.windowDays}-day refund window (until {longDate(sub.refund.deadline)}), so you can take your money back with you.</>
            : <>You’ll keep everything you’ve paid for until <b className="text-foreground">{longDate(sub.currentPeriodEnd)}</b>, and you won’t be charged again.</>}
        </p>

        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why are you leaving?</legend>
          <p className="mb-2 mt-1 text-[11px] text-muted-foreground">Optional — but it’s the only way we find out what to fix.</p>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label key={r.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${reason === r.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}>
                <input type="radio" name="cancel-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="size-4 accent-primary" />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anything else?</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
            placeholder="What would have kept you? We read every one of these."
            className="w-full resize-y rounded-lg border bg-background p-2.5 text-sm outline-none focus:border-primary" />
        </label>

        {sub.refund.eligible && (
          <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] p-3 text-sm">
            <input type="checkbox" checked={requestRefund} onChange={(e) => setRequestRefund(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
            <span>
              <b>Refund my last payment{sub.price ? ` (${sub.price.currency} ${sub.price.display})` : ''}.</b>
              <span className="block text-xs text-muted-foreground">Access ends immediately and the money goes back to your card — usually five to ten days to appear. Leave this unticked to keep using it until {longDate(sub.currentPeriodEnd)}.</span>
            </span>
          </label>
        )}

        {!sub.refund.eligible && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-snug">
            <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>The {sub.refund.windowDays}-day refund window closed on {longDate(sub.refund.deadline)}, so this cancellation doesn’t come with a refund. If something went wrong, email <a href="mailto:support@diemdesk.com" className="font-semibold text-primary hover:underline">support@diemdesk.com</a> — we’d rather hear about it.</span>
          </p>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Keep my subscription</Button>
          <Button onClick={() => void submit()} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? <><Loader2 className="mr-1.5 size-4 animate-spin" /> Cancelling…</> : requestRefund && sub.refund.eligible ? 'Cancel and refund' : 'Confirm cancellation'}
          </Button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CreditCard className="size-3" /> Card details and invoices live in the billing portal — this only ends the subscription.
        </p>
      </div>
    </div>
  );
}
