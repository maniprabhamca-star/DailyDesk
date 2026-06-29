import type { Metadata } from 'next';
import {
  FileText, CheckCircle2, Ban, UserCircle, CreditCard, FolderLock, Sparkles, KeyRound,
  ShieldAlert, LogOut, RefreshCw, Mail, Landmark,
} from 'lucide-react';
import { LegalPage, Section, Callout } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service | DailyDesk',
  description:
    'The rules for using DailyDesk, in plain English: acceptable use, accounts and billing, your ownership of your files, AI and File Vault terms, and our liability.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service — DailyDesk',
    description: 'The rules for using DailyDesk, written in plain English.',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="The rules of the road"
      title="Terms of Service"
      intro="These terms are the agreement between you and DailyDesk for using our tools. We&rsquo;ve written them in plain English so you can actually read them. By using DailyDesk, you agree to what&rsquo;s below."
      updated="June 2026"
    >
      <Callout tone="success" icon={<CheckCircle2 className="size-5" />} title="The short version">
        <ul className="ml-4 list-disc space-y-1">
          <li><strong>You own your files</strong> — we never claim any rights to your content.</li>
          <li>Use DailyDesk for lawful purposes; don&rsquo;t abuse or attack the service.</li>
          <li>Pro is a subscription that renews until you cancel.</li>
          <li>AI results aren&rsquo;t guaranteed perfect — always review important output.</li>
          <li>If you lose your File Vault passphrase, your files can&rsquo;t be recovered.</li>
        </ul>
      </Callout>

      <Section id="acceptance" title="1. Accepting these terms">
        <p className="flex gap-3">
          <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            By accessing or using DailyDesk, you agree to these Terms of Service and to our{' '}
            <a href="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</a>. If you don&rsquo;t
            agree, please don&rsquo;t use the service. If you&rsquo;re using DailyDesk on behalf of a company, you confirm
            you&rsquo;re authorised to accept these terms for it.
          </span>
        </p>
      </Section>

      <Section id="service" title="2. The service">
        <p>
          DailyDesk provides online productivity tools — including PDF tools, a QR generator, image tools, and AI
          features. Most tools run inside your browser. We work hard to keep the service available and improving, but we
          may add, change, or remove features, and there may be occasional downtime for maintenance or reasons beyond our
          control.
        </p>
      </Section>

      <Section id="acceptable-use" title="3. Acceptable use">
        <p>To keep DailyDesk safe and reliable for everyone, you agree <strong>not</strong> to:</p>
        <ul className="ml-1 space-y-2">
          {[
            'Use the service for anything illegal, or to process content you don&rsquo;t have the right to use.',
            'Upload or distribute malware, or attempt to hack, overload, or disrupt the service.',
            'Reverse-engineer, scrape, or resell the service without our written permission.',
            'Abuse AI features or automate them to circumvent fair-use limits.',
            'Infringe anyone&rsquo;s intellectual property, privacy, or other rights.',
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <Ban className="mt-0.5 size-4 shrink-0 text-red-500" />
              <span dangerouslySetInnerHTML={{ __html: t }} />
            </li>
          ))}
        </ul>
        <p>We may suspend or terminate accounts that break these rules.</p>
      </Section>

      <Section id="accounts" title="4. Your account">
        <p className="flex gap-3">
          <UserCircle className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            You can use many tools without an account. If you create one, you&rsquo;re responsible for keeping your login
            details secure and for activity under your account. Tell us promptly if you suspect unauthorised access. Provide
            accurate information when you sign up.
          </span>
        </p>
      </Section>

      <Section id="billing" title="5. Free and Pro plans, billing">
        <div className="flex gap-3">
          <CreditCard className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-3">
            <p>
              DailyDesk offers a free plan and a paid <strong>Pro</strong> subscription. Pro is billed in advance on a
              recurring basis (monthly or annually, as you choose) and <strong>renews automatically</strong> until you
              cancel.
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>You can cancel anytime; your Pro access continues until the end of the period you&rsquo;ve paid for.</li>
              <li>Prices and plan features may change; we&rsquo;ll give notice of material changes before they affect you.</li>
              <li>If a payment fails, we may downgrade your account to the free plan until it&rsquo;s resolved.</li>
              <li>Refunds are handled per our refund practices and applicable law.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="your-content" title="6. Your content stays yours">
        <Callout tone="success" icon={<FolderLock className="size-5" />} title="You own what you create and upload">
          <p>
            DailyDesk claims <strong>no ownership</strong> of your files or content. For in-browser tools, your files are
            never sent to us at all. For features that do involve our servers (like the File Vault), you grant us only the
            limited permission needed to actually provide that feature to you — nothing more. We don&rsquo;t use your
            content to advertise, and we don&rsquo;t sell it.
          </p>
        </Callout>
      </Section>

      <Section id="ai" title="7. AI features">
        <Callout tone="default" icon={<Sparkles className="size-5" />}>
          <p>
            AI tools (Summarize, Chat, Translate) are powered by automated models and can occasionally be inaccurate or
            incomplete. <strong>Always review AI output before relying on it</strong>, and don&rsquo;t treat it as
            professional legal, medical, or financial advice. You&rsquo;re responsible for how you use the results. See our{' '}
            <a href="/security#ai" className="font-semibold text-primary hover:underline">Security page</a> for how AI
            requests are handled.
          </p>
        </Callout>
      </Section>

      <Section id="vault" title="8. File Vault">
        <Callout tone="warning" icon={<KeyRound className="size-5" />}>
          <p>
            The File Vault is end-to-end encrypted, which means <strong>only you</strong> can unlock it. We never receive
            your vault passphrase and <strong>cannot recover your files if you lose it</strong> — by using the Vault you
            understand and accept this. Keep your passphrase and recovery key safe. Full details are on our{' '}
            <a href="/security#passphrase" className="font-semibold text-primary hover:underline">Security page</a>.
          </p>
        </Callout>
      </Section>

      <Section id="disclaimer" title="9. Disclaimers and limitation of liability">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="space-y-3">
            <p>
              DailyDesk is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>, without warranties
              of any kind. We don&rsquo;t guarantee the service will be uninterrupted, error-free, or that results will meet
              your specific needs.
            </p>
            <p>
              To the fullest extent permitted by law, DailyDesk and its team won&rsquo;t be liable for indirect,
              incidental, or consequential damages, or for loss of data, profits, or files arising from your use of the
              service. Always keep your own backups of important files.
            </p>
          </div>
        </div>
      </Section>

      <Section id="termination" title="10. Termination">
        <p className="flex gap-3">
          <LogOut className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            You can stop using DailyDesk at any time and delete your account. We may suspend or terminate access if you
            violate these terms or to protect the service and its users. On termination, your right to use the service ends,
            and we&rsquo;ll handle your data as described in our{' '}
            <a href="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</a>.
          </span>
        </p>
      </Section>

      <Section id="governing-law" title="11. Governing law">
        <p className="flex gap-3">
          <Landmark className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            DailyDesk is operated from the United States. These terms are governed by the laws of the United States and the
            State of Georgia, without regard to conflict-of-law rules. Any disputes will be handled in the courts located
            in the State of Georgia, unless applicable law requires otherwise. If any part of these terms is found
            unenforceable, the rest stays in effect.
          </span>
        </p>
      </Section>

      <Section id="changes" title="12. Changes to these terms">
        <p className="flex gap-3">
          <RefreshCw className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            We may update these terms from time to time. If we make material changes, we&rsquo;ll update the date at the top
            and, where appropriate, notify you. Continuing to use DailyDesk after changes take effect means you accept the
            updated terms.
          </span>
        </p>
      </Section>

      <Section id="contact" title="13. Contact us">
        <p className="flex gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            Questions about these terms? Email us at{' '}
            <a href="mailto:support@dailydesk.app" className="font-semibold text-primary hover:underline">support@dailydesk.app</a>.
          </span>
        </p>
      </Section>
    </LegalPage>
  );
}
