import type { Metadata } from 'next';
import { KeywordLanding } from '@/components/app/keyword-landing';

export const metadata: Metadata = {
  title: "US Visa Photo Maker (DS-160) — 2×2 in, Free | DiemDesk",
  description:
    "Make a compliant US visa (DS-160) photo free — 2×2 in, white background, under 240 KB. Crop, swap the background and hit the size limit, all on-device.",
  alternates: { canonical: '/us-visa-photo' },
  openGraph: { images: ['/og.png'], title: 'US Visa Photo Maker (DS-160) — Free | DiemDesk', description: 'Compliant 2×2 in, ≤240 KB DS-160 photo, on your device.', type: 'website' },
};

export default function Page() {
  return (
    <KeywordLanding
      h1="US visa photo maker (DS-160)"
      lede="Make a photo that meets the DS-160 rules — 2×2 inches (600–1200 px square), plain white background, JPEG under 240 KB — cropped and sized right, entirely in your browser."
      ctaHref="/passport-photo"
      ctaLabel="Make my US visa photo"
      bullets={[
        '2×2 in / 600×600 px, exactly as DS-160 requires',
        'White background — swap it on your device with one click (Pro)',
        'Automatically kept under the 240 KB upload limit',
        'Your photo is never uploaded — faces stay on your device',
        'Print sheet: 6 copies on a 4×6 for a photo kiosk',
      ]}
      faqs={[
        { q: 'What size is a US visa photo?', a: '2×2 inches, between 600×600 and 1200×1200 pixels, JPEG, white background, under 240 KB. Our tool sets all of that for you.' },
        { q: 'Is my photo uploaded?', a: 'No — cropping, background swap and export all happen in your browser. Your face never leaves your device.' },
        { q: 'Will it be accepted?', a: 'We match the published DS-160 requirements, but always double-check your submission portal’s exact rules before uploading.' },
      ]}
    />
  );
}
