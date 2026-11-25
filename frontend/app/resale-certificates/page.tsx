import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, ShieldCheck, FileText, CircleCheck, CircleAlert, CircleSlash, Minus } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { CheckedAgo } from '@/components/forms/checked-ago';
import {
  JURISDICTIONS, STATUS_ORDER, STATUS_LABEL, STATUS_BLURB, byStatus, MTC,
  MTC_REVISION, MTC_PAGES, MTC_FIELDS, MTC_BOXES, MTC_NOTES, MTC_CLAIMED_STATES,
  NEEDS_OWN_FORM, NO_SALES_TAX, CHECKED_ON, JURISDICTION_COUNT, SEO_TITLE, SEO_DESCRIPTION,
  type MtcStatus,
} from '@/lib/resale-certificates';

// Matrix 1 — one form type, every jurisdiction, one URL.
//
// ⚠ ONE URL, deliberately. 51 rows is exactly the size that tempts a ?page=2,
// and splitting it would destroy the page: the whole value is that a seller
// scans the grid and finds their customer's state without a second request.
// Progressive disclosure here means grouping by verdict, not paginating.
//
// Counts are derived from lib/resale-certificates.ts and never typed. A matrix
// whose headline disagrees with its own rows is invisible on the page and
// obvious to the one reader who checks.

const accepted = byStatus('accepted');
const conditional = byStatus('conditional');
const resaleOnly = byStatus('resale-only');
const absent = byStatus('absent');
const qualified = conditional.length + resaleOnly.length;

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  alternates: { canonical: '/resale-certificates' },
  openGraph: {
    images: ['/og.png'],
    title: 'Resale certificates, state by state — DiemDesk',
    description:
      `${MTC_BOXES} jurisdictions take the MTC uniform resale certificate, but ${qualified} of them attach a condition. The conditions are the page.`,
    type: 'website',
  },
};

const ICON: Record<MtcStatus, typeof CircleCheck> = {
  accepted: CircleCheck,
  conditional: CircleAlert,
  'resale-only': CircleSlash,
  absent: Minus,
};

const TONE: Record<MtcStatus, string> = {
  accepted: 'text-emerald-700 dark:text-emerald-400',
  conditional: 'text-amber-700 dark:text-amber-400',
  'resale-only': 'text-orange-700 dark:text-orange-400',
  absent: 'text-muted-foreground',
};

