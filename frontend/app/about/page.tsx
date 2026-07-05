import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, CloudOff, Heart, Sparkles, Mail } from 'lucide-react';
import { LegalPage, Section, Callout } from '@/components/legal/legal-page';
import { liveToolCount } from '@/components/app/catalog';

export const metadata: Metadata = {
  title: 'About DiemDesk — Private, Everyday Document Tools | DiemDesk',
  description:
    'DiemDesk is a private-by-design toolkit of 35+ PDF, image and everyday tools that run right in your browser — no uploads, no signup, no watermarks. Learn who we are and why we build this way.',
  alternates: { canonical: '/about' },
  openGraph: {
    images: ['/og.png'],
    title: 'About DiemDesk',
    description: 'Private-by-design everyday tools that run in your browser — no uploads, no signup, no watermarks.',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="About"
      title="Every daily tool, and your files stay yours"
      intro="DiemDesk is a growing toolkit for the small document jobs everyone runs into — merging, compressing, converting, signing and more. The difference: most of it runs entirely inside your browser, so your files never leave your device."
      updated="July 2026"
    >
      <Callout tone="success" icon={<ShieldCheck className="size-5" />} title="Why we exist">
        <p>
          The everyday tools people rely on shouldn&rsquo;t require uploading private documents to a stranger&rsquo;s
          server, creating an account, or dodging watermarks and daily limits. We&rsquo;re building the toolkit we
          wanted ourselves: fast, genuinely useful, and private by default.
        </p>
      </Callout>

      <Section title="What we build">
        <p>
          {liveToolCount}+ tools today and growing — PDF (merge, split, compress, convert, sign, organize), image and
          video tools, QR codes, password generation, and handy utilities. The catalog keeps expanding, and the core
          promise never changes: the tools that <em>can</em> run on your device, do.
        </p>
      </Section>

      <Section title="How it works — private by design">
        <p>
          Tools like Merge, Split, Compress, Convert and QR generation run <strong>100% in your browser</strong> using
          your own device&rsquo;s power. When you drop a file in, it&rsquo;s opened locally and <strong>never
          uploaded</strong>; the result downloads straight back to you. A few tools genuinely need a server (Office
          conversions, OCR, and — later — AI); for those we&rsquo;re upfront, we process and delete immediately, and we
          never train on your data.
        </p>
        <p>
          <Link href="/security" className="font-semibold text-primary hover:underline">See exactly where your data goes →</Link>
        </p>
      </Section>

      <Section title="Free during launch — honest pricing later">
        <p>
          Right now every tool is <strong>free for everyone, worldwide</strong> — no signup, no watermarks, no daily
          limits. Because the core tools run in your browser, they cost us nothing to give away, so they&rsquo;ll always
          stay free. Later we&rsquo;ll add an optional <strong>Pro</strong> plan for power features (batch, bigger files
          on our server tools, saved workflows, and more) — but we&rsquo;ll gate <em>scale</em>, never everyday quality.
        </p>
        <p>
          <Link href="/pricing" className="font-semibold text-primary hover:underline">See the plan →</Link>{' '}
          <Link href="/free" className="ml-2 font-semibold text-primary hover:underline">Why it&rsquo;s free →</Link>
        </p>
      </Section>

      <Section title="Who we are">
        <p>
          DiemDesk is operated by <strong>JPNM Rapid Universe LLC</strong>, a company registered in the United States
          (Georgia). We&rsquo;re a small, independent team — which is exactly why we can keep the product honest, free of
          ads and trackers, and focused on the people who use it rather than advertisers.
        </p>
      </Section>

      <Callout icon={<Mail className="size-5" />} title="Get in touch">
        <p>
          Questions, ideas, or something not working? Email{' '}
          <a href="mailto:support@diemdesk.com" className="font-semibold text-primary hover:underline">support@diemdesk.com</a>{' '}
          — or share a note on our{' '}
          <Link href="/feedback" className="font-semibold text-primary hover:underline">feedback page</Link>. Security
          reports go to{' '}
          <a href="mailto:security@diemdesk.com" className="font-semibold text-primary hover:underline">security@diemdesk.com</a>,
          and privacy requests to{' '}
          <a href="mailto:privacy@diemdesk.com" className="font-semibold text-primary hover:underline">privacy@diemdesk.com</a>.
        </p>
      </Callout>
    </LegalPage>
  );
}
