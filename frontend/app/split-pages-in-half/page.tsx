import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { HalvePagesTool } from '@/components/pdf/page-ops-tool';

export const metadata: Metadata = {
  title: 'Split PDF Pages in Half — Free | DiemDesk',
  description: 'Split every page of a PDF down the middle — separate scanned book spreads into single pages. Free, no signup, and your file never leaves your browser.',
  alternates: { canonical: '/split-pages-in-half' },
  openGraph: { images: ['/og.png'], title: 'Split PDF Pages in Half | DiemDesk', description: 'Split every page of a PDF down the middle — separate scanned book spreads into single pages. Free, no signup, and your file never leaves your browser.', type: 'website' },
};

const steps = [
  'Drop in the PDF whose pages need splitting.',
  'Choose whether to cut down the middle (a book spread) or across it.',
  'Download — every page becomes two, and the text stays selectable.',
];

const faqs = [
  { q: 'What is this for?', a: 'Scanning a book, magazine or newspaper gives you one wide image per sheet holding two facing pages. Every reader then shows two pages at once, and printing is awkward. This cuts each sheet down the middle so the document reads one page at a time, as it was written.' },
  { q: 'Does it turn my text into a picture?', a: 'No. The two halves are drawn from the original page, so text stays text — selectable, searchable and sharp at any zoom. Nothing is rasterised.' },
  { q: 'What about right-to-left books?', a: 'Tick the right-to-left box. In Arabic, Hebrew and manga the left side of a spread is the second page, not the first, so the halves are emitted in the other order.' },
  { q: 'Can it cut across instead of down?', a: 'Yes. Choose "Across the middle" for a sheet holding two stacked items — tickets, receipts, half-page forms.' },
  { q: 'Is my file uploaded?', a: 'No. The whole thing happens inside your browser, so the document never reaches a server.' },
];

export default function Page() {
  return (
    <PdfToolPage title="Split pages in half" description="Scanned a book or magazine? Every sheet holds two pages. This cuts them apart into single pages — vertically for a spread, or across for stacked slips." steps={steps} faqs={faqs}>
      <HalvePagesTool />
    </PdfToolPage>
  );
}
