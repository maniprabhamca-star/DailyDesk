import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PageNumbersTool } from '@/components/pdf/page-numbers-tool';

export const metadata: Metadata = {
  title: 'Add Page Numbers to PDF — Free, In Your Browser | DailyDesk',
  description:
    'Add page numbers to a PDF, free and in your browser. Choose the position, format, and where numbering starts — no signup, no watermark, your file never leaves your device.',
  alternates: { canonical: '/add-page-numbers-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Add Page Numbers to PDF — Free | DailyDesk',
    description: 'Number your PDF pages privately in your browser. Pick the corner, format, and start number. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick the position, format, and which pages to number.',
  'Click Add page numbers and your file downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — adding page numbers is completely free, with no signup, no watermark, and no file-size paywall.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Numbers are stamped entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'Where can the numbers go?', a: 'Any of six positions — top or bottom, left, center, or right. You can also choose the format, like “1”, “1 / 10”, or “Page 1 of 10”.' },
  { q: 'Can I start from a number other than 1?', a: 'Yes. Set “Start at number” to any value — handy when your document continues from another file.' },
  { q: 'Can I number only some pages?', a: 'Yes. Set the page range — for example, 2-10 to skip a cover page.' },
];

export default function AddPageNumbersToPdfPage() {
  return (
    <PdfToolPage
      title="Add Page Numbers to PDF"
      description="Stamp clean page numbers exactly where you want them — free, instantly, and privately. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <PageNumbersTool />
    </PdfToolPage>
  );
}
