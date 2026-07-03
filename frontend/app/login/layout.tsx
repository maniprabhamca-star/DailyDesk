import type { Metadata } from 'next';

// Thin auth page — keep it out of the index (noindex via meta, NOT robots.txt,
// so crawlers can see the directive), but let link equity flow.
export const metadata: Metadata = {
  title: 'Log in | DiemDesk',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
