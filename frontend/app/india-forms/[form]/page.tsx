import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { INDIA_FORMS, getForm } from '@/lib/india-forms';
import { catalog } from '@/components/app/catalog';

export function generateStaticParams() {
  return INDIA_FORMS.map((f) => ({ form: f.slug }));
}

const ALL_TOOLS = catalog.flatMap((g) => g.tools);
const toolHref = (name: string) => ALL_TOOLS.find((t) => t.name === name)?.href;

export function generateMetadata({ params }: { params: { form: string } }): Metadata {
  const f = getForm(params.form);
  if (!f) return {};
  return {
    title: `${f.short} — What It Is & Who Files It | DiemDesk`,
    description: `${f.short}: what it is, who files it, and the mistake people make. Plus the free on-device tools for the PDFs around it — nothing uploaded.`,
    alternates: { canonical: `/india-forms/${f.slug}` },
    openGraph: {
      images: ['/og.png'],
      title: `${f.name} explained — DiemDesk`,
      description: `What ${f.short} is, who files it, and what people get wrong.`,
      type: 'website',
    },
  };
}

export default function Page({ params }: { params: { form: string } }) {
  const f = getForm(params.form);
  if (!f) notFound();

  const related = INDIA_FORMS.filter((o) => o.group === f.group && o.slug !== f.slug).slice(0, 6);

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
            orientation and the {f.authority} as the authority. DiemDesk is not affiliated with or endorsed by any
            government department, and we do not file anything on your behalf.
          </div>
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
