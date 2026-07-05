import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { MergeTool } from '@/components/pdf/merge-tool';

export const metadata: Metadata = {
  title: 'Merge PDF — Combine PDF Files Free, In Your Browser | DiemDesk',
  description:
    'Combine multiple PDF files into one, free and instantly. Reorder pages, no signup, no watermark — and your files never leave your browser.',
  alternates: { canonical: '/merge-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Merge PDF — Combine PDF Files Free | DiemDesk',
    description: 'Combine multiple PDFs into one, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF files in, or click to choose them.',
  'Drag to reorder until the sequence is right.',
  'Click Merge and your combined PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — merging PDFs is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Are my files uploaded to a server?', a: 'No. The merge happens entirely inside your browser using your device, so your documents never leave your computer.' },
  { q: 'Is there a limit on how many PDFs I can merge?', a: 'You can merge as many PDFs as your device can comfortably handle. Everything is processed locally.' },
  { q: 'Can I reorder the files before merging?', a: 'Yes. Use the up and down arrows to arrange the files in the exact order you want before merging.' },
  { q: 'Will the quality change?', a: 'No. Pages are copied as-is, so text stays selectable and quality is preserved.' },
];

export default function MergePdfPage() {
  return (
    <PdfToolPage
      title="Merge PDF"
      description="Combine multiple PDF files into one — free, instantly, and privately. Your files never leave your browser."
      steps={steps}
      faqs={faqs}
    >
      <MergeTool />
    </PdfToolPage>
  );
}
