import type { Metadata } from 'next';

// Thin auth page — keep it out of the index (noindex via meta, NOT robots.txt),
// with its own canonical so it doesn't inherit the root/home metadata.
export const metadata: Metadata = {
  title: 'Set a new password | DiemDesk',
  alternates: { canonical: '/reset-password' },
  robots: { index: false, follow: true },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
