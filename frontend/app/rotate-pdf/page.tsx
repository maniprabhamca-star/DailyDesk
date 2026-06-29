import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { RotateTool } from '@/components/pdf/rotate-tool';

export const metadata: Metadata = {
  title: 'Rotate PDF — Turn PDF Pages Free, In Your Browser | DailyDesk',
  description:
    'Rotate PDF pages 90° or 180°, free and instantly. Rotate every page or just the ones you choose, no signup, no watermark — your file never leaves your browser.',
  alternates: { canonical: '/rotate-pdf' },
  openGraph: {
    title: 'Rotate PDF — Turn PDF Pages Free | DailyDesk',
    description: 'Rotate PDF pages left, right, or 180°, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick a direction (90° left, 90° right, or 180°) and which pages.',
  'Click Rotate and your fixed PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — rotating PDFs is completely free, with no signup, no watermark, and no file-size paywall.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The rotation happens entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'Can I rotate only certain pages?', a: 'Yes. Type page numbers and ranges separated by commas — for example, 1-3, 5, 8-10. Leave it as is to rotate every page.' },
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
