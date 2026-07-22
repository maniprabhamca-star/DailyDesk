import type { Metadata } from 'next';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { AllToolsDirectory } from '@/components/home/all-tools-directory';
import { PageJsonLd } from '@/components/seo/page-jsonld';

export const metadata: Metadata = {
  title: 'All Tools — Free PDF, Image & Dev Tools | DiemDesk',
  description: 'Browse every DiemDesk tool — PDF, image, video, QR, developer & everyday utilities. Most run in your browser; nothing is uploaded. Free, no signup.',
  alternates: { canonical: '/tools' },
  openGraph: { images: ['/og.png'], title: 'All DiemDesk tools — free, private, in your browser', description: 'Every PDF, image, video, QR and developer tool in one place. Most run on your device.', type: 'website' },
};

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PageJsonLd name="All Tools" path="/tools" crumb="Tools" description="Browse every DiemDesk tool — PDF, image, video, QR, developer & everyday utilities." />
      <SiteHeader />
      <main className="flex-1">
        <AllToolsDirectory full asPage />
      </main>
      <SiteFooter />
    </div>
  );
}
