import type { Metadata } from 'next';

// Thin auth page — keep it out of the index (noindex via meta, NOT robots.txt,
// so crawlers can see the directive), but let link equity flow. Without this it
// inherits the ROOT title/description/canonical (i.e. it claims to be the home
// page — the "duplicate title / non-self-canonical" audit flag).
export const metadata: Metadata = {
  title: 'Reset your password | DiemDesk',
  alternates: { canonical: '/forgot' },
  robots: { index: false, follow: true },
};

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
