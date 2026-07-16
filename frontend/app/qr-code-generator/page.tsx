import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { QrCodeTool } from '@/components/tools/qr-code-tool';

export const metadata: Metadata = {
  title: 'Free QR Code Generator — Colors, Logo, Bulk | DiemDesk',
  description:
    'Create QR codes free — links, Wi-Fi, contact cards, email, SMS. Custom colors, logo, bulk ZIP export. In your browser: no signup, no expiry, no watermark.',
  alternates: { canonical: '/qr-code-generator' },
  openGraph: {
    images: ['/og/qr-code-generator.png'],
    title: 'Free QR Code Generator — Colors, Logo, Bulk | DiemDesk',
    description: 'Custom colors, logo overlay, and bulk export — free, in your browser, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Pick what the code should do — link, text, Wi-Fi login, email, call, SMS, or a contact card — and fill in the details.',
  'Make it yours: colors, gradients, module and eye shapes, size, and an optional center logo.',
  'Download as PNG or SVG — or switch to Bulk and export hundreds as a ZIP.',
];

const faqs = [
  {
    q: 'What can a QR code contain?',
    a: 'Seven types are built in: a link, plain text, Wi-Fi login (guests join your network with one scan), email (opens a pre-filled draft), phone call, SMS, and a vCard contact card that saves straight into the phone’s contacts.',
  },
  {
    q: 'Is my QR code content uploaded anywhere?',
    a: 'No. The code is generated entirely in your browser — the link or text you enter never leaves your device. You can verify this in your browser’s DevTools Network tab: no requests carry your data.',
  },
  {
    q: 'Do these QR codes expire or have scan limits?',
    a: 'Never. These are static QR codes — the content is encoded directly into the pattern itself, so they keep working forever, with unlimited scans. Some generators put free codes behind trials that expire; ours don’t.',
  },
  {
    q: 'Should I download PNG or SVG?',
    a: 'PNG is perfect for documents, presentations, and the web. SVG is a vector format that scales to any size without losing sharpness — the right choice for print, posters, and packaging.',
  },
  {
    q: 'Can I put my logo in the middle?',
    a: 'Yes — upload any image and size it with the slider. Error correction is automatically locked to H (30% redundancy) so the code stays reliably scannable, and a rounded backdrop keeps the logo clean on any color.',
  },
  {
    q: 'What is error correction?',
    a: 'QR codes carry redundant data so they still scan when partially covered or damaged. L (7%) makes the densest code; H (30%) survives the most damage — and is required when a logo covers the middle.',
  },
  {
    q: 'Can I style the code without breaking scanning?',
    a: 'Yes — module shapes (square, rounded, dots), rounded eyes, and two-color gradients are all tested to stay machine-readable: every style combination is verified against a real QR decoder. For best results keep dark modules on a light background.',
  },
  {
    q: 'What does the quiet zone do?',
    a: 'It’s the empty margin around the code. Scanners need it to find the code’s edges — keep at least 2 modules unless you have a specific reason not to.',
  },
  {
    q: 'How does bulk generation work?',
    a: 'Switch to Bulk and paste one link or text per line. Every code is generated on your device with your chosen style and downloaded together as a ZIP of PNGs — a feature most tools charge for.',
  },
];

export default function QrCodeGeneratorPage() {
  return (
    <PdfToolPage
      title="QR code generator"
      description="Links, Wi-Fi logins, contact cards, email, calls, SMS — with custom colors, your logo, and bulk ZIP export. Free, no signup, generated entirely in your browser. Static codes that never expire."
      steps={steps}
      faqs={faqs}
    >
      <QrCodeTool />
    </PdfToolPage>
  );
}
