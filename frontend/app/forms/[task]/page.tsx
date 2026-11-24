import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, CircleAlert, PenLine, Send, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { GetFormButton } from '@/components/app/get-form-button';
import { CheckedAgo } from '@/components/forms/checked-ago';
import {
  FORM_TASKS,
  APPLIES_LABEL,
  authoritiesFor,
  formFor,
  getFormTask,
  listJoin,
  reviewedOnLabel,
  type Applies,
} from '@/lib/form-tasks';

// A task page: the forms one job involves, in the order it happens, with the
// column nobody else prints — who fills each one in, and where it goes.
//
// ⚠ Read lib/form-tasks.ts before editing any copy here. This page composes
// facts verified per form; it states no requirement and gives no instruction,
// and tests/unit/form-tasks.test.ts fails the build on the vocabulary that
// would. In particular: the relevance pills say Always / Usually / Sometimes,
// never "Required", and `notCovered` renders directly under the hero rather
// than as a footer disclaimer, because what a page like this leaves out is the
// honest half of it.
//
// The "whole set at once" button is the Pro packet — ship 2 of Phase 3. It is
// shown on every task with more than one form, and the page behind it decides
// who may run it; a single-form task has nothing to batch, so it has no button.
// The per-form buttons below it stay free, deliberately: the paid thing is
// SCALE, not quality.

export function generateStaticParams() {
  return FORM_TASKS.map((t) => ({ task: t.slug }));
}

export async function generateMetadata(props: { params: Promise<{ task: string }> }): Promise<Metadata> {
  const { task } = await props.params;
  const t = getFormTask(task);
  if (!t) return {};
  const shorts = t.forms.map((tf) => formFor(tf)?.short).filter(Boolean).join(', ');
  return {
    title: `${t.seoTitle ?? t.title} — the forms involved | DiemDesk`,
    description: `${t.forms.length} federal forms turn up in this: ${shorts}. What each one is for, who fills it in, where it goes, and the version the agency publishes today. Fill them in your browser — nothing is uploaded.`,
    alternates: { canonical: `/forms/${t.slug}` },
    openGraph: {
      images: ['/og.png'],
      title: `${t.title} — which forms, who files them, where they go`,
      description: `The set in the order it happens, each form linked to its issuing agency, each one a click from being filled on your own device.`,
      type: 'website',
    },
  };
}

const PILL: Record<Applies, string> = {
  always:
    'border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  usually:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-500',
  sometimes: 'border-border bg-muted text-muted-foreground',
};

function Custody({ label, value, icon: Icon }: { label: string; value: string; icon: typeof PenLine }) {
  return (
    <div className="min-w-0 bg-card p-2.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 text-[13px] leading-snug">{value}</dd>
    </div>
  );
}

