import type { Metadata } from 'next';

// The pricing page itself is a client component, so its SEO metadata lives in
// this segment layout (App Router pattern for 'use client' pages).
export const metadata: Metadata = {
  title: 'Pricing — Free Forever or Pro | DiemDesk',
  description:
    'DiemDesk pricing: core PDF, QR and password tools are free forever — no signup, no watermark, no daily limits. Pro adds batch processing, large files, and more.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    images: ['/og.png'],
    title: 'Pricing — Free Forever or Pro | DiemDesk',
    description: 'Core tools free forever — no signup, no watermark, no daily limits. Pro adds batch processing and large files.',
    type: 'website',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
