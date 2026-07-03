import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { QrCodeTool } from '@/components/tools/qr-code-tool';

export const metadata: Metadata = {
  title: 'Free QR Code Generator — Colors, Logo, Bulk | DailyDesk',
  description:
    'Create QR codes free — custom colors, your logo, and bulk ZIP export. Runs entirely in your browser: no signup, no watermark, codes never expire.',
  alternates: { canonical: '/qr-code-generator' },
  openGraph: {
    images: ['/og.png'],
    title: 'Free QR Code Generator — Colors, Logo, Bulk | DailyDesk',
    description: 'Custom colors, logo overlay, and bulk export — free, in your browser, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Type or paste your link or text — the QR code preview updates instantly.',
  'Make it yours: colors, size, quiet zone, error correction, and an optional center logo.',
  'Download as PNG or SVG — or switch to Bulk and export hundreds as a ZIP.',
];

const faqs = [
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
      description="Create QR codes with custom colors, your logo, and bulk ZIP export — free, no signup, and generated entirely in your browser. Static codes that never expire."
      steps={steps}
      faqs={faqs}
    >
      <QrCodeTool />
    </PdfToolPage>
  );
}
