import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Share feedback | DiemDesk',
  description: 'Tell the DiemDesk team what you love, what’s missing, and what would make it perfect for you. We’re building with your input.',
  alternates: { canonical: '/feedback' },
  openGraph: {
    // A nested openGraph REPLACES the parent's rather than merging into it, so
    // declaring one without `images` left this page with no og:image at all —
    // verified on production, which emitted none. A page with no card is the one
    // that looks broken when somebody pastes the link.
    images: ['/og.png'],
    title: 'Share feedback | DiemDesk',
    description: 'Tell the DiemDesk team what you love, what’s missing, and what would make it perfect for you.',
    url: '/feedback',
    type: 'website',
  },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
