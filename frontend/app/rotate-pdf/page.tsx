import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { RotateTool } from '@/components/pdf/rotate-tool';

export const metadata: Metadata = {
  title: 'Rotate PDF — Turn PDF Pages Free, In Your Browser | DiemDesk',
  description:
    "Rotate PDF pages 90° or 180° free and instantly. Turn every page or just the ones you pick — no signup, no watermark, nothing leaves your browser.",
  alternates: { canonical: '/rotate-pdf' },
  openGraph: {
    images: ['/og/rotate-pdf.png'],
    title: 'Rotate PDF — Turn PDF Pages Free | DiemDesk',
    description: 'Rotate PDF pages left, right, or 180°, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in — every page appears as a thumbnail.',
  'Tap any page to turn it, or select pages and rotate them together.',
  'Click Rotate and your fixed PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — rotating PDFs is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The rotation happens entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'Can I rotate only certain pages?', a: 'Yes. You see a thumbnail of every page — rotate any single page with its left/right buttons, or tick several (or Select all) and rotate them together.' },
  { q: 'Does rotating reduce quality?', a: 'No. Rotation only changes how each page is displayed — the text and images are untouched, so quality is preserved.' },
  { q: 'Will the rotation stick when I reopen the file?', a: 'Yes. The new orientation is saved into the PDF itself, so it opens rotated everywhere.' },
];

export default function RotatePdfPage() {
  return (
    <PdfToolPage
      title="Rotate PDF"
      description="Turn PDF pages the right way up — free, instantly, and privately. Rotate every page or just the ones you pick. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <RotateTool />
    </PdfToolPage>
  );
}
