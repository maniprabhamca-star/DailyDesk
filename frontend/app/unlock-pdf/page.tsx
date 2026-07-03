import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { UnlockTool } from '@/components/pdf/unlock-tool';

export const metadata: Metadata = {
  title: 'Unlock PDF — Remove a PDF Password You Know, Free | DiemDesk',
  description:
    'Remove a PDF password you know and get a copy that opens freely — free and in your browser, so the file and password never leave your device. No signup, no watermark.',
  alternates: { canonical: '/unlock-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Unlock PDF — Remove a PDF Password You Know, Free | DiemDesk',
    description: 'Tired of typing a PDF password? Remove it privately in your browser — file and password never uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in the password-protected PDF.',
  'Type the password it currently opens with.',
  'Download an identical copy that opens freely — no more password prompts.',
];

const faqs = [
  { q: 'Can it crack a password I don’t know?', a: 'No — honestly, no. This tool removes protection from PDFs whose password you already have (think bank statements or payslips you must unlock every single time). It cannot guess or break unknown passwords.' },
  { q: 'Is my file or password uploaded?', a: 'No. Decryption happens entirely in your browser on your device — other sites receive both your document and its password on their servers; here neither ever leaves your computer.' },
  { q: 'Why would I remove a password?', a: 'Repeatedly typing a password on files you own gets old fast — statements, invoices, payslips. Unlock once, then read, print, merge, or compress them like any normal PDF.' },
  { q: 'Does the content change?', a: 'No — the pages are byte-identical, just without the encryption layer. Text, images, and quality are untouched.' },
  { q: 'Can I use the unlocked file with your other tools?', a: 'Yes — that’s half the point. Encrypted PDFs can’t be merged, compressed, or watermarked; after unlocking, “Keep moving” hands the file straight to any other DiemDesk tool.' },
];

export default function UnlockPdfPage() {
  return (
    <PdfToolPage
      title="Unlock PDF"
      description="Remove a PDF password you know and get a copy that opens freely — decrypted on your device, so the file and password are never uploaded. Free and instant."
      steps={steps}
      faqs={faqs}
    >
      <UnlockTool />
    </PdfToolPage>
  );
}
