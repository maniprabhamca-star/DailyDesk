import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-jsonld';

// The pricing page itself is a client component, so its SEO metadata lives in
// this segment layout (App Router pattern for 'use client' pages).
export const metadata: Metadata = {
  title: 'Pricing — Free Forever or Pro | DiemDesk',
  description:
    "DiemDesk pricing: in-browser PDF, QR and password tools are free forever — no daily limits. Pro adds batch, large files and unlimited conversions.",
  alternates: { canonical: '/pricing' },
  openGraph: {
    images: ['/og.png'],
    title: 'Pricing — Free Forever or Pro | DiemDesk',
    description: 'In-browser tools free forever — no signup, no watermark, no daily limits. Pro adds batch, large files & unlimited Office conversions.',
    type: 'website',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  // WebPage + breadcrumb only — deliberately NO Offer/price schema until the
  // real Pro prices are locked at the revenue flip (wrong prices in search = bad).
  return (
    <>
      <PageJsonLd name="Pricing" path="/pricing" crumb="Pricing" description="DiemDesk pricing — in-browser tools free forever; Pro adds batch, large files and unlimited conversions." />
      {children}
    </>
  );
}
