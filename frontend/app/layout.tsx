import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { CommandPalette } from '@/components/command-palette';
import { CookieBanner } from '@/components/cookie-banner';
import { PwaRegister } from '@/components/pwa-register';
import { RecordRecent } from '@/components/app/record-recent';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'DailyDesk — All-in-One Productivity Tool',
  description: 'PDF tools, QR codes, image compression, habit tracking, smart notes, and more — all in one app.',
  applicationName: 'DailyDesk',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'DailyDesk', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#6d5ef6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
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
