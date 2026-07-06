import type { Metadata } from 'next';

// Owner-only usage dashboard — never indexed.
export const metadata: Metadata = {
  title: 'Usage dashboard — DiemDesk',
  robots: { index: false, follow: false },
  alternates: { canonical: '/dashboard' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
