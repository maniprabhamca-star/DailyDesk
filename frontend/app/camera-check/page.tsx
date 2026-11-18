import type { Metadata } from 'next';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { CameraCheck } from '@/components/tools/camera-check';

// A diagnostic, deliberately not in the nav, the catalog or the sitemap: it
// exists to answer one question about the scanner on a real phone, and a page
// that reports a device's camera capabilities has nothing to offer a search
// engine. noindex for the same reason.
export const metadata: Metadata = {
  title: 'Camera check | DiemDesk',
  description:
    'Reports what this device’s camera gives the browser. Used to diagnose the document and receipt scanners.',
  robots: { index: false, follow: false },
};

export default function CameraCheckPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh]">
        <CameraCheck />
      </main>
      <SiteFooter />
    </>
  );
}
