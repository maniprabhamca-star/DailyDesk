import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-jsonld';

// The pricing page itself is a client component, so its SEO metadata lives in
// this segment layout (App Router pattern for 'use client' pages).
export const metadata: Metadata = {
  title: 'Pricing — Free Forever, Pro or Business | DiemDesk',
  description:
    "In-browser PDF, QR and password tools free forever — no daily limits. Pro adds batch and large files; Business adds bank-statement volume and Tally exports.",
  alternates: { canonical: '/pricing' },
  openGraph: {
    images: ['/og.png'],
    title: 'Pricing — Free Forever, Pro or Business | DiemDesk',
    description: 'In-browser tools free forever — no signup, no watermark, no daily limits. Pro adds batch and unlimited conversions; Business adds 300 statement pages a month.',
    type: 'website',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  // WebPage + breadcrumb only — deliberately NO Offer/price schema until the
  // real Pro prices are locked at the revenue flip (wrong prices in search = bad).
  return (
    <>
      <PageJsonLd name="Pricing" path="/pricing" crumb="Pricing" description="DiemDesk pricing — in-browser tools free forever; Pro adds batch, large files and unlimited conversions; Business adds bank-statement volume and Tally exports." />
      {children}
    </>
  );
}
