import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { QrCodeTool } from '@/components/tools/qr-code-tool';

export const metadata: Metadata = {
  title: 'vCard QR Code Generator — Contact Card QR Free | DiemDesk',
  description:
    'Turn your contact details into a QR code — one scan adds you to their phone. Free vCard QR generator that runs in your browser: your details are never uploaded.',
  alternates: { canonical: '/vcard-qr-code' },
  openGraph: {
    images: ['/og.png'],
    title: 'vCard QR Code Generator — Contact Card QR Free | DiemDesk',
    description: 'One scan saves your contact card. Free, in your browser — your details never leave your device.',
    type: 'website',
  },
};

const steps = [
  'Fill in your name — then add phone, email, company, title, and website as you like.',
  'Style the code: colors, size, or your logo in the middle.',
  'Download as PNG or SVG — put it on business cards, email signatures, or slides.',
];

const faqs = [
  {
    q: 'What is a vCard QR code?',
    a: 'A QR code containing your contact card in the standard vCard format. Scanning it opens “Add contact” on the phone with your name, number, email, and company already filled in — no app needed.',
  },
  {
    q: 'Are my contact details uploaded when I create the code?',
    a: 'No. Everything is encoded in your browser — your details never leave your device. Most vCard generators store your data on their servers (often behind a paid “dynamic” code); ours physically can’t.',
  },
  {
    q: 'Does it work on iPhone and Android?',
    a: 'Yes — both native camera apps recognise vCard QR codes and offer to save the contact. It also works with dedicated QR scanner apps.',
  },
  {
    q: 'Does the code expire or need an account?',
    a: 'Never — it’s a static code with your details encoded inside, so it works forever, with no signup, no subscription, and no scan limits.',
  },
  {
    q: 'What should I put it on?',
    a: 'Business cards (print the SVG for perfect sharpness), email signatures, conference slides, storefront windows, packaging — anywhere someone might want to save your details in one scan.',
  },
  {
    q: 'What happens if my details change?',
    a: 'A static code can’t be edited after printing — generate a new one when your number or title changes. It takes seconds and is always free.',
  },
];

export default function VcardQrCodePage() {
  return (
    <PdfToolPage
      title="vCard QR code generator"
      description="One scan adds you to their contacts — name, number, email, company, all filled in. Free, no signup, and your details never leave your browser."
      steps={steps}
      faqs={faqs}
    >
      <QrCodeTool initialType="vcard" excludeFromRail="/vcard-qr-code" />
    </PdfToolPage>
  );
}
