import type { Metadata } from 'next';
import {
  BadgeCheck, CalendarClock, Mail, CreditCard, XCircle, RotateCcw, ShieldCheck, Clock,
} from 'lucide-react';
import { LegalPage, Section, Callout, FlowStep } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Refund Policy — 14-Day Money-Back Guarantee | DailyDesk',
  description:
    'DailyDesk offers a simple 14-day money-back guarantee on Pro. Not happy in your first two weeks? Email us for a full refund — no hoops, no fine print.',
  alternates: { canonical: '/refund-policy' },
  openGraph: {
    title: 'Refund Policy — DailyDesk',
    description: 'A simple 14-day money-back guarantee on DailyDesk Pro.',
    type: 'website',
  },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Fair & simple"
      title="Refund Policy"
      intro="We want you to love DailyDesk Pro. If you don&rsquo;t, we make refunds easy — no hoops, no buried fine print. Here&rsquo;s exactly how it works."
      updated="June 2026"
    >
      <Callout tone="success" icon={<BadgeCheck className="size-5" />} title="14-day money-back guarantee">
        <p>
          If you&rsquo;re not happy with DailyDesk Pro, request a refund within{' '}
          <strong>14 days of your purchase</strong> and we&rsquo;ll give you your money back —{' '}
          <strong>no questions asked</strong>. That applies to your first subscription payment, monthly or annual.
        </p>
      </Callout>

      <Section id="covered" title="What&rsquo;s covered">
        <ul className="space-y-3">
          <li className="flex gap-3"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">New Pro subscriptions.</strong> Your first monthly or annual Pro payment is fully refundable within 14 days.</span></li>
          <li className="flex gap-3"><RotateCcw className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Accidental renewals.</strong> Charged for a renewal you meant to cancel? Contact us within 14 days of that charge and we&rsquo;ll sort it out.</span></li>
          <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span><strong className="text-foreground">Billing errors.</strong> Duplicate or incorrect charges are always refunded, no time limit.</span></li>
        </ul>
      </Section>

      <Section id="how" title="How to request a refund">
        <ol className="space-y-4">
          <FlowStep n={1} title="Email us">Write to <a href="mailto:support@dailydesk.app" className="font-semibold text-primary hover:underline">support@dailydesk.app</a> from the email on your account, with the subject &ldquo;Refund request.&rdquo;</FlowStep>
          <FlowStep n={2} title="Tell us the basics">Include your account email and roughly when you subscribed. You don&rsquo;t need to justify why — &ldquo;not for me&rdquo; is enough.</FlowStep>
          <FlowStep n={3} title="We process it">We&rsquo;ll confirm and issue the refund to your original payment method, usually within 5&ndash;10 business days (your bank&rsquo;s timing may vary).</FlowStep>
        </ol>
        <Callout tone="default" icon={<Clock className="size-5" />}>
          <p>
            When your refund is processed, your account returns to the free plan. You keep access to all our free,
            in-browser tools — those are always free, forever.
          </p>
        </Callout>
      </Section>

      <Section id="not-covered" title="What&rsquo;s not covered">
        <ul className="space-y-3">
          <li className="flex gap-3"><XCircle className="mt-0.5 size-5 shrink-0 text-red-500" /><span><strong className="text-foreground">Requests after 14 days.</strong> Past the guarantee window we generally don&rsquo;t refund — but you can <strong>cancel anytime</strong> to stop all future charges (see below).</span></li>
          <li className="flex gap-3"><XCircle className="mt-0.5 size-5 shrink-0 text-red-500" /><span><strong className="text-foreground">Renewals after the window.</strong> If a subscription renews and you didn&rsquo;t cancel beforehand, that period isn&rsquo;t automatically refundable beyond the 14-day allowance above — though we&rsquo;re reasonable, so still reach out.</span></li>
        </ul>
        <p>Whatever your situation, email us — we&rsquo;d always rather find a fair outcome than lose your trust over a charge.</p>
      </Section>

      <Section id="cancel" title="Cancelling your subscription">
        <p className="flex gap-3">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            You can cancel Pro <strong>at any time</strong> from your account settings. Cancelling stops future billing —
            you keep Pro access until the end of the period you&rsquo;ve already paid for, then drop to the free plan.
            Cancelling on its own isn&rsquo;t a refund; if you also want money back, use the 14-day guarantee above.
          </span>
        </p>
      </Section>

      <Section id="legal" title="Your statutory rights">
        <p className="flex gap-3">
          <CreditCard className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            Nothing here limits any refund rights you have under applicable law. This policy works alongside our{' '}
            <a href="/terms" className="font-semibold text-primary hover:underline">Terms of Service</a>. Questions? Email{' '}
            <a href="mailto:support@dailydesk.app" className="font-semibold text-primary hover:underline">support@dailydesk.app</a>{' '}
            and we&rsquo;ll help.
          </span>
        </p>
      </Section>
    </LegalPage>
  );
}
