import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { ToolFlagsProvider } from '@/lib/tool-flags';
import { CommandPalette } from '@/components/command-palette';
import { CookieBanner } from '@/components/cookie-banner';
import { PwaRegister } from '@/components/pwa-register';
import { ScrollRestoration } from '@/components/app/scroll-restoration';
import { CloudflareAnalytics } from '@/components/cloudflare-analytics';
import { RecordRecent } from '@/components/app/record-recent';
import { UsageBeacon } from '@/components/app/usage-beacon';
import { ErrorBeacon } from '@/components/app/error-beacon';
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
    'Free online PDF tools — merge, split, compress, convert & sign PDFs, plus image, QR and everyday tools. No signup, no watermark, no upload: everything runs in your browser.',
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
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
          </AuthProvider>
          <CloudflareAnalytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
