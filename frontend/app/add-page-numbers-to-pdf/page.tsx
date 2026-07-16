import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PageNumbersTool } from '@/components/pdf/page-numbers-tool';

export const metadata: Metadata = {
  title: 'Add Page Numbers to PDF — Free, In Your Browser | DiemDesk',
  description:
    "Add page numbers to a PDF free, in your browser. Choose the position, format and starting number — no signup, no watermark, nothing uploaded.",
  alternates: { canonical: '/add-page-numbers-to-pdf' },
  openGraph: {
    images: ['/og/add-page-numbers-to-pdf.png'],
    title: 'Add Page Numbers to PDF — Free | DiemDesk',
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
  { q: 'Is it really free?', a: 'Yes — adding page numbers is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Numbers are stamped entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'Where can the numbers go?', a: 'Any of six positions — top or bottom, left, center, or right, at your chosen distance from the edge. Pick the format — “1”, “1 / 10”, “Page 1 of 10” — or write your own text with {n} and {p} placeholders, like “Sheet {n} of {p}”, in any of four colors.' },
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
