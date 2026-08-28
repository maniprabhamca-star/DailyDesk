import type { Metadata } from 'next';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { OwnerOnly } from '@/components/app/owner-only';
import { TechnologyContent } from '@/components/app/technology-content';

// Internal engineering reference. Deliberately NOT in sitemap.ts, deliberately
// noindex, and linked from nowhere — the only way here is typing the URL, and
// anyone who is not the owner is sent to the home page.
export const metadata: Metadata = {
  title: 'Technology — internal',
  description: 'Internal engineering reference.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function TechnologyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <OwnerOnly>
        <TechnologyContent />
      </OwnerOnly>
      <SiteFooter />
    </div>
  );
}
