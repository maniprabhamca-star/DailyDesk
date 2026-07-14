import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KeywordLanding } from '@/components/app/keyword-landing';
import { PASSPORT_SPECS, getSpec, isVerified } from '@/lib/passport-specs';

export function generateStaticParams() {
  return PASSPORT_SPECS.map((s) => ({ country: s.id }));
}

const capOf = (kb?: number) => (kb ? (kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`) : null);

export function generateMetadata({ params }: { params: { country: string } }): Metadata {
  const s = getSpec(params.country);
  if (!s) return {};
  const cap = capOf(s.maxKB);
  return {
    title: `${s.label} Photo Size & Maker — ${s.wMM}×${s.hMM} mm Free | DiemDesk`,
    description: `Make a compliant ${s.label} photo free — ${s.wMM}×${s.hMM} mm (${s.wPx}×${s.hPx} px), ${s.bgName.toLowerCase()} background${cap ? `, under ${cap}` : ''}. Cropped, background swapped and sized on your device. Never uploaded.`,
    alternates: { canonical: `/passport-photo/${s.id}` },
    openGraph: { images: ['/og.png'], title: `${s.label} Photo Maker — Free | DiemDesk`, type: 'website' },
  };
}

export default function Page({ params }: { params: { country: string } }) {
  const s = getSpec(params.country);
  if (!s) notFound();
  const cap = capOf(s.maxKB);
  return (
    <KeywordLanding
      h1={`${s.label} photo size & maker`}
      lede={`Make a compliant ${s.label} photo — ${s.wMM}×${s.hMM} mm (${s.wPx}×${s.hPx} px), ${s.bgName.toLowerCase()} background${cap ? `, under ${cap}` : ''} — cropped and sized right, entirely in your browser.`}
      ctaHref="/passport-photo"
      ctaLabel={`Make my ${s.label} photo`}
      bullets={[
        `Exact size: ${s.wMM}×${s.hMM} mm (${s.wPx}×${s.hPx} px)`,
        `${s.bgName} background — swap it on your device (Pro)`,
        cap ? `Kept under the ${cap} file limit` : 'Exported as a high-quality JPEG',
        'Your photo is never uploaded — faces stay on your device',
        'Print sheet: multiple copies on a 4×6',
      ]}
      body={<p>{isVerified(s.id) ? 'This spec has been checked against an official source.' : 'This uses the standard published spec — always double-check your portal’s exact rules before submitting.'}</p>}
      faqs={[
        { q: `What size is a ${s.label} photo?`, a: `${s.wMM}×${s.hMM} mm (${s.wPx}×${s.hPx} px), ${s.bgName.toLowerCase()} background${cap ? `, under ${cap}` : ''}.` },
        { q: 'Is my photo uploaded?', a: 'No — cropping, background swap and export all happen in your browser, so your photo never leaves your device.' },
      ]}
    />
  );
}
