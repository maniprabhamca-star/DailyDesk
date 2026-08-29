import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { MobileAppBar } from '@/components/app/mobile-app-bar';
import { AuthProvider } from '@/lib/auth';
import { ToolFlagsProvider } from '@/lib/tool-flags';
import { DeploySkewGuard } from '@/components/app/deploy-skew-guard';
import { CommandPalette } from '@/components/command-palette';
import { CookieBanner } from '@/components/cookie-banner';
import { PwaRegister } from '@/components/pwa-register';
import { ScrollRestoration } from '@/components/app/scroll-restoration';
import { CloudflareAnalytics } from '@/components/cloudflare-analytics';
import { RecordRecent } from '@/components/app/record-recent';
import { UsageBeacon } from '@/components/app/usage-beacon';
import { ErrorBeacon } from '@/components/app/error-beacon';
import { FilePickerRescue } from '@/components/app/file-picker-rescue';
import { FILE_PICKER_RESCUE } from '@/lib/file-picker-rescue';
import { SITE_URL, SITE_NAME } from '@/lib/site';
import { faviconDataUri, isBrandVariant } from '@/components/app/brand-variants';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

// Preview servers (NEXT_PUBLIC_BRAND_VARIANT) swap the tab favicon to the
// candidate mark so it matches the header logo; production uses the static set.
const BV = process.env.NEXT_PUBLIC_BRAND_VARIANT;
const iconsMeta: Metadata['icons'] = isBrandVariant(BV)
  ? { icon: faviconDataUri(BV) }
  : { icon: [{ url: '/favicon.ico?v=2', sizes: '32x32' }, { url: '/icon-192.png?v=2', type: 'image/png' }], apple: '/apple-touch-icon.png?v=2' };

// Site-wide SEO defaults. Every indexable page overrides title/description/
// canonical with its own; this supplies the base (metadataBase makes canonical
// + OG URLs absolute, per Google's specs) and the home page's metadata.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Free PDF Tools — Merge, Compress, Convert & Sign | DiemDesk',
  description:
    "Free PDF tools — merge, split, compress, convert & sign, plus image & QR tools. No signup, no watermark, no upload — all in your browser.",
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    title: 'Free PDF & Everyday Tools, Private by Design | DiemDesk',
    description: 'Free PDF, image, QR and password tools that run in your browser — no signup, no watermark, files never uploaded.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  icons: iconsMeta,
};

export const viewport: Viewport = {
  themeColor: '#6d5ef6',
  // Required for env(safe-area-inset-*) to report anything but 0 on iOS.
  // Without it the mobile app bar sits on the home-indicator strip and its
  // bottom row of taps lands on the browser instead of on us.
  viewportFit: 'cover',
};

// Organization + WebSite entity signals for Google (rendered once, site-wide).
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
    { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* First-visit splash: hide it BEFORE first paint for anyone who has
            already seen it (or asked for reduced motion), so returning visitors
            never flash the overlay. The overlay itself is server-rendered on the
            home page, so a genuine first-timer sees it from the first frame
            instead of home-then-splash-then-home. Runs before page content parses. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('dd-splash-seen-v1')==='1';var r=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(s||r)document.documentElement.classList.add('dd-splash-seen')}catch(e){}",
          }}
        />
        <noscript><style>{`#dd-first-splash{display:none!important}`}</style></noscript>
        {/* Makes "Choose file" work in the window between the page painting and
            React hydrating — until now a tap in there did nothing at all, with
            no error to show for it. Must be inline and early to beat the gap. */}
        <script dangerouslySetInnerHTML={{ __html: FILE_PICKER_RESCUE }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        {/* Machine-readable index for AI assistants. A crawler looks for
            /llms.txt at the root on its own, but advertising it from every page
            costs one tag and makes it reachable from wherever a model landed.
            Every page in the sitemap also has a plain-Markdown twin at <url>.md,
            generated from the BUILT page by scripts/gen-llms.mjs. */}
        <link rel="help" type="text/plain" href="/llms.txt" />
        {/* Recovers a tab that was open across a deploy — see the component. */}
        <DeploySkewGuard />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <ToolFlagsProvider>
              {children}
            </ToolFlagsProvider>
            <CommandPalette />
            <CookieBanner />
            <PwaRegister />
            <ScrollRestoration />
            <RecordRecent />
            <UsageBeacon />
            <ErrorBeacon />
            <FilePickerRescue />
            {/* Phones only — the desktop header already carries all of these. */}
            <MobileAppBar />
          </AuthProvider>
          <CloudflareAnalytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
