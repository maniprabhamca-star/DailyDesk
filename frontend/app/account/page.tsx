'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, ShieldCheck, LogOut, Mail, CreditCard } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { ProCheckout } from '@/components/app/pro-checkout';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/plan';
import { SubscriptionManager } from '@/components/app/subscription-manager';
import { AccountData, SyncedTools } from '@/components/app/account-data';

export default function AccountPage() {
  const { user, loading, expired, logout, refreshUser } = useAuth();
  const plan = usePlan();
  const router = useRouter();
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalErr, setPortalErr] = useState<string | null>(null);
  // Pro can be real without a Stripe subscription (owner + comped accounts), so
  // the badge must not claim “Active” beside a panel saying there is nothing to
  // bill. Null until the subscription panel has actually reported.
  const [subCount, setSubCount] = useState<number | null>(null);

  // Re-check the plan with the server on load, so an upgrade that happened
  // elsewhere (or a webhook that just landed) is reflected here without re-login.
  useEffect(() => { void refreshUser(); }, [refreshUser]);

  // Not logged in → send to login. But a deliberate sign-out is already heading to
  // /logged-out, and this guard used to race it there — which is exactly why
  // logging out silently dumped people on the login screen.
  useEffect(() => {
    if (loading || user) return;
    let signedOut = false;
    try { signedOut = sessionStorage.getItem('dd_signed_out') === '1'; } catch { /* ignore */ }
    // An expired session gets told what happened below, rather than being
    // bounced to a bare login form with no explanation.
    if (!signedOut && !expired) router.replace('/login');
  }, [loading, user, expired, router]);

  // Sessions last 7 days. When one lapses you used to be left on a page that
  // still showed your name and your PRO badge while every control on it failed
  // against a dead token — including a subscription panel that span forever.
  if (expired && !user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Your session has expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You’ve been signed out for security after a period away. Sign in again and you’ll come
            straight back here — nothing has changed on your account.
          </p>
          <Button className="mt-6" onClick={() => router.replace('/login?next=/account')}>Sign in again</Button>
        </main>
      </>
    );
  }

  if (loading || !user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">Loading…</main>
      </>
    );
  }

  const isPro = plan === 'pro';
  const initial = user.name?.trim()?.[0]?.toUpperCase() || 'U';

  async function openPortal() {
    setPortalBusy(true); setPortalErr(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
      const res = await fetch(`${API}/api/stripe/portal`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setPortalErr(data.error || 'Could not open billing — please try again, or email support@diemdesk.com.');
    } catch {
      setPortalErr('Could not open billing — please try again, or email support@diemdesk.com.');
    } finally { setPortalBusy(false); }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your DiemDesk profile and plan.</p>

        {/* Profile */}
        <section className="mt-6 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-4">
            <span className="relative flex size-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {initial}
              {isPro && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card bg-amber-400 px-1 text-[9px] font-bold uppercase leading-tight text-amber-950">
                  Pro
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5" /> {user.email}
              </p>
            </div>
          </div>
        </section>

        {/* Plan */}
        <section className="mt-4 rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current plan</p>
              <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
                {isPro ? <><Crown className="size-5 text-amber-500" /> Pro</> : 'Free'}
              </p>
            </div>
            {isPro ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                <ShieldCheck className="size-4" /> {subCount === 0 ? 'Included' : 'Active'}
              </span>
            ) : (
              <ProCheckout size="lg" />
            )}
          </div>

          {isPro ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">You have unlimited file sizes, batch processing, and every Pro tool.</p>

              {/* Every paid subscription on the account — Pro, and the Statements
                  tier when it lands — each with its own renewal date, refund
                  window and cancel button. */}
              <SubscriptionManager onChanged={() => void refreshUser()} onCount={setSubCount} />

              <div className="border-t pt-3">
                <Button variant="outline" onClick={openPortal} disabled={portalBusy}>
                  <CreditCard className="size-4" /> {portalBusy ? 'Opening…' : 'Card & invoices'}
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">Update your card or download invoices — handled securely by Stripe.</p>
                {portalErr && <p className="text-xs text-destructive">{portalErr}</p>}
              </div>
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted-foreground">Upgrade to unlock:</p>
              <ul className="mt-2 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
                {['Unlimited file size', 'Batch processing — many files at once', 'Unlimited Office conversions + OCR', 'More AI actions (coming soon)'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Crown className="size-4 shrink-0 text-amber-500" /> {f}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="mt-4 space-y-4">
          <SyncedTools />
          {/* The ledger, the export and the danger zone. These are the reason
              the page exists for a product whose pitch is "we don't have your
              files" — see docs/designs/account-page.md. */}
          <AccountData email={user.email} onDeleted={() => router.replace('/account-deleted')} />
        </div>

        <div className="mt-6">
          <Button variant="outline" onClick={logout}><LogOut className="size-4" /> Log out</Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
