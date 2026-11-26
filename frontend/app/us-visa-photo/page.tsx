import type { Metadata } from 'next';
import Link from 'next/link';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { ThirdPartyNotice } from '@/components/app/third-party-notice';

// ── Where the numbers on this page come from ────────────────────────────────
//
// This page used to state "JPEG under 240 KB" as a DS-160 requirement in four
// places, and the only source recorded for it anywhere in the repo was
// passlens.com — a competitor's blog. docs/passport-spec-sources.md says in its
// own header that aggregator sites are "fine for FINDING a rule and
// unacceptable as the source of one". Corrected 2026-11-26.
//
// ✅ SOURCED: the geometry, the background and the head height, from
//    9 FAM 303.6-2(A)(1) — the Foreign Affairs Manual's own photo standards,
//    CT:VISA-2036 of 07-29-2024, read 2026-11-26 at
//    https://fam.state.gov/fam/09fam/09fam030306.html
//    It is plain HTML and answers automated reads, unlike travel.state.gov.
//
// ⚠ NOT SOURCED: the 600–1200 px range and the 240 KB file size. Neither is in
//    the FAM, and on reflection neither could be — the FAM governs the
//    photograph; those two are limits of the CEAC upload form. They are
//    published on travel.state.gov, which answers automated requests with a
//    Cloudflare interstitial ("Just a moment…", HTTP 403). We do not work
//    around a bot check. So the page no longer says the DS-160 *requires*
//    240 KB; it says what our export does, and tells the reader to read the cap
//    off the form.
//
// ⚠⚠ DO NOT "fix" headMax 0.69 in lib/passport-specs.ts. It looks wrong next to
//    the FAM's "no more than two thirds" (0.667), and it is not: the same FAM
//    clause gives the head as "between 1 to 1 3/8 inches (25 mm to 35 mm)" on a
//    2-inch (51 mm) photo, which is 0.49–0.686. Our 0.50–0.69 is that, rounded.
//    The FAM states both; the millimetres are the measurable one.

export const metadata: Metadata = {
  title: 'US Visa Photo Maker (DS-160) — 2×2 in, Free | DiemDesk',
  description:
    'Make a US visa (DS-160) photo free — 2 inches square on a plain white background, exported under 240 KB. Crop, swap the background and size it, all on your device.',
  alternates: { canonical: '/us-visa-photo' },
  openGraph: {
    images: ['/og.png'],
    title: 'US Visa Photo Maker (DS-160) — Free | DiemDesk',
    description: '2×2 in on white, exported under 240 KB, on your device.',
    type: 'website',
  },
};

const FAM = 'https://fam.state.gov/fam/09fam/09fam030306.html';

