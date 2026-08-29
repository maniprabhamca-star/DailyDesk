import type { Metadata } from 'next';
import Link from 'next/link';
import { CloudOff, Bell, ExternalLink } from 'lucide-react';
import { LegalPage, Section, Callout } from '@/components/legal/legal-page';
import { SUBPROCESSORS } from '@/lib/subprocessors';

export const metadata: Metadata = {
  title: 'Subprocessors — Who Else Touches Your Data | DiemDesk',
  description:
    'The complete list of third parties that can handle personal data on our behalf, what each one is for, and why the list is this short.',
  alternates: { canonical: '/subprocessors' },
  openGraph: {
    images: ['/og.png'],
    title: 'DiemDesk subprocessors',
    description: 'Every third party that can touch personal data on our behalf — and why there are so few.',
    type: 'website',
  },
};

export default function SubprocessorsPage() {
  return (
    <LegalPage
      path="/subprocessors"
      crumb="Subprocessors"
      eyebrow="Trust & Safety"
      title="Subprocessors"
      intro="Everyone outside DiemDesk who can handle personal data on our behalf, what each one does, and exactly what it can see. Published rather than sent on request, because a reviewer should not have to email us to find out who else is involved."
      updated="August 2026"
    >
      <Section id="list" title={`The complete list — ${SUBPROCESSORS.length}`}>
        <div className="mt-2 space-y-4">
          {SUBPROCESSORS.map((s) => (
            <div key={s.name} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold">{s.name}</h3>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Their privacy policy <ExternalLink className="size-3" />
                </a>
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{s.purpose}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
                <dt className="font-semibold">What it sees</dt>
                <dd className="text-muted-foreground">{s.data}</dd>
                <dt className="font-semibold">Location</dt>
                <dd className="text-muted-foreground">{s.location}</dd>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Callout tone="success" icon={<CloudOff className="size-5" />} title="Why the list is this short">
        <p>
          It is structural, not modest. Most of the catalogue runs inside your browser, so there is no processing to
          delegate to anyone. A service whose every tool uploads needs a subprocessor for storage, another for the
          conversion pipeline, a CDN in front of both, and usually an analytics vendor watching all of it. We do not run
          analytics that identify you, and the tools that never receive a file cannot hand it on.
        </p>
      </Callout>

      <Section id="not-here" title="Who is deliberately NOT on this list">
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">No analytics or advertising vendor.</b> No Google Analytics, no pixels, no
            session recording. See{' '}
            <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy</Link>.
          </li>
          <li>
            <b className="text-foreground">No email marketing platform</b> holding your contacts.
          </li>
          <li>
            <b className="text-foreground">No customer-support tool</b> with a copy of your documents in a ticket.
          </li>
          <li>
            <b className="text-foreground">No cloud storage provider for your files.</b> File Vault contents are
            encrypted on your device before they are stored, so what sits at rest is ciphertext we cannot read.
          </li>
        </ul>
      </Section>

      <Callout icon={<Bell className="size-5" />} title="Changes">
        <p>
          We will tell customers before adding a subprocessor, so there is time to object. If you want to be told
          directly rather than by watching this page, email{' '}
          <a href="mailto:support@diemdesk.com" className="font-medium text-primary underline underline-offset-2">
            support@diemdesk.com
          </a>{' '}
          and ask to be on the notification list. This page carries the date it was last reviewed at the top.
        </p>
        <p className="mt-2">
          Processor terms are on the{' '}
          <Link href="/dpa" className="font-medium text-primary underline underline-offset-2">DPA page</Link>.
        </p>
      </Callout>
    </LegalPage>
  );
}
