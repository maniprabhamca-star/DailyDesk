import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ProtectTool } from '@/components/pdf/protect-tool';

export const metadata: Metadata = {
  title: 'Protect PDF — Password Protect with AES-256, Free | DiemDesk',
  description:
    "Password-protect a PDF with AES-256 encryption free, in your browser — file and password never leave your device. Optionally block printing and copying.",
  alternates: { canonical: '/protect-pdf' },
  openGraph: {
    images: ['/og/protect-pdf.png'],
    title: 'Protect PDF — Password Protect with AES-256, Free | DiemDesk',
    description: 'Password-protect a PDF with bank-grade AES-256, privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Set a password (and optionally block printing or copying).',
  'Download the encrypted PDF — it opens only with your password, in any reader.',
];

const faqs = [
  { q: 'How strong is the protection?', a: 'AES-256 — the strongest encryption the PDF standard supports, the same level Adobe Acrobat applies. Without the password, the contents are mathematically unreadable.' },
  { q: 'Do you see my password or my file?', a: 'No — and this is where in-browser really matters. On other sites you send BOTH your document AND its new password to their servers. Here the encryption runs on your own device; nothing is transmitted at all.' },
  { q: 'What if I forget the password?', a: 'It cannot be recovered — not by us, not by anyone. That’s what real encryption means. Store the password in a safe place, like a password manager.' },
  { q: 'Will the protected PDF open in any reader?', a: 'Yes — it’s standard PDF encryption. Acrobat, Preview, Chrome, Edge, and phones will all ask for the password and then open it normally.' },
  { q: 'Can I stop people from printing or copying?', a: 'Yes — untick “Allow printing” or “Allow copying text” before encrypting. Readers that honor PDF permissions (most do) will disable those actions.' },
  { q: 'The tool says my PDF already has a password?', a: 'A PDF can only carry one protection layer. Remove the old password first with our Unlock PDF tool, then protect it with the new one.' },
];

export default function ProtectPdfPage() {
  return (
    <PdfToolPage
      title="Protect PDF"
      description="Password-protect a PDF with AES-256 encryption — the file and the password both stay on your device. Free, instant, with optional printing and copying restrictions."
      steps={steps}
      faqs={faqs}
    >
      <ProtectTool />
    </PdfToolPage>
  );
}
