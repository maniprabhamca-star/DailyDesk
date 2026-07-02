import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { CommandPalette } from '@/components/command-palette';
import { CookieBanner } from '@/components/cookie-banner';
import { PwaRegister } from '@/components/pwa-register';
import { RecordRecent } from '@/components/app/record-recent';
import { SITE_URL, SITE_NAME } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

// Site-wide SEO defaults. Every indexable page overrides title/description/
// canonical with its own; this supplies the base (metadataBase makes canonical
// + OG URLs absolute, per Google's specs) and the home page's metadata.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DailyDesk — Every Daily Tool, Private by Design',
  description:
    'Merge, split, compress and convert PDFs, generate QR codes and strong passwords — free, no signup, no watermark. In-browser tools never upload your files.',
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    title: 'DailyDesk — Every Daily Tool, Private by Design',
    description: 'Free PDF, QR and password tools that run in your browser — no signup, no watermark, files never uploaded.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  icons: { icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/icon-192.png', type: 'image/png' }], apple: '/apple-touch-icon.png' },
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
            {children}
            <CommandPalette />
            <CookieBanner />
            <PwaRegister />
            <RecordRecent />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
