import type { Metadata } from 'next';
import { LoggedOut } from '@/components/auth/logged-out';

// Utility page — never index it.
export const metadata: Metadata = {
  title: 'Signed out | DiemDesk',
  description: 'You have been signed out of DiemDesk.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/logged-out' },
};

export default function LoggedOutPage() {
  return <LoggedOut />;
}