export default async function Page(props: { params: Promise<{ task: string }> }) {
  const { task } = await props.params;
  const t = getFormTask(task);
  if (!t) notFound();

  const authorities = authoritiesFor(t);
  const others = FORM_TASKS.filter((o) => o.slug !== t.slug).slice(0, 6);

  // "connected to Social Security Administration" is missing a word, and
  // joining the list with "or" and THEN appending "or any other government
  // agency" says "or" twice. Both read wrong on the page and neither is
  // visible in the data, so the article and the tail live here, once.
  const named = authorities.map((a) => `the ${a}`);
  const noticeSubject = listJoin([...named, 'any other government agency'], 'or');

  // ItemList rather than HowTo, deliberately. HowTo would assert to a search
  // engine that this page gives step-by-step instructions for completing a
  // legal process, which is the exact claim §3 of the spec forbids us from
  // making. A list of documents is what the page actually is.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${t.title} — the federal forms involved`,
        description: t.what,
        url: `https://diemdesk.com/forms/${t.slug}`,
        isPartOf: { '@type': 'CollectionPage', name: 'Government forms', url: 'https://diemdesk.com/forms' },
      },
      {
        '@type': 'ItemList',
        name: `Forms involved in: ${t.title}`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: t.forms.length,
        itemListElement: t.forms
          .map((tf, i) => {
            const f = formFor(tf);
            if (!f) return null;
            return {
              '@type': 'ListItem',
              position: i + 1,
              name: f.name,
              description: tf.role,
              url: `https://diemdesk.com/us-forms/${f.slug}`,
            };
          })
          .filter(Boolean),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <nav className="text-xs text-muted-foreground">
          <Link href="/forms" className="underline-offset-2 hover:underline">
            Government forms
          </Link>{' '}
          / <span className="text-foreground">{t.title}</span>
        </nav>

        {/* ── hero ─────────────────────────────────────────────────────── */}
        <header className="mt-5 sm:flex sm:items-start sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t.audience}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t.what}</p>
          </div>

          {/* Two clocks, never merged. The weekly job moves the first; only a
              person moves the second. See lib/form-tasks.ts. */}
          <dl className="mt-5 flex shrink-0 gap-2 sm:mt-0 sm:w-40 sm:flex-col">
            <div className="flex-1 rounded-lg border bg-card p-2.5">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Form versions
              </dt>
              <dd className="mt-0.5 text-xs font-medium">
                <CheckedAgo prefix="Checked" />
              </dd>
            </div>
            <div className="flex-1 rounded-lg border bg-card p-2.5">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                This set reviewed
              </dt>
              <dd className="mt-0.5 text-xs font-medium tabular-nums">
                <time dateTime={t.reviewedOn}>{reviewedOnLabel(t.reviewedOn)}</time>
              </dd>
            </div>
          </dl>
        </header>

        {/* ── ⚠ what this page does not cover. Above the fold on purpose. ── */}
        <section className="mt-7 flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 dark:border-amber-500/25 dark:bg-amber-950/10">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">What this page does not cover.</b> {t.notCovered}
          </p>
        </section>

        {/* ── the whole set at once ────────────────────────────────────
            Deliberately BELOW what the page does not cover, and above the set
            itself: somebody who is going to fetch all of them has already
            decided, and somebody who is still reading has lost nothing. The
            per-form buttons further down stay free — this is the shortcut, not
            the only door. */}
        {t.forms.length > 1 && (
          <section className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Get all {t.forms.length} in one go
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Type the details that repeat once, and they land in every box we have read on these forms.
                Pro.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/forms/${t.slug}/packet`}>
                Open the whole set <ArrowRight className="size-4" />
              </Link>
            </Button>
          </section>
        )}

        {/* ── the set ──────────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-bold tracking-tight">
              The {t.forms.length === 1 ? 'form' : 'set'}, in the order it happens
            </h2>
            <span className="text-xs text-muted-foreground">{t.order}</span>
          </div>

          <ol className="relative mt-6 space-y-3">
            {/* The spine. Numbering here is information, not decoration: the
                order is the order things actually occur in. */}
            {t.forms.length > 1 && (
              <span
                aria-hidden
                className="absolute bottom-10 left-[15px] top-3 w-px bg-border"
              />
            )}

            {t.forms.map((tf, i) => {
              const f = formFor(tf);
              if (!f) return null;
              const host = new URL(f.officialUrl).hostname.replace(/^www\./, '');
              return (
                <li key={tf.slug} className="relative pl-11">
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 grid size-8 place-items-center rounded-full border bg-background text-xs font-semibold tabular-nums text-muted-foreground"
                  >
                    {i + 1}
                  </span>

                  <article className="rounded-xl border bg-card p-4 shadow-soft">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <Link
                        href={`/us-forms/${f.slug}`}
                        className="text-base font-semibold tracking-tight underline-offset-4 hover:underline"
                      >
                        {f.name}
                      </Link>
                      <span
                        className={`rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${PILL[tf.applies]}`}
                      >
                        {APPLIES_LABEL[tf.applies]}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tf.role}</p>
                    {tf.condition && (
                      <p className="mt-2 text-sm leading-relaxed text-amber-700 dark:text-amber-500">
                        {tf.condition}
                      </p>
                    )}

                    {/* The useful column. Not always the agency. */}
                    <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
                      <Custody label="Filled in by" value={tf.filedBy} icon={PenLine} />
                      <Custody label="Goes to" value={tf.goesTo} icon={Send} />
                      <Custody
                        label={f.revisionLabel}
                        value={`${f.revision} · ${f.fields} fields`}
                        icon={ShieldCheck}
                      />
                    </dl>

                    <div className="mt-3.5">
                      <GetFormButton
                        slug={f.slug}
                        short={f.short}
                        officialUrl={f.officialUrl}
                        authority={f.authority}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Fetched from the {f.authority} when you click, never stored by us.{' '}
                      <a
                        href={f.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        Check it on {host}
                      </a>
                      .
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ── the mistake the SET produces ─────────────────────────────── */}
        <section className="mt-10 border-l-[3px] border-rose-600/60 pl-4 dark:border-rose-500/50">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 dark:text-rose-400">
            The mistake this set produces
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.gotcha}</p>
        </section>

        {/* ── provenance ───────────────────────────────────────────────── */}
        <section className="mt-10 rounded-xl border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold">Where this comes from</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Every form above is linked to the page its own issuing authority publishes, and the version
            marker beside it was read off the document itself rather than copied from anywhere —{' '}
            {authorities.length === 1 ? 'the authority here is ' : 'the authorities here are '}
            {listJoin(named)}. The two dates at the top of this page measure two different
            things: a scheduled job re-reads every version weekly, and the second date is the last time
            a person checked that this is still the set this task involves.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">Explainers, not legal or tax advice.</b> This page says which
            federal forms turn up and who fills each one in. It does not say what anyone has to do,
            because that depends on circumstances a page cannot see. We host no copies of any form and we
            file nothing on anybody&rsquo;s behalf.
          </p>
        </section>

        <ThirdPartyNotice
          className="mt-3"
          subject={noticeSubject}
          because="Each form is named with its issuing authority so you can go to the source and check the current version yourself"
        />

        {/* ── other tasks ──────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Other things people come here to do</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/forms/${o.slug}`}
                  className="flex h-full flex-col gap-1 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/50"
                >
                  <span className="text-sm font-semibold leading-snug">{o.title}</span>
                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                    {o.forms
                      .map((tf) => formFor(tf)?.short)
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/forms">
                All forms and tasks <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/us-forms">
                Browse by form number <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
