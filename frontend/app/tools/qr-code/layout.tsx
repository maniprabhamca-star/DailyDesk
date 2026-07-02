import type { Metadata } from 'next';

// The QR tool page is a client component, so its SEO metadata + structured
// data live in this segment layout (App Router pattern for 'use client' pages).
export const metadata: Metadata = {
  title: 'Free QR Code Generator — Colors, Logo, Bulk | DailyDesk',
  description:
    'Create QR codes free — custom colors, your logo, and bulk ZIP export. Runs entirely in your browser: no signup, no watermark, nothing uploaded.',
  alternates: { canonical: '/tools/qr-code' },
  openGraph: {
    title: 'Free QR Code Generator — Colors, Logo, Bulk | DailyDesk',
    description: 'Custom colors, logo overlay, and bulk export — free, in your browser, nothing uploaded.',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QR Code Generator — DailyDesk',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: 'Free in-browser QR code generator with custom colors, logo overlay, and bulk ZIP export.',
};

export default function QrCodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
