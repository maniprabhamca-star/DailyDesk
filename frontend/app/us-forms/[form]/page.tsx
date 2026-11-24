import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Hash, Layers, ShieldAlert } from 'lucide-react';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { US_FORMS, CHECKED_ON_LABEL, getUsForm, revisionSentence, revisionHeading } from '@/lib/us-forms';
import { CheckedAgo } from '@/components/forms/checked-ago';
import { catalog } from '@/components/app/catalog';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { GetFormButton } from '@/components/app/get-form-button';
import { tasksForForm } from '@/lib/form-tasks';

export function generateStaticParams() {
  return US_FORMS.map((f) => ({ form: f.slug }));
}

const ALL_TOOLS = catalog.flatMap((g) => g.tools);
const toolHref = (name: string) => ALL_TOOLS.find((t) => t.name === name)?.href;
const FILL_HREF = toolHref('Fill PDF form') ?? '/fill-pdf-form';


export async function generateMetadata(props: { params: Promise<{ form: string }> }): Promise<Metadata> {
  const params = await props.params;
  const f = getUsForm(params.form);
  if (!f) return {};
  return {
    title: `Fill Form ${f.short} Free — Nothing Uploaded | DiemDesk`,
    description: `Form ${f.short} (${f.revisionLabel} ${f.revision}): what it is, who files it, and what people get wrong. Fill its ${f.fields} fields in your browser — the file never leaves your device.`,
    alternates: { canonical: `/us-forms/${f.slug}` },
    openGraph: {
      images: ['/og.png'],
      title: `Form ${f.short} explained, and filled privately — DiemDesk`,
      description: `What Form ${f.short} is, who files it, and the mistake that costs people the most.`,
      type: 'website',
    },
  };
}

