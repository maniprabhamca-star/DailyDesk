import type { Metadata } from 'next';
import {
  Heart, CloudOff, Ban, UserX, Database, FileText, Sparkles, Lock, Cookie, Scale, Mail,
} from 'lucide-react';
import { LegalPage, Section, Callout } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy — Plain-English Privacy Policy | DailyDesk',
  description:
    'DailyDesk in plain English: your files are processed in your browser and never uploaded, we don&rsquo;t sell your data, AI runs only when you ask, and the File Vault is encrypted so even we can&rsquo;t read it.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy at DailyDesk',
    description: 'No uploads, no selling data, no tracking ads. Privacy explained in plain English.',
    type: 'website',
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Your data, your rules"
      title="Privacy Policy"
      intro="No legalese maze. Here is what we collect, what we don&rsquo;t, and exactly how your files and AI requests are handled — written so a human can actually understand it."
      updated="June 2026"
    >
      <Callout tone="success" icon={<Heart className="size-5" />} title="The short version">
        <ul className="ml-4 list-disc space-y-1">
          <li>Our everyday tools run <strong>in your browser</strong> — your files are <strong>never uploaded</strong> to us.</li>
          <li>We <strong>don&rsquo;t sell</strong> your data, and we <strong>don&rsquo;t run tracking ad networks</strong>.</li>
          <li><strong>AI runs only when you ask</strong>, for that one request, and isn&rsquo;t used to train models.</li>
          <li>The <strong>File Vault is encrypted so even we can&rsquo;t read it.</strong></li>
        </ul>
      </Callout>

      <Section id="dont" title="What we don&rsquo;t do">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: CloudOff, t: 'No file uploads for in-browser tools', d: 'Merge, split, compress, convert and more never send your files to us.' },
            { icon: Ban, t: 'No selling your data', d: 'We never sell or rent your personal data or documents to anyone.' },
            { icon: UserX, t: 'No tracking-ad networks', d: 'We don&rsquo;t build advertising profiles or embed third-party ad trackers.' },
            { icon: Lock, t: 'No reading your Vault', d: 'File Vault content is encrypted on your device — we can&rsquo;t open it.' },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border bg-card p-4">
              <x.icon className="size-5 text-emerald-600" strokeWidth={2.25} />
              <p className="mt-2 font-semibold text-foreground">{x.t}</p>
              <p className="mt-0.5 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: x.d }} />
            </div>
          ))}
        </div>
      </Section>

      <Section id="collect" title="What we do collect">
        <p>We try to collect as little as possible. In practice that means:</p>
        <ul className="space-y-3">
          <li className="flex gap-3"><Database className="mt-0.5 size-5 shrink-0 text-primary" /><span><strong className="text-foreground">Account details</strong> — if you create an account, your email address and a securely hashed password. You can use most tools without an account at all.</span></li>
          <li className="flex gap-3"><FileText className="mt-0.5 size-5 shrink-0 text-primary" /><span><strong className="text-foreground">Basic usage metrics</strong> — privacy-respecting, aggregated counts (e.g. how often a tool is used) to help us improve. These aren&rsquo;t tied to your documents.</span></li>
        </ul>
      </Section>

      <Section id="files" title="Your files and documents">
        <p>
          For our in-browser tools, your files are processed entirely on your device and are{' '}
          <strong>never transmitted to or stored on our servers</strong>. We literally cannot see them. When you close
          the tab, nothing remains on our side because nothing was ever sent.
        </p>
      </Section>

      <Section id="ai" title="AI features (Summarize, Chat, Translate)">
        <Callout tone="default" icon={<Sparkles className="size-5" />}>
          <p>
            AI tools need to read your document&rsquo;s text to work, so when <strong>you</strong> choose to use them, the
            relevant text is sent over an encrypted connection to our AI provider, processed for that single request, and
            the result is returned to you. We <strong>don&rsquo;t retain</strong> your document to power AI, and your
            content is <strong>not used to train AI models</strong>. AI never runs unless you ask it to.
          </p>
        </Callout>
      </Section>

      <Section id="vault" title="File Vault">
        <Callout tone="success" icon={<Lock className="size-5" />}>
          <p>
            If you opt in to the File Vault, files are <strong>encrypted on your device before upload</strong> using a key
            only you hold. We store only the encrypted version and have no way to read it. Your vault passphrase is{' '}
            <strong>never sent to us</strong>, which also means we cannot recover your files if you lose it — see the{' '}
            <a href="/security#passphrase" className="font-semibold text-primary hover:underline">Security page</a> for full
            details. The technical specifics live on our{' '}
            <a href="/security#file-vault" className="font-semibold text-primary hover:underline">Security page</a>.
          </p>
        </Callout>
      </Section>

      <Section id="cookies" title="Cookies">
        <p className="flex gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            We use only the cookies needed to make the app work — for example, keeping you signed in and remembering your
            theme (light/dark). We don&rsquo;t use advertising or cross-site tracking cookies.
          </span>
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p className="flex gap-3">
          <Scale className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            You can access, export, or delete your account data at any time. If you delete your account, we remove your
            account data and any files you stored in the Vault. Depending on where you live, you may have additional rights
            under laws such as GDPR or CCPA — we honour these for everyone.
          </span>
        </p>
      </Section>

      <Section id="contact" title="Questions?">
        <p className="flex gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            Email us at{' '}
            <a href="mailto:privacy@dailydesk.app" className="font-semibold text-primary hover:underline">privacy@dailydesk.app</a>{' '}
            and we&rsquo;ll be glad to help.
          </span>
        </p>
      </Section>
    </LegalPage>
  );
}
