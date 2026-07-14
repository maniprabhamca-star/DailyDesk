import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SplitTool } from '@/components/pdf/split-tool';

export const metadata: Metadata = {
  title: "Split PDF — Extract Pages or Split Files, Free | DiemDesk",
  description:
    "Split a PDF in your browser: extract specific pages into one PDF, or split every page into separate files. Free — nothing leaves your browser.",
  alternates: { canonical: '/split-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Split PDF — Extract or Split Pages Free | DiemDesk',
    description: 'Extract pages or split a PDF into separate files, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick pages to extract, or choose to split every page into its own file.',
  'Click the button and your result downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — splitting PDFs is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The split happens entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'How do I choose which pages to extract?', a: 'Type page numbers and ranges separated by commas — for example, 1-3, 5, 8-10. The extracted pages become one new PDF.' },
  { q: 'Can I split every page into a separate file?', a: 'Yes. Choose “Each page as a file” and you’ll get a ZIP containing one PDF per page.' },
  { q: 'Can I split into fixed chunks — say every 2 pages?', a: 'Yes. Choose “Every N pages” and set the chunk size: a 10-page file split every 2 pages becomes 5 PDFs, bundled as a ZIP. Great for scanned batches where each document is a fixed number of pages.' },
  { q: 'Will the quality or text change?', a: 'No. Pages are copied exactly as they are, so text stays selectable and quality is preserved.' },
  { q: 'What about password-protected PDFs?', a: 'If a PDF is encrypted and can’t be read, you’ll get a clear message. Remove the password first, then split it.' },
];

export default function SplitPdfPage() {
  return (
    <PdfToolPage
      title="Split PDF"
      description="Extract the pages you need, or split a PDF into separate files — free, instantly, and privately. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <SplitTool />
    </PdfToolPage>
  );
}
