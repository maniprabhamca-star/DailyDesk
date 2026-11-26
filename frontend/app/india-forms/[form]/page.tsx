import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { INDIA_FORMS, getForm, INDIA_SEO } from '@/lib/india-forms';
import { tasksForForm } from '@/lib/form-tasks';
import { catalog } from '@/components/app/catalog';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';

export function generateStaticParams() {
  return INDIA_FORMS.map((f) => ({ form: f.slug }));
}

const ALL_TOOLS = catalog.flatMap((g) => g.tools);
const toolHref = (name: string) => ALL_TOOLS.find((t) => t.name === name)?.href;

export async function generateMetadata(props: { params: Promise<{ form: string }> }): Promise<Metadata> {
  const params = await props.params;
  const f = getForm(params.form);
  if (!f) return {};
  // ⚠ Per-form, not templated. One shared title string left this library at
  // average position 47.7 on 1,186 impressions — 54% of the site's total — for
  // a single click, and titled its biggest page "Form 19" while the queries
  // were "epf form 19" and "pf form 19". See INDIA_SEO in lib/india-forms.ts.
  //
  // The fallback uses `name`, never `short`: `short` is the index-page label
  // and drops the EPF/PF qualifier that is the whole search term.
  const seo = INDIA_SEO[f.slug];
  return {
    title: seo?.title ?? `${f.name} — What It Is & Who Files It`,
    description:
      seo?.description ??
      `${f.name}: what it is, who files it, and the mistake people make. Plus the free on-device tools for the PDFs around it — nothing uploaded.`,
    alternates: { canonical: `/india-forms/${f.slug}` },
    openGraph: {
      images: ['/og.png'],
      title: `${f.name} explained — DiemDesk`,
      description: `What ${f.short} is, who files it, and what people get wrong.`,
      type: 'website',
    },
  };
}

export default async function Page(props: { params: Promise<{ form: string }> }) {
  const params = await props.params;
  const f = getForm(params.form);
  if (!f) notFound();

  const related = INDIA_FORMS.filter((o) => o.group === f.group && o.slug !== f.slug).slice(0, 6);
  // Scoped to the India library: the two catalogues share no slug today, but
  // an unscoped lookup would answer a future collision with the wrong
  // country's task rather than with a build failure.
  const inTasks = tasksForForm(f.slug, 'india');

  return (
    <KeywordLanding
      h1={`${f.name}${f.aka ? ` — ${f.aka}` : ''}`}
      lede={`${f.what} Issued and governed by the ${f.authority}. Below: who files it, when, and the mistake that costs people the most — plus the free tools for the PDFs that come with it, all of which run on your device.`}
      ctaHref="/#tools"
      ctaLabel="Open the tools"
      bullets={[
        `Who files it, when, and what people get ${f.short} wrong`,
        'The current form always comes from the authority — we never host a copy',
        'Combine, compress, scan and redact the paperwork around it, free',
        'Everything runs in your browser — no upload, no account',
      ]}
      body={
        <>
          <h2 className="mt-8 text-xl font-bold tracking-tight">Who files {f.short}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.who}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">When</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.when}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">The thing people get wrong</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.gotcha}</p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">Where to get the current {f.short}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            From {f.officialName}.{' '}
            <a
              href={f.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              {f.authority}
            </a>
            . We deliberately do not host a copy of any government form. They are revised without notice, and a stale
            file served from here would be worse than none — you would file it and find out months later.
          </p>

          <h2 className="mt-8 text-xl font-bold tracking-tight">The tools people need around {f.short}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {f.short} is filed with the authority, not with us. What we do is the document work around it — the part
            where a payroll portal caps uploads at a few megabytes, or two certificates have to become one file, or a
            statement has to become rows you can total.
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

          {inTasks.length > 0 && (
            <>
              <h2 className="mt-8 text-xl font-bold tracking-tight">
                What {f.short} usually turns up alongside
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Few of these arrive alone. These pages set out the whole set for the job, in the order
                it happens, and say who fills each one in — including the ones issued to you, where
                there is nothing to fill in at all.
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
                          .map((tf) => INDIA_FORMS.find((o) => o.slug === tf.slug)?.short)
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
              <h2 className="mt-8 text-xl font-bold tracking-tight">Other {f.group.toLowerCase()} forms</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {related.map((o) => (
                  <Link key={o.slug} href={`/india-forms/${o.slug}`} className="text-primary hover:underline">
                    {o.short}
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 text-sm leading-relaxed text-muted-foreground dark:border-amber-500/25 dark:bg-amber-950/10">
            <b className="text-foreground">This is a plain-English explainer, not tax advice.</b> Deadlines,
            thresholds and eligibility change every year and are frequently extended, so treat the dates here as
            orientation and the {f.authority} as the authority. We do not file anything on your behalf.
          </div>
          <ThirdPartyNotice
            className="mt-3"
            subject={`the ${f.authority} or any other government department`}
            because={`${f.name} and the ${f.authority} are named so you can go to the source and check it for yourself`}
          />
        </>
      }
      faqs={[
        {
          q: `What is ${f.short}?`,
          a: `${f.what}`,
        },
        {
          q: `Who needs to file ${f.short}?`,
          a: `${f.who}`,
        },
        {
          q: `Where do I download ${f.short}?`,
          a: `From ${f.officialName} — see ${f.authority}. We do not host a copy: government forms are revised without notice, and a stale copy is worse than none.`,
        },
        {
          q: `Can DiemDesk file ${f.short} for me?`,
          a: `No, and nothing here does. We are document tools, not a filing service. What we help with is the paperwork around the filing — combining certificates, compressing a scan under a portal's upload limit, turning a statement into a spreadsheet, or redacting an account number before you forward something. All of it runs in your browser.`,
        },
        {
          q: `Are my documents uploaded?`,
          a: `No. The in-browser tools open and rebuild the file on your own device, so a Form 16 or a bank statement never leaves it. Open your browser's Network tab and you will see no request carrying the file.`,
        },
      ]}
    />
  );
}
