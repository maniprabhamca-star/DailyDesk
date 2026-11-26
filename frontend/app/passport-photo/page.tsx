import type { Metadata } from 'next';
import Link from 'next/link';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PassportPhotoTool } from '@/components/tools/passport-photo-tool';
import { PASSPORT_SPECS, SPEC_GROUPS } from '@/lib/passport-specs';

export const metadata: Metadata = {
  title: "Passport & ID Photo Maker — 45+ Countries, Free | DiemDesk",
  description:
    "Make a compliant passport, visa or ID photo for 45+ countries — auto-crop, swap the background and hit the file-size limit, all in your browser.",
  alternates: { canonical: '/passport-photo' },
  openGraph: {
    images: ['/og/passport-photo.png'],
    title: 'Passport & ID Photo Maker — 45+ Country Specs | DiemDesk',
    description: 'Compliant passport/visa/ID photos for 45+ countries — cropped, background swapped, sized to fit. On your device, no upload.',
    type: 'website',
  },
};

const steps = [
  'Pick your country and document (US visa, Schengen, India passport… 45+).',
  'Drop your photo in and line your head up with the guides.',
  'Choose a background if needed, then download the photo — or a 4×6 print sheet.',
];

const faqs = [
  { q: 'Which countries are supported?', a: 'Over 45 — including US visa & passport, Schengen (Germany, France, Italy, Spain and more), UK, India, Canada, Australia, China, Japan, UAE and others. Each preset sets the exact pixel size, head-size rule, background, and file-size cap.' },
  { q: 'Is my photo uploaded to a server?', a: 'No. Cropping, background removal and export all run inside your browser on your own device — your photo never leaves your computer.' },
  { q: 'Can it change the background to white?', a: 'Yes. Pick a background colour (white, off-white, light blue, grey) and we remove the original background on your device and drop your photo onto the new one.' },
  { q: 'Does it meet the file-size limit too?', a: 'Yes — where the portal you are applying through caps the file size in KB, we compress the export to fit under the figure you give us. Check the cap on the application page itself, because they change it.' },
  { q: 'Can I print copies?', a: 'Yes. The print sheet tiles as many copies as fit on a standard 4×6 in photo at true size, with cut guides — take it to any photo kiosk.' },
  { q: 'Will it guarantee my photo is accepted?', a: 'We match the published size, background and file rules, but every office is strict in its own way — always double-check your specific portal’s requirements before submitting.' },
  { q: 'Are you connected to any passport or visa office?', a: 'No. DiemDesk is not affiliated with, endorsed by, or connected to any government department, embassy, consulate or visa service. Country names appear here only to describe which size, background and file-size preset the tool applies, and each specification is taken from that authority’s own published guidance so you can check it at the source. We cannot accept or reject a photograph and we do not submit anything on your behalf.' },
];

export default function PassportPhotoPage() {
  return (
    <PdfToolPage
      title="Passport & ID photo maker"
      description="Make a compliant passport, visa or ID photo for 45+ countries — cropped to the exact size, background swapped, and sized to fit the upload limit. Free, and entirely on your device. Your photo never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <PassportPhotoTool />

      {/* ⚠ This hub linked to NONE of its own country pages until 2026-11-25.
          The link audit found 27 of them with zero inbound links from
          anywhere on the site — including /passport-photo/uae, which at 91
          impressions is the third-biggest page we have, sitting at position
          76.4 with nothing pointing at it.

          The country pages already cross-link through sharesSpecWith(), but
          that only connects countries that share a specification — a country
          with a spec of its own was linked by nobody. This index covers every
          one of them, grouped the way the picker groups them, so the listing
          matches the tool above rather than inventing a second taxonomy. */}
      {/* The DS-160 photo is the one spec people search for by document name
          rather than by country, so it has a landing page of its own — and the
          link audit found nothing pointing at it. */}
      <p className="mt-8 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
        Applying for a US visa? The DS-160 rules &mdash; 2&times;2 inches, plain white background,
        JPEG under 240&nbsp;KB &mdash; are written out on the{' '}
        <Link href="/us-visa-photo" className="font-medium text-primary underline-offset-4 hover:underline">
          US visa photo maker
        </Link>{' '}
        page.
      </p>

      <section className="mt-12 border-t pt-8">
        <h2 className="text-xl font-bold tracking-tight">Specifications by country</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each page states that authority&rsquo;s published size, head-height rule, background and
          file-size cap, with the source it was read from and the date it was checked.
        </p>
        {SPEC_GROUPS.map((g) => {
          const inGroup = PASSPORT_SPECS.filter((s) => s.group === g);
          if (!inGroup.length) return null;
          return (
            <div key={g} className="mt-6">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {g}
              </h3>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                {inGroup.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/passport-photo/${s.id}`}
                      className="block truncate text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                      title={`${s.label} — ${s.wMM}×${s.hMM} mm`}
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </PdfToolPage>
  );
}
