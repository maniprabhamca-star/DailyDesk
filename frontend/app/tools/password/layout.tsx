import type { Metadata } from 'next';

// The password tool page is a client component, so its SEO metadata + structured
// data live in this segment layout (App Router pattern for 'use client' pages).
export const metadata: Metadata = {
  title: 'Strong Password Generator — Free, No Signup | DailyDesk',
  description:
    'Generate strong random passwords free, with a live strength meter. Uses your device’s secure random generator — nothing is sent or stored, ever.',
  alternates: { canonical: '/tools/password' },
  openGraph: {
    images: ['/og.png'],
    title: 'Strong Password Generator — Free, No Signup | DailyDesk',
    description: 'Strong random passwords with a strength meter — generated on your device, never sent anywhere.',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Password Generator — DailyDesk',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: 'Free password generator using the device’s cryptographically secure randomness — passwords never leave the browser.',
};

export default function PasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