export default async function Page(props: { params: Promise<{ form: string }> }) {
  const params = await props.params;
  const f = getUsForm(params.form);
  if (!f) notFound();

  const related = US_FORMS.filter((o) => o.group === f.group && o.slug !== f.slug).slice(0, 8);
  const inTasks = tasksForForm(f.slug, 'us');
  const host = new URL(f.officialUrl).hostname.replace(/^www\./, '');

  return (
    <KeywordLanding
      h1={`Form ${f.short}${f.aka ? ` — ${f.aka}` : ''}`}
      lede={`${f.what} ${revisionSentence(f)}. It has ${f.fields} fillable fields across ${f.pages} ${f.pages === 1 ? 'page' : 'pages'}. You can fill every one of them here, in your browser, without the file going anywhere.`}
      ctaHref={FILL_HREF}
      ctaLabel={`Fill Form ${f.short} in your browser`}
      cta={
        <GetFormButton
          slug={f.slug}
          short={f.short}
          officialUrl={f.officialUrl}
          authority={f.authority}
          toolHref={FILL_HREF}
        />
      }
      bullets={[
        `${f.revisionLabel} ${f.revision} — checked against the ${f.authority} on ${CHECKED_ON_LABEL}`,
        `${f.fields} fillable fields, counted on the actual file`,
        'Typed in your browser: no upload, no account, no copy kept',
        'The current form always comes from the authority — we never host one',
      ]}
      body={
        <>
          {/* The provenance strip. This is the whole difference between this page
              and a hosted copy with an "official form" badge and no source. */}
          <dl className="grid grid-cols-3 gap-3 rounded-xl border bg-card p-4 text-center">
            <div>
              <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5" /> {revisionHeading(f)}
              </dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{f.revision}</dd>
            </div>
            <div>
              <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Hash className="size-3.5" /> Fields
              </dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{f.fields}</dd>
            </div>
            <div>
              <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="size-3.5" /> Pages
              </dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{f.pages}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Measured on the file the {f.authority} was serving, not copied from anywhere.{' '}
            <CheckedAgo prefix="Checked" />.{' '}
            <a href={f.officialUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Check it on {host}
            </a>
            .
          </p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">Who files Form {f.short}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.who}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">When</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.when}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">The thing people get wrong</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.gotcha}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">What you are typing into it</h2>
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 dark:border-amber-500/25 dark:bg-amber-950/10">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Form {f.short} carries {f.sensitive}.{' '}
              <b className="text-foreground">
                That is the reason to care where you fill it in.
              </b>{' '}
              A browser-based editor that works by uploading usually sends the whole file to a server, processes it
              there, and sends it back. Ours opens and rewrites the PDF inside the page itself, on your own machine.
              You can confirm it: open your browser&rsquo;s Network tab before you pick the file, and no request
              carrying it will appear.
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <Link href={FILL_HREF} className="font-medium text-primary underline underline-offset-2">
              Fill PDF form
            </Link>{' '}
            reads the {f.fields} fields out of the file you downloaded from the {f.authority} and lets you type into
            them, then writes a new PDF. Nothing is stored, and closing the tab is the whole cleanup.
          </p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">Where to get the current Form {f.short}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            From {f.officialName}:{' '}
            <a
              href={f.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              {f.authority}
            </a>
            . We deliberately do not host a copy of any federal form. They are revised without notice, and a stale
            file served from here would be worse than none, because it would look current. What we do instead is state
            the revision we verified and when we verified it, so you can tell at a glance whether this page has kept
            up.
          </p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">Tools for the paperwork around it</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Filling the form is rarely the whole job. Something has to be signed, a supporting scan has to come in
            under an upload cap, two documents have to become one file, or an account number has to come out before
            anything gets forwarded. All of these run on your device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {f.tools.map((name) => {
              const href = toolHref(name);
              return href ? (
                <Link
                  key={name}
                  href={href}
                  className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {name}
                </Link>
              ) : null;
            })}
          </div>

          {/* Up into the finder. A form number is one answer to a question; the
              task pages are the question, and most people have the question
              before they have the number. Derived from lib/form-tasks.ts, so
              there is no second list to keep in step. */}
          {inTasks.length > 0 && (
            <>
              <h2 className="mt-8 text-xl font-bold tracking-tight">
                What Form {f.short} usually turns up alongside
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Few forms arrive alone. These pages set out the whole set for the job, in the order it
                happens, and say who fills each one in and where it goes.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {inTasks.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/forms/${t.slug}`}
                      className="flex h-full flex-col gap-1 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/50"
                    >
                      <span className="text-sm font-semibold leading-snug">{t.title}</span>
                      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                        {t.forms
                          .map((tf) => US_FORMS.find((o) => o.slug === tf.slug)?.short)
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {related.length > 0 && (
            <>
              <h2 className="mt-8 text-xl font-bold tracking-tight">Other forms in this group</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {related.map((o) => (
                  <Link key={o.slug} href={`/us-forms/${o.slug}`} className="text-primary hover:underline">
                    Form {o.short}
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">A plain-English explainer, not tax or legal advice.</b> Filing dates,
            thresholds and eligibility change, and are extended more often than not, so treat anything here as
            orientation and the {f.authority} as the authority. We do not host copies of federal forms, and we do
            not file anything on your behalf.
          </div>
          <ThirdPartyNotice
            className="mt-3"
            subject={`the ${f.authority} or any other government agency`}
            because={`Form ${f.short} and the ${f.authority} are named so you can go to the source and check the revision for yourself`}
          />
        </>
      }
      faqs={[
        { q: `What is Form ${f.short}?`, a: f.what },
        { q: `Who has to file Form ${f.short}?`, a: f.who },
        {
          q: `Which revision of Form ${f.short} is current?`,
          a: `${f.revisionLabel} ${f.revision}, as published by the ${f.authority} and checked by us on ${CHECKED_ON_LABEL}. We state the date because a revision without one is just an assertion — and federal forms are revised without notice. Download it from ${f.officialName} rather than from us.`,
        },
        {
          q: `Can I fill Form ${f.short} without uploading it anywhere?`,
          a: `Yes, and that is the point of doing it here. Form ${f.short} has ${f.fields} fillable fields; our Fill PDF form tool reads them and writes the completed PDF inside your browser, on your own device. There is no upload step and no account. Open the Network tab first if you want to watch it not happen.`,
        },
        {
          q: `Do you host a copy of Form ${f.short}?`,
          a: `No, deliberately. A federal form revised without notice and served stale from our domain would be worse than no copy, because it would look current and someone would file it. Every page here links to the issuing authority instead and shows the revision we verified.`,
        },
        {
          q: `Can DiemDesk file Form ${f.short} for me?`,
          a: `No. These are document tools, not a filing service, and nothing here is submitted to any agency on your behalf. What we help with is preparing the paperwork — filling, signing, combining, compressing and redacting — and then you file it yourself.`,
        },
      ]}
    />
  );
}
