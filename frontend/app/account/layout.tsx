import type { Metadata } from 'next';

// Personal account page — keep it out of search results, but let link equity flow.
export const metadata: Metadata = {
  title: 'Your account | DiemDesk',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: true },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
