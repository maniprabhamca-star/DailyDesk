import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free during launch — every tool, worldwide | DiemDesk',
  description:
    'DiemDesk is free for everyone during its launch period — every PDF and everyday tool, worldwide, no signup. Pro features for power users are coming soon.',
  alternates: { canonical: '/free' },
  openGraph: {
    // See /feedback: a nested openGraph replaces the parent's instead of
    // merging, so omitting `images` here meant no og:image at all. Confirmed
    // against production before fixing.
    images: ['/og.png'],
    title: 'Free during launch — every tool, worldwide | DiemDesk',
    description:
      'DiemDesk is free for everyone during its launch period — every PDF and everyday tool, worldwide, no signup.',
    url: '/free',
    type: 'website',
  },
};

export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