function Row({ j }: { j: (typeof JURISDICTIONS)[number] }) {
  const Icon = ICON[j.status];
  return (
    <li id={j.slug} className="grid gap-x-4 gap-y-1 border-t px-4 py-3.5 sm:grid-cols-[11rem_1fr] sm:py-3">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[j.status]}`} aria-hidden />
        <div className="min-w-0">
          <a
            href={j.authorityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold decoration-dotted underline-offset-4 hover:underline"
          >
            {j.name}
          </a>
          <span className="ml-1.5 align-[0.1em] text-[11px] font-bold tracking-wide text-muted-foreground tabular-nums">
            {j.code}
          </span>
        </div>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground sm:pt-0.5">
        {j.limit ? (
          <>
            {j.limit}
            {j.notes?.length ? (
              <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted-foreground/70 tabular-nums">
                note{j.notes.length > 1 ? 's' : ''} {j.notes.join(', ')}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground/70">Listed with nothing attached.</span>
        )}
        <span className="mt-0.5 block text-[11px] text-muted-foreground/60">{j.authority}</span>
      </div>
    </li>
  );
}

function Group({ status }: { status: MtcStatus }) {
  const rows = byStatus(status);
  const Icon = ICON[status];
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-muted/40 px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <Icon className={`size-4 ${TONE[status]}`} aria-hidden />
          {STATUS_LABEL[status]}
        </h3>
        <span className="text-sm font-bold tabular-nums text-muted-foreground">{rows.length}</span>
        <p className="w-full text-[13px] leading-relaxed text-muted-foreground">{STATUS_BLURB[status]}</p>
      </header>
      <ul>{rows.map((j) => <Row key={j.code} j={j} />)}</ul>
    </section>
  );
}

export default function ResaleCertificatesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[13px] font-bold uppercase tracking-wider text-primary">Sales &amp; use tax</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Resale certificates, state by state
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          One certificate covers most of the country. Which is useful right up to the point where
          your customer is in a state that reads it differently — and {qualified} of the{' '}
          {MTC_BOXES} that take it attach a condition. Those conditions are this page.
        </p>

        {/* The header row. A matrix needs one form that answers most of the grid;
            this is it, and the measured numbers are the provenance argument. */}
        <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            The form most of them accept
          </p>
          <h2 className="mt-1.5 text-xl font-bold">{MTC.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Published by the {MTC.authority}, a compact of state tax agencies. One form, filled once,
            carrying a registration number for each state a seller ships into. {MTC_REVISION}.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:grid-cols-4">
            {[
              ['Jurisdiction boxes', MTC_BOXES],
              ['Numbered notes', MTC_NOTES],
              ['Pages', MTC_PAGES],
              ['Fillable fields', MTC_FIELDS],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="text-xl font-black tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Counted on the published PDF &mdash;{' '}
            <CheckedAgo checkedOn={CHECKED_ON} prefix="checked" /> &mdash; not taken from a summary. Worth one note of our own: the Commission&rsquo;s page says{' '}
            {MTC_CLAIMED_STATES} states accept it, while the certificate prints {MTC_BOXES} boxes —{' '}
            {MTC_BOXES - 1} states plus the Alaska Remote Sellers Sales Tax Commission, which is a
            municipal body rather than a state revenue department. We publish what the form prints.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild>
              <a href={MTC.officialUrl} target="_blank" rel="noopener noreferrer">
                Open it at the MTC <ExternalLink className="ml-1.5 size-4" aria-hidden />
              </a>
            </Button>
            <span className="text-[13px] text-muted-foreground">
              We host no copy of it. The link goes to the Commission&rsquo;s own page.
            </span>
          </div>
        </section>

        {/* The finding, before the grid. A reader who stops here still leaves
            with the thing that is actually counter-intuitive. */}
        <section className="mt-8 rounded-2xl border border-dashed bg-muted/30 p-5 sm:p-6">
          <h2 className="text-lg font-bold">What the grid actually says</h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <b className="text-foreground">{resaleOnly.length} take it for resale and nothing else.</b>{' '}
              Their notes say in terms that it is not valid as an exemption certificate. A seller who
              files it against some other exemption has a piece of paper that does not cover the sale.
            </li>
            <li>
              <b className="text-foreground">Four will not let it cover a service bought for resale</b>{' '}
              — Colorado, Hawaii, Illinois and New Mexico share a single note on that point.
            </li>
            <li>
              <b className="text-foreground">Florida wants a second thing.</b> The form, plus a resale
              authorisation number the selling dealer gets from the Department of Revenue.
            </li>
            <li>
              <b className="text-foreground">Hawaii runs the other way round.</b> There the seller uses
              it to claim a lower general excise rate, rather than the buyer claiming an exemption.
            </li>
            <li>
              <b className="text-foreground">{absent.length} are not on it at all</b> — {NO_SALES_TAX.length}{' '}
              of those have no general state sales tax, so there is nothing to certify. The other{' '}
              {NEEDS_OWN_FORM.length} tax sales and publish their own certificate.
            </li>
          </ul>
        </section>

        <h2 className="mt-12 text-2xl font-black tracking-tight">
          All {JURISDICTION_COUNT} jurisdictions
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Grouped by how each one treats the certificate, because the grouping is the answer. Every
          name links to that jurisdiction&rsquo;s own revenue department. Note numbers refer to the
          notes printed on pages 2&ndash;6 of the certificate.
        </p>

        {STATUS_ORDER.map((s) => <Group key={s} status={s} />)}

        {/* The boundary, stated rather than implied. */}
        <section className="mt-12 rounded-2xl border p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> What this page does not do
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            It describes a document and what each revenue department has said about accepting it. It
            does not work out whether a particular sale is exempt, whether a business has nexus in a
            state, or which certificate fits a transaction. Those turn on facts about the business
            and the sale, they are questions for a tax adviser or the department itself, and this is
            a document tool. Rules change between re-checks; the department&rsquo;s own page is the
            record, which is why every row links to it.
          </p>
        </section>

        <div className="mt-8">
          <ThirdPartyNotice
            subject="the Multistate Tax Commission and the state revenue departments named here"
            because="to describe a published form and where each department says it may be used"
          />
        </div>

        <section className="mt-12 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FileText className="size-4 text-primary" aria-hidden /> Filling it in
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The certificate has {MTC_FIELDS} fillable fields and carries a registration number for
            every state a business ships into — which makes it exactly the kind of document people
            paste into a cloud editor without thinking. Ours fills it in the browser, and nothing
            about the business leaves the device.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/fill-pdf-form">Fill a PDF form</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/forms">All government forms</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
