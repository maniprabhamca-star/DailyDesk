import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ReorderTool } from '@/components/pdf/reorder-tool';

export const metadata: Metadata = {
  title: 'Reorder PDF Pages — Drag & Drop, Free | DiemDesk',
  description:
    'Rearrange PDF pages free, in your browser — drag pages into a new order (or reverse the whole document), preview every page, and download. No signup, no watermark, your file is never uploaded.',
  alternates: { canonical: '/reorder-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Reorder PDF Pages — Drag & Drop, Free | DiemDesk',
    description: 'Drag PDF pages into a new order with a visual preview — free, private, in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Drag pages into the order you want — or use the arrows, or reverse everything in one click.',
  'Save, and your reordered PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — reordering pages is completely free, with no signup and no page limits.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The pages are rearranged entirely inside your browser, so your document never leaves your computer.' },
  { q: 'Will the quality change?', a: 'No. Pages are copied losslessly into the new order — nothing is re-rendered or recompressed, so the output is pixel-identical.' },
  { q: 'Can I reverse the page order?', a: 'Yes — one click on “Reverse order” flips the whole document, handy for documents scanned back-to-front.' },
  { q: 'Does it work on big files?', a: 'Yes. The heavy lifting runs in a background worker, so even very large documents reorder without freezing the page — we’ve tested gigabyte-size PDFs.' },
  { q: 'Can I remove or rotate pages at the same time?', a: 'Use our Delete pages and Rotate PDF tools for that — and “Keep moving” hands your file between tools without re-uploading.' },
];

export default function ReorderPdfPage() {
  return (
    <PdfToolPage
      title="Reorder PDF pages"
      description="Drag your pages into the right order — with a visual preview of every page and one-click reverse. Free, instant, and private. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <ReorderTool />
    </PdfToolPage>
  );
}
