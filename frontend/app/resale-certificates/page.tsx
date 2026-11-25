import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ExternalLink, ShieldCheck, FileText, CircleCheck, CircleAlert, CircleSlash, Minus,
  Landmark, Layers, EyeOff,
} from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { Button } from '@/components/ui/button';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';
import { CheckedAgo } from '@/components/forms/checked-ago';
import {
  JURISDICTIONS, STATUS_ORDER, STATUS_LABEL, STATUS_BLURB, byStatus, MTC,
  MTC_REVISION, MTC_PAGES, MTC_FIELDS, MTC_BOXES, MTC_NOTES, MTC_CLAIMED_STATES,
  NEEDS_OWN_FORM, NO_SALES_TAX, CHECKED_ON, JURISDICTION_COUNT, SEO_TITLE, SEO_DESCRIPTION,
  SST, SST_MEMBERS, isSstMember, ownCert, OWN_FORM_COUNT, OWN_FORM_FIELDS, STILL_UNANSWERED,
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
const sstCount = Object.keys(SST_MEMBERS).length;
const sstFull = Object.values(SST_MEMBERS).filter((t) => t === 'full').length;

// How the jurisdictions the MTC form misses actually resolve. Derived, because
// the whole point of ship 2 is that these four groups are different shapes and
// a hand-typed "they publish their own" was wrong about two of them.
const absentWithForm = NEEDS_OWN_FORM.filter((j) => ownCert(j.code)?.kind === 'form');
const absentSstOnly = NEEDS_OWN_FORM.filter((j) => isSstMember(j.code) && !ownCert(j.code));

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

// What the jurisdiction publishes of its own, under the MTC verdict.
//
// ⚠ The four shapes are NOT cosmetic variants. Rendering them all as a link
// would tell a reader in Mississippi to go and download a document that does
// not exist. `kind` decides the sentence, not just the icon — which is the
// same reason the India task pages carry `howFiled`.
//
// The eleven downloadable blanks get a compact chip, because there a reader
// wants the form number and whether it is fillable. The four that are issued,
// absent, or unread get a full sentence, because there the explanation IS the
// answer and a chip would flatten it back into a false yes.
function OwnLine({ code }: { code: string }) {
  const own = ownCert(code);
  const sst = isSstMember(code);
  if (!own && !sst) return null;

  const chip =
    'inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[11px] font-semibold';

  return (
    <div className="mt-2 space-y-1.5">
      {(own?.kind === 'form' || sst) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {own?.kind === 'form' && (
            <a
              href={own.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${chip} hover:border-primary/60 hover:text-primary`}
            >
              <FileText className="size-3 shrink-0" aria-hidden />
              {own.number}
              {own.revision ? (
                <span className="font-normal text-muted-foreground">{own.revision}</span>
              ) : null}
              {/* A separator, because without one Massachusetts reads
                  "Rev. 8/16 17 fields" and the two numbers run together. */}
              {own.revision ? <span className="text-muted-foreground/40" aria-hidden>&middot;</span> : null}
              <span className="font-normal text-muted-foreground tabular-nums">
                {own.fields > 0 ? `${own.fields} fields` : 'print and sign'}
              </span>
            </a>
          )}
          {sst && (
            <span className={`${chip} border-dashed text-muted-foreground`} title={SST.name}>
              <Layers className="size-3 shrink-0" aria-hidden />
              Streamlined {SST.number.replace('SSTGB Form ', '')}
            </span>
          )}
        </div>
      )}

      {own?.kind === 'issued' && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <Landmark className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
          {own.how}{' '}
          <a
            href={own.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold decoration-dotted underline-offset-2 hover:underline"
          >
            The department&rsquo;s page
            <ExternalLink className="ml-0.5 inline size-3 align-[-0.1em]" aria-hidden />
          </a>
        </p>
      )}

      {own?.kind === 'none' && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <CircleSlash className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
          {own.why}{' '}
          <a
            href={own.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold decoration-dotted underline-offset-2 hover:underline"
          >
            The department&rsquo;s own answer
            <ExternalLink className="ml-0.5 inline size-3 align-[-0.1em]" aria-hidden />
          </a>
        </p>
      )}

      {/* No link, deliberately. See the note on OwnCert in the library. */}
      {own?.kind === 'unverified' && (
        <p className="text-[12px] leading-relaxed text-muted-foreground/80">
          <EyeOff className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
          {own.why}
        </p>
      )}
    </div>
  );
}

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
        <OwnLine code={j.code} />
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

        {/* ⭐ The second header row. Deliberately quieter than the MTC card and
            with a text link rather than a second filled button — one filled
            button per screen, and this is the alternative route, not the
            headline. Its reason for being here is the last line: it covers
            three jurisdictions the first form does not. */}
        <section className="mt-4 rounded-2xl border border-dashed bg-muted/20 p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            And a second one, for {sstCount} of them
          </p>
          <h2 className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-lg font-bold">
            <Layers className="size-4 self-center text-primary" aria-hidden />
            {SST.name}
            <span className="text-[13px] font-semibold text-muted-foreground">{SST.number}</span>
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A separate compact, the {SST.authority}, publishes its own certificate. Every
            Streamlined member state takes it &mdash; {sstFull} full members and Tennessee as an
            associate. {SST.revision}, {SST.pages} pages, {SST.fields} fillable fields.
          </p>
          <p className="mt-3 rounded-xl border bg-background/60 p-3 text-[13px] leading-relaxed">
            <b>Why it is on this page:</b> three of the {NEEDS_OWN_FORM.length} taxing
            jurisdictions missing from the MTC certificate &mdash; Indiana, West Virginia and
            Wyoming &mdash; are Streamlined members. For a seller shipping there, the grid above
            has no answer and this form does.
          </p>
          <a
            href={SST.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center text-sm font-semibold text-primary decoration-dotted underline-offset-4 hover:underline"
          >
            Open it at the Governing Board
            <ExternalLink className="ml-1.5 size-4" aria-hidden />
          </a>
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
              {NEEDS_OWN_FORM.length} tax sales, and what they do instead is not one thing:{' '}
              {absentWithForm.length} publish a certificate of their own, {absentSstOnly.length} are
              have no certificate of their own and go through the Streamlined form above,
              Louisiana issues one per business rather than publishing a blank, and one publishes
              nothing at all.
            </li>
            <li>
              <b className="text-foreground">Mississippi has no resale certificate.</b> Not a
              missing link — the Department of Revenue says it does not accept or use blanket
              certificates. What a buyer holds there is a permit or a letter the department issued,
              which is a different object with a different lifespan.
            </li>
          </ul>
        </section>

        <h2 className="mt-12 text-2xl font-black tracking-tight">
          All {JURISDICTION_COUNT} jurisdictions
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Grouped by how each one treats the certificate, because the grouping is the answer. Every
          name links to that jurisdiction&rsquo;s own revenue department. Note numbers refer to the
          notes printed on pages 2&ndash;6 of the certificate. Where a jurisdiction publishes
          something of its own, it sits on the row: {OWN_FORM_COUNT} downloadable certificates,{' '}
          {OWN_FORM_FIELDS} fillable fields between them, each one opened and counted.
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
          {STILL_UNANSWERED.length > 0 && (
            <p className="mt-3 rounded-xl border border-dashed p-3 text-sm leading-relaxed text-muted-foreground">
              <b className="text-foreground">And one row we left blank on purpose.</b>{' '}
              The {STILL_UNANSWERED.map((j) => j.authority).join(', ')} refuses automated requests
              on every page below its root, so we could not read{' '}
              {STILL_UNANSWERED.length === 1 ? 'that certificate' : 'those certificates'} at source.
              A plausible link would have looked better here and been worth less. When the source
              opens, the row fills in.
            </p>
          )}
        </section>

        <div className="mt-8">
          <ThirdPartyNotice
            subject="the Multistate Tax Commission and the state revenue departments named here"
            because="Each jurisdiction and its revenue department is named so you can open the source and check what it says for yourself"
          />
        </div>

        <section className="mt-12 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FileText className="size-4 text-primary" aria-hidden /> Filling it in
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The certificate has {MTC_FIELDS} fillable fields and carries a registration number for
            every state a business ships into — which makes it exactly the kind of document people
            paste into a cloud editor without thinking. The same goes for the{' '}
            {OWN_FORM_COUNT} state certificates on this page. Ours fills them in the browser, and
            nothing about the business leaves the device.
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
