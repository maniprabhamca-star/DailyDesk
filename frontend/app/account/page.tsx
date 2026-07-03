'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, ShieldCheck, LogOut, Mail } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { ProCheckout } from '@/components/app/pro-checkout';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/plan';

export default function AccountPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const plan = usePlan();
  const router = useRouter();

  // Re-check the plan with the server on load, so an upgrade that happened
  // elsewhere (or a webhook that just landed) is reflected here without re-login.
  useEffect(() => { void refreshUser(); }, [refreshUser]);

  // Not logged in → send to login.
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

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
                <ShieldCheck className="size-4" /> Active
              </span>
            ) : (
              <ProCheckout size="lg" />
            )}
          </div>

          {isPro ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You have unlimited file sizes, batch processing, and every Pro tool. To change or cancel your
              subscription, email <a className="text-primary hover:underline" href="mailto:support@diemdesk.com">support@diemdesk.com</a>.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted-foreground">Upgrade to unlock:</p>
              <ul className="mt-2 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
                {['Unlimited file size', 'Batch processing — many files at once', 'Office conversions (PDF ↔ Word/Excel/PPT) & OCR', 'More AI actions per day'].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Crown className="size-4 shrink-0 text-amber-500" /> {f}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="mt-6">
          <Button variant="outline" onClick={logout}><LogOut className="size-4" /> Log out</Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
