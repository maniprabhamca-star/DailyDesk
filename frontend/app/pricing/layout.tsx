import type { Metadata } from 'next';

// The pricing page itself is a client component, so its SEO metadata lives in
// this segment layout (App Router pattern for 'use client' pages).
export const metadata: Metadata = {
  title: 'Pricing — Free Forever or Pro | DiemDesk',
  description:
    'DiemDesk pricing: in-browser PDF, QR and password tools are free forever — no signup, no watermark, no daily limits. Pro adds batch processing, large files, unlimited Office conversions, and more.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    images: ['/og.png'],
    title: 'Pricing — Free Forever or Pro | DiemDesk',
    description: 'In-browser tools free forever — no signup, no watermark, no daily limits. Pro adds batch, large files & unlimited Office conversions.',
    type: 'website',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
