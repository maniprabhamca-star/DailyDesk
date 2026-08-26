import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { PASSPORT_SPECS, getSpec, isVerified, derive, sharesSpecWith, getEditorial } from '@/lib/passport-specs';

export function generateStaticParams() {
  return PASSPORT_SPECS.map((s) => ({ country: s.id }));
}

const capOf = (kb?: number) => (kb ? (kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`) : null);

// Meta descriptions are generated from spec values of wildly different lengths —
// "Japan" against "India passport (Seva)", with or without a file cap — so the
// same template lands anywhere from 120 to 160 characters. Google truncates
// around 155 and the QA suite fails the build over it, which is how this was
// caught. Clamp at a word boundary rather than hoping every country fits.
function clamp155(s: string): string {
  if (s.length <= 155) return s;
  const cut = s.slice(0, 152);
  const at = cut.lastIndexOf(' ');
  return `${(at > 120 ? cut.slice(0, at) : cut).replace(/[,;—-]$/, '')}…`;
}

export function generateMetadata({ params }: { params: { country: string } }): Metadata {
  const s = getSpec(params.country);
  if (!s) return {};
  const d = derive(s);
  const cap = capOf(s.maxKB);
  return {
    // s.label already carries the document type for some entries ("Canada
    // passport/visa", "US visa (DS-160)"), so don't bolt "Passport" on again.
    title: `${s.label} Photo Size — ${s.wMM}×${s.hMM} mm | DiemDesk`,
    description: clamp155(
      `${s.label} photo size: ${s.wMM}×${s.hMM} mm, head ${d.headMinMM}–${d.headMaxMM} mm, ${s.bgName.toLowerCase()} background${cap ? `, under ${cap}` : ''}. Free — made on your device, never uploaded.`,
    ),
    alternates: { canonical: `/passport-photo/${s.id}` },
    openGraph: { images: ['/og.png'], title: `${s.label} Photo Maker — Free | DiemDesk`, type: 'website' },
  };
}

export default function Page({ params }: { params: { country: string } }) {
  const s = getSpec(params.country);
  if (!s) notFound();
  const d = derive(s);
  const cap = capOf(s.maxKB);
  const shared = sharesSpecWith(s);
  const verified = isVerified(s.id);
  const ed = getEditorial(s.id);

  const row = (k: string, v: string) => (
    <div key={k} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );

  return (
    <KeywordLanding
      h1={`${s.label} photo size — ${s.wMM}×${s.hMM} mm`}
      lede={`A ${s.label} photo is ${s.wMM}×${s.hMM} mm with the head ${d.headMinMM}–${d.headMaxMM} mm from crown to chin, on a ${s.bgName.toLowerCase()} background${cap ? `, saved under ${cap}` : ''}. Crop and size one here for free — your photo is processed on your device and never uploaded.`}
      ctaHref="/passport-photo"
      ctaLabel={`Make my ${s.label} photo`}
      bullets={[
        `${s.wMM}×${s.hMM} mm — ${d.wIn}×${d.hIn} in — ${s.wPx}×${s.hPx} px at 300 DPI`,
        `Head height ${d.headMinMM}–${d.headMaxMM} mm (${Math.round(s.headMin * 100)}–${Math.round(s.headMax * 100)}% of the photo)`,
        `${s.bgName} background`,
        cap ? `Digital upload limit: ${cap}` : 'No published file-size limit — exported as a high-quality JPEG',
        `${d.perSheet} copies fit on one 4×6 in print`,
      ]}
      body={
        <div className="space-y-6">
          {/* Unverified specs say so LOUDLY. This used to be a line of small
              muted text under the table, which is not where you look before
              spending money at a print counter — and an audit of the European
              entries found six of ten generic rows wrong, so the warning is
              doing real work. */}
          {!verified && (
            <section className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-amber-800 dark:text-amber-300">
                Check these figures before you print
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                We have <b>not</b> yet confirmed {s.label}&rsquo;s photo rules against the issuing
                authority&rsquo;s own page. What follows is the commonly-published specification, and
                it is right often enough to be useful — but when we audited the European entries
                the same way, several turned out to differ from the official rule on size,
                background or head height. Open the portal you are submitting to and check the
                numbers there first. The maker itself is unaffected: it crops to whatever the
                figures below say.
              </p>
            </section>
          )}

          {s.photographedOnSite && (
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-4">
              <h2 className="text-base font-semibold">You may not need to bring a photo at all</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.photographedOnSite}</p>
            </section>
          )}
          <section>
            <h2 className="text-lg font-semibold">{s.label} photo requirements at a glance</h2>
            <dl className="mt-3 rounded-xl border bg-card p-4 text-sm">
              {row('Photo size', `${s.wMM} × ${s.hMM} mm`)}
              {row('In inches', `${d.wIn} × ${d.hIn} in`)}
              {row('Pixels at 300 DPI', `${s.wPx} × ${s.hPx} px`)}
              {row('Pixels at 600 DPI', `${d.px600} px`)}
              {row('Shape', d.isSquare ? 'Square' : `Portrait, about ${d.aspect}`)}
              {row('Head height', `${d.headMinMM} – ${d.headMaxMM} mm (crown to chin)`)}
              {s.headCaveat && (
                <div className="border-b border-border/60 py-2 last:border-0">
                  <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">{s.headCaveat}</p>
                </div>
              )}
              {row('Background', s.bgName)}
              {row('File size limit', cap ?? 'None published')}
              {row('Copies per 4×6 in print', String(d.perSheet))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {verified
                ? 'These figures were checked against an official or widely-cited source. Portals occasionally change their rules, so confirm on the page where you submit.'
                : 'The rest of this page is generated from those same figures.'}
            </p>
          </section>

          {ed && (
            <section>
              <h2 className="text-lg font-semibold">What {s.label} asks for specifically</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ed.authority}</p>
              <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                {ed.quirk && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-3">
                    <dt className="font-semibold">The one people get wrong</dt>
                    <dd className="mt-1 text-muted-foreground">{ed.quirk}</dd>
                  </div>
                )}
                {ed.background && (<div><dt className="font-semibold">Background</dt><dd className="text-muted-foreground">{ed.background}</dd></div>)}
                {ed.glasses && (<div><dt className="font-semibold">Glasses</dt><dd className="text-muted-foreground">{ed.glasses}</dd></div>)}
                {ed.headCovering && (<div><dt className="font-semibold">Head coverings</dt><dd className="text-muted-foreground">{ed.headCovering}</dd></div>)}
                {ed.expression && (<div><dt className="font-semibold">Expression</dt><dd className="text-muted-foreground">{ed.expression}</dd></div>)}
                {ed.children && (<div><dt className="font-semibold">Children</dt><dd className="text-muted-foreground">{ed.children}</dd></div>)}
                {ed.exceptions && (<div><dt className="font-semibold">Exceptions</dt><dd className="text-muted-foreground">{ed.exceptions}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Source: <a href={ed.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{ed.sourceName}</a>. Checked {ed.checkedOn}. Rules change — confirm on the authority&rsquo;s own page before you submit.
              </p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">Getting the head size right</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Head height is the measurement most photos fail on, and it is not the same as
              &ldquo;how much of the frame your face fills&rdquo;. It runs from the top of the head — the
              crown, not the top of your hair if it stands up — down to the bottom of the chin.
              For {s.label} that is <b>{d.headMinMM} to {d.headMaxMM} mm</b> on a {s.hMM} mm tall
              photo{d.isSquare ? '' : ', leaving the rest as space above the head and below the chin'}.
              The maker draws that band on screen while you position the photo, so you can see
              whether you are inside it before you export{cap ? `, and keeps the exported file under ${cap}` : ''}.
            </p>
          </section>

          {shared.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">One photo, several countries</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.wMM}×{s.hMM} mm with a {s.bgName.toLowerCase()} background and the same head range is
                also what {shared.length === 1 ? 'one other destination we cover' : `${shared.length} other destinations we cover`} publish{shared.length === 1 ? 'es' : ''} — so
                the photo you make for {s.label} is normally usable for {shared.length === 1 ? 'it' : 'them'} too:
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {shared.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/passport-photo/${o.id}`}
                      className="inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-accent"
                    >
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Sizes match, but each authority still sets its own rules on things like glasses,
                head coverings and how recent the photograph must be. Check the portal you are
                submitting to.
              </p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">Printing a {s.label} photo at home</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              At {s.wMM}×{s.hMM} mm you get <b>{d.perSheet} copies</b> on a single 4×6 in
              (10×15 cm) print, which is the cheapest size at almost every print counter and
              photo kiosk. Export at 300 DPI ({s.wPx}×{s.hPx} px) for printing; some portals
              accept or prefer 600 DPI ({d.px600} px) for digital submission. Cut along the
              guides with a straight edge rather than scissors — a crooked border is a
              surprisingly common reason for a photo to be handed back.
            </p>
          </section>
        </div>
      }
      faqs={[
        { q: `What size is a ${s.label} photo?`, a: `${s.wMM}×${s.hMM} mm — that is ${d.wIn}×${d.hIn} inches, or ${s.wPx}×${s.hPx} pixels at 300 DPI. The background must be ${s.bgName.toLowerCase()}${cap ? `, and the file must be under ${cap}` : ''}.` },
        { q: `How big should the head be in a ${s.label} photo?`, a: `Between ${d.headMinMM} mm and ${d.headMaxMM} mm from the crown of the head to the bottom of the chin, which is ${Math.round(s.headMin * 100)}–${Math.round(s.headMax * 100)}% of the ${s.hMM} mm photo height.` },
        { q: `How many ${s.label} photos fit on a 4×6 print?`, a: `${d.perSheet} copies at ${s.wMM}×${s.hMM} mm. The maker lays them out on a 4×6 in sheet with cutting guides, so one cheap print gives you a full set.` },
        ...(cap ? [{ q: `What is the file size limit for a ${s.label} photo?`, a: `${cap}. The exported JPEG is kept under that limit automatically, so you do not have to compress it yourself afterwards.` }] : []),
        { q: 'Is my photo uploaded to a server?', a: 'No. Cropping, background replacement and export all run inside your browser, so the photograph never leaves your device. There is no account and nothing to delete afterwards.' },
      ]}
    />
  );
}
