import type { Metadata } from 'next';
import Link from 'next/link';
import { Accessibility, AlertTriangle, Keyboard, MessageSquare } from 'lucide-react';
import { LegalPage, Section, Callout } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Accessibility Statement | DiemDesk',
  description:
    'What we aim for, what we have actually done, the barriers we already know about, and how to tell us about one we have missed.',
  alternates: { canonical: '/accessibility' },
  openGraph: {
    images: ['/og.png'],
    title: 'Accessibility at DiemDesk',
    description: 'Our target, our known gaps, and how to report a barrier.',
    type: 'website',
  },
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      path="/accessibility"
      crumb="Accessibility"
      eyebrow="Trust & Safety"
      title="Accessibility"
      intro="What we aim for, what we have actually done, and — the part most statements leave out — what we already know is not good enough yet. If you hit a barrier, there is an address at the bottom that reaches a person."
      updated="August 2026"
    >
      <Callout tone="warning" icon={<AlertTriangle className="size-5" />} title="We are not claiming a conformance level">
        <p>
          A statement that claims full WCAG 2.2 AA conformance should be backed by a real audit, and we have not had
          one. Saying otherwise would be the easiest sentence to write and the least honest. What follows is what we
          have built for, what we have checked ourselves, and where we know the gaps are.
        </p>
      </Callout>

      <Section id="target" title="What we are aiming at">
        <p>
          WCAG 2.2 Level AA is the target, because it is what public-sector and enterprise buyers are measured against
          and it is the right bar regardless. We treat it as a direction we are moving in rather than a badge we have
          earned.
        </p>
      </Section>

      <Section id="done" title="What is actually in place">
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">Keyboard operation.</b> Tools are reachable and operable without a mouse,
            and focus is visible rather than suppressed. The command palette opens with ⌘K / Ctrl-K and is fully
            keyboard driven.
          </li>
          <li>
            <b className="text-foreground">Semantic structure.</b> One <code>h1</code> per page, headings in order, real
            landmarks, and lists marked up as lists — which is what a screen reader navigates by.
          </li>
          <li>
            <b className="text-foreground">Text alternatives.</b> Decorative icons are hidden from assistive technology;
            icon-only controls carry a label rather than relying on the shape.
          </li>
          <li>
            <b className="text-foreground">Reduced motion.</b> Animation respects{' '}
            <code>prefers-reduced-motion</code>. The first-visit brand animation never plays for anyone who has asked
            for less motion.
          </li>
          <li>
            <b className="text-foreground">Light and dark.</b> Both themes are designed rather than inverted, so
            contrast holds in each.
          </li>
          <li>
            <b className="text-foreground">Resizing.</b> Layouts use relative units and reflow rather than forcing
            horizontal scrolling when text is enlarged.
          </li>
          <li>
            <b className="text-foreground">No time limits.</b> Nothing expires while you are working on it, and nothing
            auto-plays sound.
          </li>
        </ul>
      </Section>

      <Section id="gaps" title="Known gaps — the honest part">
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">No independent audit.</b> Nobody outside the team has assessed us, and no
            VPAT exists. If you need one to procure, say so and we will talk about getting it done.
          </li>
          <li>
            <b className="text-foreground">Limited testing with real assistive technology.</b> We have used automated
            checks and keyboard testing. That is not the same as sitting with a screen reader user, and we know it.
          </li>
          <li>
            <b className="text-foreground">The visual editors are the weakest area.</b> Annotate, Redact and Edit
            involve placing things on a page by dragging. Drag-and-drop is genuinely hard to make equivalent without a
            mouse, and we have not solved it yet. If that is what you need, tell us — it moves up the list.
          </li>
          <li>
            <b className="text-foreground">A PDF we produce is only as accessible as what went in.</b> Converting a
            scanned image does not create a tagged, screen-reader-friendly document. Running OCR helps; it is not the
            same as a properly tagged PDF.
          </li>
          <li>
            <b className="text-foreground">Third-party content.</b> The checkout is Stripe&rsquo;s hosted page and its
            accessibility is theirs, not ours.
          </li>
        </ul>
      </Section>

      <Callout tone="success" icon={<Keyboard className="size-5" />} title="One thing that helps more than it looks">
        <p>
          Because most tools run inside your browser, they work with the assistive technology and browser settings you
          already have configured, offline, with no account and no sign-in step in the way. There is no separate app to
          make accessible and no cloud session to keep alive.
        </p>
      </Callout>

      <Callout icon={<MessageSquare className="size-5" />} title="Tell us about a barrier">
        <p>
          If something blocked you, we want the specific detail — the page, what you were trying to do, and what
          happened.{' '}
          <a href="mailto:support@diemdesk.com" className="font-medium text-primary underline underline-offset-2">
            support@diemdesk.com
          </a>
          , or the <Link href="/feedback" className="text-primary underline underline-offset-2">feedback form</Link>. We
          aim to reply within five working days and to say plainly whether we can fix it, when, or that we cannot.
        </p>
        <p className="mt-2">
          If you need something urgently in another format, ask. That is a reasonable request and we would rather do it
          than have you go without.
        </p>
      </Callout>

      <Callout tone="default" icon={<Accessibility className="size-5" />} title="Reviewed">
        <p>
          This statement was last reviewed in August 2026 and is written against our own testing. It will be updated as
          gaps close — including this sentence, when there is an audit to point at.
        </p>
      </Callout>
    </LegalPage>
  );
}
