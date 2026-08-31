import type { Metadata } from 'next';

// Inherits noindex from the dashboard layout; this only corrects the title and
// the canonical, which would otherwise both point at the parent page.
export const metadata: Metadata = {
  title: 'System — DiemDesk',
  robots: { index: false, follow: false },
  alternates: { canonical: '/dashboard/system' },
};

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
