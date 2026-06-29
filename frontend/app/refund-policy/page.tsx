import type { Metadata } from 'next';
import {
  BadgeCheck, CalendarClock, Mail, CreditCard, XCircle, RotateCcw, ShieldCheck, Clock,
  CheckCircle2, BellRing, Repeat,
} from 'lucide-react';
import { LegalPage, Section, Callout, FlowStep } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Refund Policy — Money-Back Guarantee | DailyDesk',
  description:
    'DailyDesk Pro comes with a money-back guarantee: 14 days for monthly plans, 30 days for annual plans. Not happy? Email us for a full refund — no hoops, no fine print.',
  alternates: { canonical: '/refund-policy' },
  openGraph: {
    title: 'Refund Policy — DailyDesk',
    description: 'A clear money-back guarantee on DailyDesk Pro: 14 days monthly, 30 days annual.',
    type: 'website',
  },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Fair & simple"
      title="Refund Policy"
      intro="We want you to genuinely love DailyDesk Pro — and if you don&rsquo;t, we make getting your money back easy. No hoops, no buried fine print. This page explains exactly when refunds apply, how to request one, and what happens when you cancel."
      updated="June 2026"
    >
      {/* Headline guarantee */}
      <Callout tone="success" icon={<BadgeCheck className="size-5" />} title="Our money-back guarantee">
        <p>
          When you upgrade to Pro for the first time, you&rsquo;re protected by a no-questions-asked money-back guarantee:
        </p>
        <ul className="ml-4 mt-1 list-disc space-y-1">
          <li><strong>Monthly plan</strong> — full refund if you ask within <strong>14 days</strong> of your first payment.</li>
          <li><strong>Annual plan</strong> — full refund if you ask within <strong>30 days</strong> of your first payment.</li>
        </ul>
        <p className="mt-1">
          You don&rsquo;t need to explain why. &ldquo;It&rsquo;s not for me&rdquo; is a perfectly good reason.
        </p>
      </Callout>

      {/* Who it applies to */}
      <Section id="who" title="Who the guarantee is for">
        <p>
          The money-back guarantee is our way of letting new customers try Pro with zero risk. To keep it simple and fair
          for everyone:
        </p>
        <ul className="space-y-3">
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">It applies to your first Pro subscription.</strong> The very first time you upgrade — whether you choose monthly or annual — you&rsquo;re covered for the window above.</span></li>
          <li className="flex gap-3"><Repeat className="mt-0.5 size-5 shrink-0 text-amber-600" /><span><strong className="text-foreground">It&rsquo;s a one-time guarantee.</strong> If you previously took a refund and later subscribe again, that new subscription isn&rsquo;t covered by a fresh guarantee. You can still cancel anytime — there&rsquo;s just no second money-back window.</span></li>
        </ul>
      </Section>

      {/* What's covered */}
      <Section id="covered" title="What&rsquo;s covered">
        <ul className="space-y-3">
          <li className="flex gap-3"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Your first Pro payment.</strong> Refunded in full if you ask within your guarantee window (14 days monthly / 30 days annual).</span></li>
          <li className="flex gap-3"><RotateCcw className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Accidental renewals — only if Pro is unused.</strong> If your plan renewed because you forgot to cancel <strong>and you haven&rsquo;t used any Pro feature since that renewal</strong>, email us within a few days and we&rsquo;ll refund it. If Pro has already been used during the new period, that period isn&rsquo;t eligible for a refund.</span></li>
          <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Billing errors.</strong> Duplicate charges, wrong amounts, or charges you didn&rsquo;t authorise are always refunded — no time limit.</span></li>
        </ul>
      </Section>

      {/* What's NOT covered */}
      <Section id="not-covered" title="What&rsquo;s not covered">
        <p>So the guarantee stays sustainable, a few things fall outside it:</p>
        <ul className="space-y-3">
          <li className="flex gap-3"><XCircle className="mt-0.5 size-5 shrink-0 text-red-500" /><span><strong className="text-foreground">Requests after your window.</strong> Once your 14-day (monthly) or 30-day (annual) window has passed, that payment isn&rsquo;t refundable. You can still <strong>cancel anytime</strong> to stop all future charges.</span></li>
          <li className="flex gap-3"><XCircle className="mt-0.5 size-5 shrink-0 text-red-500" /><span><strong className="text-foreground">No partial / prorated refunds.</strong> We don&rsquo;t refund the unused part of a billing period. For example, cancelling partway through a month or partway through an annual plan doesn&rsquo;t refund the remaining days or months — instead, you keep full Pro access until the end of the period you&rsquo;ve already paid for.</span></li>
          <li className="flex gap-3"><XCircle className="mt-0.5 size-5 shrink-0 text-red-500" /><span><strong className="text-foreground">Repeat guarantees.</strong> As above, the money-back guarantee applies once, to your first subscription.</span></li>
        </ul>
        <Callout tone="default">
          <p>
            Whatever your situation, it&rsquo;s always worth emailing us. We&rsquo;d much rather find a fair outcome than
            lose your trust over a charge — these rules are the baseline, not a wall.
          </p>
        </Callout>
      </Section>

      {/* How cancellation works */}
      <Section id="cancel" title="How cancelling works">
        <div className="flex gap-3">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-3">
            <p>
              You can cancel Pro <strong>at any time</strong> from your account settings. Here&rsquo;s exactly what happens
              when you do:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Your subscription stops renewing — you won&rsquo;t be charged again.</li>
              <li>You <strong>keep full Pro access</strong> until the end of the period you&rsquo;ve already paid for.</li>
              <li>After that date, your account simply moves to the free plan.</li>
            </ul>
            <p>
              Cancelling on its own is <strong>not</strong> a refund — it stops future billing. If you also want money
              back, that&rsquo;s the money-back guarantee above (within your window).
            </p>
          </div>
        </div>
        <Callout tone="success" icon={<BellRing className="size-5" />} title="We&rsquo;ll remind you before annual renewals">
          <p>
            Nobody likes a surprise charge. Before an annual plan renews, we&rsquo;ll send you a reminder email in advance
            so you have plenty of time to decide whether to continue or cancel.
          </p>
        </Callout>
      </Section>

      {/* How to request */}
      <Section id="how" title="How to request a refund">
        <ol className="space-y-4">
          <FlowStep n={1} title="Email us">Write to <a href="mailto:support@dailydesk.app" className="font-semibold text-primary hover:underline">support@dailydesk.app</a> from the email address on your account, with the subject &ldquo;Refund request.&rdquo;</FlowStep>
          <FlowStep n={2} title="Share a couple of details">Include your account email and roughly when you subscribed. You don&rsquo;t need to justify your reason — we won&rsquo;t ask you to jump through hoops.</FlowStep>
          <FlowStep n={3} title="We confirm and refund">We&rsquo;ll reply to confirm and send the refund to your original payment method. Refunds are typically issued within <strong>5&ndash;10 business days</strong>; how quickly it lands depends on your bank or card provider.</FlowStep>
        </ol>
        <Callout tone="default" icon={<Clock className="size-5" />}>
          <p>
            Once a refund is processed, your account returns to the free plan. You keep unlimited access to all our free,
            in-browser tools — those are free, forever, with or without Pro.
          </p>
        </Callout>
      </Section>

      {/* Statutory */}
      <Section id="legal" title="Your statutory rights">
        <p className="flex gap-3">
          <CreditCard className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            Nothing in this policy limits any refund or consumer rights you may have under the laws that apply to you. This
            Refund Policy works alongside our{' '}
            <a href="/terms" className="font-semibold text-primary hover:underline">Terms of Service</a>. If anything here
            is unclear, just email{' '}
            <a href="mailto:support@dailydesk.app" className="font-semibold text-primary hover:underline">support@dailydesk.app</a>{' '}
            — we&rsquo;re happy to help.
          </span>
        </p>
      </Section>
    </LegalPage>
  );
}
