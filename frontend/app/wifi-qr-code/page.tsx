import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { QrCodeTool } from '@/components/tools/qr-code-tool';

export const metadata: Metadata = {
  title: 'WiFi QR Code Generator — Share Your Wi-Fi Free | DiemDesk',
  description:
    "Make a QR code that connects guests to your Wi-Fi in one scan — no typing passwords. Free, generated in your browser: your password is never uploaded.",
  alternates: { canonical: '/wifi-qr-code' },
  openGraph: {
    images: ['/og.png'],
    title: 'WiFi QR Code Generator — Share Your Wi-Fi Free | DiemDesk',
    description: 'One scan connects guests to your Wi-Fi. Free, in your browser — the password never leaves your device.',
    type: 'website',
  },
};

const steps = [
  'Enter your network name (SSID), password, and security type — WPA is the usual choice.',
  'Style the code if you like: colors, size, even your logo in the middle.',
  'Download as PNG or SVG and print it — guests scan with their camera and connect instantly.',
];

const faqs = [
  {
    q: 'How does a Wi-Fi QR code work?',
    a: 'The network name, password, and security type are encoded in the standard WIFI: format that iPhone and Android cameras understand natively. Scanning shows a “Join network” prompt — no app, no typing.',
  },
  {
    q: 'Is my Wi-Fi password uploaded when I generate the code?',
    a: 'No. The code is generated entirely in your browser — your SSID and password never leave your device. Most online generators send them to a server; ours can’t, and you can verify that in the Network tab.',
  },
  {
    q: 'Which security type should I pick?',
    a: 'WPA covers WPA, WPA2, and WPA3 — the right choice for almost every modern router. Pick WEP only for very old networks, or Open for a network with no password.',
  },
  {
    q: 'Does it work on both iPhone and Android?',
    a: 'Yes — both camera apps have supported Wi-Fi QR codes for years (iOS 11+ and Android 10+ natively; earlier Androids via Google Lens). One printed code works for every guest.',
  },
  {
    q: 'What if I change my Wi-Fi password?',
    a: 'The code encodes the password at the moment you create it, so generate a fresh one after any change — it takes a few seconds and stays free.',
  },
  {
    q: 'Does the code expire?',
    a: 'No. It’s a static code with the credentials encoded inside — it works for as long as your network name and password stay the same.',
  },
  {
    q: 'Can I hide my network and still use a QR code?',
    a: 'Yes — turn on “Hidden network” and phones will connect even though the SSID isn’t broadcast. Handy for guest networks you don’t want cluttering neighbours’ Wi-Fi lists.',
  },
];

export default function WifiQrCodePage() {
  return (
    <PdfToolPage
      title="WiFi QR code generator"
      description="Let guests join your Wi-Fi with one scan — no password typing. Generated entirely in your browser, so your network password is never uploaded anywhere."
      steps={steps}
      faqs={faqs}
    >
      <QrCodeTool initialType="wifi" excludeFromRail="/wifi-qr-code" />
    </PdfToolPage>
  );
}