function Sources() {
  return (
    <>
      <h2>Where these numbers come from</h2>
      <p>
        Most pages about this quote a set of figures and leave you to trust them. Here is each one
        and the page it was read on, because a rejected photo costs you an appointment.
      </p>
      <p>
        <b>The photograph itself</b> — the size, the background and how much of the frame your head
        fills — is set by the State Department&rsquo;s own photo standards, at{' '}
        <a
          href={FAM}
          rel="nofollow noopener"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          9 FAM 303.6-2(A)(1)
        </a>
        . That section says the photo &ldquo;should measure 2 inches square (roughly 50 mm
        square) with the head centered in the frame&rdquo;, on a background that is &ldquo;white or
        off-white&rdquo;, and puts the head &ldquo;between 1 to 1 3/8 inches (25 mm to 35 mm)&rdquo;
        from the top of the hair to the bottom of the chin. On a 51 mm photo that is half to roughly
        two thirds of the height, which is what the crop guide in the tool draws. Read 26 November
        2026; the section was last revised 29 July 2024.
      </p>
      <p>
        Two more rules from the same section are worth knowing before you take the photo, because
        they are the ones people get wrong. <b>No eyeglasses</b> — for any application filed on or
        after 1 November 2016, glasses must be off, with narrow medical exceptions that need a
        signed statement. And <b>no head covering</b> unless removing it would conflict with your
        religious practice, in which case enough of the face has to show to establish identity.
      </p>
      <p>
        <b>The file, as opposed to the photograph, is a different matter.</b> The pixel range
        (600×600 to 1200×1200) and the file-size cap are limits of the upload form rather than of
        the photo standard, and they are published on{' '}
        <span className="font-mono text-xs">travel.state.gov</span>, which refuses automated
        requests. We will not work around a bot check to read a number, so we are not going to tell
        you the State Department requires a particular number of kilobytes. What we can tell you is
        what this tool does: <b>it exports under 240 KB</b>, which is the figure the DS-160 upload
        has been accepting, and the export sits well inside it either way. Read the cap off the form
        in front of you before you upload — and if it asks for something tighter, our{' '}
        <Link
          href="/compress-to-size"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          compress to an exact size
        </Link>{' '}
        tool will hit any figure you give it.
      </p>
      <p>
        Per-country photo specifications, including this one, are listed on the{' '}
        <Link
          href="/passport-photo"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          passport photo maker
        </Link>
        , each with the authority it was read from.
      </p>

      <ThirdPartyNotice
        className="mt-6"
        subject="the United States Department of State"
        because="It is named here only to say which published standard each figure on this page was read from, and that standard is linked so you can check it against the current text yourself"
      >
        A requirement can change the day after we read it. The Foreign Affairs Manual and the form
        in front of you are the record, not this page.
      </ThirdPartyNotice>
    </>
  );
}

export default function Page() {
  return (
    <KeywordLanding
      h1="US visa photo maker (DS-160)"
      lede="Make a photo that meets the DS-160 standard — 2 inches square, plain white background, head from half to two thirds of the frame — cropped, sized and exported under 240 KB, entirely in your browser."
      ctaHref="/passport-photo"
      ctaLabel="Make my US visa photo"
      bullets={[
        '2 inches square, the size the State Department’s own photo standard gives',
        'White background — swap it on your device with one click (Pro)',
        'Exported under 240 KB, so it clears the DS-160 upload comfortably',
        'No glasses, head centred, head height inside the published range',
        'Your photo is never uploaded — faces stay on your device',
        'Print sheet: 6 copies on a 4×6 for a photo kiosk',
      ]}
      body={<Sources />}
      faqs={[
        {
          q: 'What size is a US visa photo?',
          a: 'Two inches square. The State Department’s photo standard (9 FAM 303.6-2(A)(1)) gives it as “2 inches square (roughly 50 mm square) with the head centered in the frame”, on a white or off-white background, with the head between 1 and 1 3/8 inches — 25 mm to 35 mm — from the top of the hair to the bottom of the chin. The pixel range and the file-size cap come from the upload form rather than that standard; this tool exports at 600×600 and under 240 KB.',
        },
        {
          q: 'Does it really have to be under 240 KB?',
          a: 'That is the figure the DS-160 upload has been accepting, and it is what we export under. It is a limit of the form rather than of the photo standard, and it is published on a page that refuses automated reads, so check the cap on the form in front of you rather than taking our word for it. If yours is tighter, compress to the exact figure it asks for.',
        },
        {
          q: 'Can I wear glasses?',
          a: 'No. For any application filed on or after 1 November 2016 the photo standard requires glasses off. There are narrow medical exceptions — recent eye surgery, for instance — and those need a statement signed by a medical professional.',
        },
        {
          q: 'Is my photo uploaded?',
          a: 'No — cropping, background swap and export all happen in your browser. Your face never leaves your device.',
        },
        {
          q: 'Will it be accepted?',
          a: 'We match the photo standard as published, and the section each figure came from is linked above so you can check it. We cannot promise an outcome: a consular officer judges the photograph, and the upload form has its own limits that can change. Read the requirements on your own submission portal before uploading.',
        },
      ]}
    />
  );
}
