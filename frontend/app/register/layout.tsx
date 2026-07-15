import type { Metadata } from 'next';

// Thin auth page — keep it out of the index (noindex via meta, NOT robots.txt,
// so crawlers can see the directive), but let link equity flow.
export const metadata: Metadata = {
  title: 'Create your free account | DiemDesk',
  description: 'Create a free DiemDesk account — no card, no daily limits. Every in-browser PDF, image and everyday tool, with files that never leave your device.',
  alternates: { canonical: '/register' },
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
