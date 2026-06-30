import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { DeletePagesTool } from '@/components/pdf/delete-pages-tool';

export const metadata: Metadata = {
  title: 'Delete Pages from PDF — Remove PDF Pages Free | DailyDesk',
  description:
    'Delete pages from a PDF, free and in your browser. See every page, tap the ones to remove, and download — no signup, no watermark, your file never leaves your device.',
  alternates: { canonical: '/delete-pages-from-pdf' },
  openGraph: {
    title: 'Delete Pages from PDF — Remove PDF Pages Free | DailyDesk',
    description: 'Visually remove pages from a PDF, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in — every page appears as a thumbnail.',
  'Tap the pages you want gone, or Select all and clear a few.',
  'Click Remove and your trimmed PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — deleting PDF pages is completely free, with no signup, no watermark, and no file-size paywall.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Pages are removed entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'How do I choose which pages to remove?', a: 'You see a thumbnail of every page — just tap the ones you want to delete (they turn red). Tap again to keep them, or use Select all.' },
  { q: 'Does removing pages reduce quality?', a: 'No. The pages you keep are copied across untouched, so their text and images stay exactly as they were.' },
  { q: 'Can I remove every page?', a: 'No — a PDF needs at least one page, so keep at least one. To split a document instead, use Split PDF.' },
];

export default function DeletePagesFromPdfPage() {
  return (
    <PdfToolPage
      title="Delete Pages from PDF"
      description="Remove the pages you don’t need — free, visually, and privately. See every page, tap to delete, done. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <DeletePagesTool />
    </PdfToolPage>
  );
}
