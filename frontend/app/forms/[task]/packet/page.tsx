import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { PacketGate } from '@/components/forms/packet-gate';
import { FORM_TASKS, authoritiesFor, formFor, getFormTask, listJoin } from '@/lib/form-tasks';

// The Pro packet for one task: every form in the set, in order, with the
// details that repeat already in the boxes.
//
// ⚠ Read lib/form-packet.ts before touching anything here. Two rules that are
// not obvious from this file:
//
//   • A form is only pre-filled where somebody authored a map for THIS task
//     and THAT form. The same form means different things in different jobs —
//     on the W-4 inside "hire your first employee" the name and the taxpayer
//     number belong to the person being hired, not to the reader. No map, no
//     pre-fill, and the form still arrives.
//
//   • The page states no requirement and gives no instruction. The same
//     vocabulary guard that covers the task pages covers this one's copy, in
//     tests/unit/form-packet.test.ts.
//
// Not in the sitemap and noindex: it is a signed-in tool, not a page for a
// search engine. The task page it hangs off is the indexed one.

// ⚠ US tasks only. An India set is portal filings — GSTR-3B is not a PDF with
// boxes in it — so there is nothing for a packet to pre-fill and nothing for
// the verifier to check. Generating the route anyway would put a Pro upgrade
// wall in front of a feature that could not work if it were bought.
// Pinned in tests/unit/india-form-tasks.test.ts.
const PACKET_TASKS = FORM_TASKS.filter((t) => t.region === 'us');

export function generateStaticParams() {
  return PACKET_TASKS.map((t) => ({ task: t.slug }));
}

export async function generateMetadata(props: { params: Promise<{ task: string }> }): Promise<Metadata> {
  const { task } = await props.params;
  const t = getFormTask(task);
  if (!t || t.region !== 'us') return {};
  return {
    title: `${t.seoTitle ?? t.title} — the whole set, pre-filled | DiemDesk`,
    description: `Fetch all ${t.forms.length} forms at once, with the details that repeat across them already entered. Nothing is uploaded and nothing is kept.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/forms/${t.slug}` },
  };
}

export default async function Page(props: { params: Promise<{ task: string }> }) {
  const { task } = await props.params;
  const t = getFormTask(task);
  // Not just an unknown slug: a real India task has no packet either, and
  // dynamicParams means this route would otherwise render on demand for one.
  if (!t || t.region !== 'us') notFound();

  const forms = t.forms
    .map((tf) => {
      const f = formFor(tf);
      return f ? { slug: f.slug, short: f.short, name: f.name, role: tf.role } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const named = authoritiesFor(t).map((a) => `the ${a}`);
  const noticeSubject = listJoin([...named, 'any other government agency'], 'or');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <nav className="text-xs text-muted-foreground">
          <Link href="/forms" className="underline-offset-2 hover:underline">
            Government forms
          </Link>{' '}
          /{' '}
          <Link href={`/forms/${t.slug}`} className="underline-offset-2 hover:underline">
            {t.title}
          </Link>{' '}
          / <span className="text-foreground">The whole set</span>
        </nav>

        <header className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t.audience}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {t.title}: the whole set at once
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {forms.length} forms, in the order this happens, each one fetched live from the agency that
            publishes it. Type the details that repeat once and they land in every box we have read and
            confirmed on these forms.
          </p>
        </header>

        <p className="mt-6 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <span className="leading-relaxed text-muted-foreground">
            {/* The lead-in is not decoration: without it this opens mid-thought
                on “State and local forms.”, which reads as a fragment rather
                than as the limit of what the packet does. */}
            <b className="text-foreground">What this packet does not cover.</b> {t.notCovered}
          </span>
        </p>

        <PacketGate taskSlug={t.slug} taskTitle={t.title} forms={forms} />

        <div className="mt-10 border-t pt-6">
          <Link
            href={`/forms/${t.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            What each of these forms is, who fills it in and where it goes
          </Link>
        </div>

        <div className="mt-8">
          <ThirdPartyNotice
            subject={noticeSubject}
            because="Each form in this packet is fetched from the authority that publishes it, at the moment you ask for it, so you can go to the source and check the current version yourself"
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
