import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Share feedback | DiemDesk',
  description: 'Tell the DiemDesk team what you love, what’s missing, and what would make it perfect for you. We’re building with your input.',
  alternates: { canonical: '/feedback' },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
