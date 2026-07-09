import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ComparePdfTool } from '@/components/pdf/compare-pdf-tool';

export const metadata: Metadata = {
  title: 'Compare PDF - Find PDF Changes Privately | DiemDesk',
  description: 'Compare two PDFs in your browser. See page changes, added words, removed words, and a private on-device comparison report.',
  alternates: { canonical: '/compare-pdf' },
};

const steps = [
  'Drop in the original PDF and the updated PDF.',
  'Review text similarity, page changes, and added or removed words.',
  'Download a simple comparison report before sharing or approving.',
];

const faqs = [
  { q: 'Does Compare PDF upload my files?', a: 'No. The PDFs are opened and compared in your browser.' },
  { q: 'Can it compare scanned PDFs?', a: 'It can compare page counts and previews. Text changes need selectable text; visual pixel comparison can be added next for scan-only files.' },
  { q: 'What does the similarity score mean?', a: 'It compares the selectable words in both PDFs. A lower score means more text changed between the two versions.' },
  { q: 'Can I save the result?', a: 'Yes. You can download a text comparison report with changed pages and added or removed words.' },
];

export default function ComparePdfPage() {
  return (
    <PdfToolPage
      title="Compare PDF"
      description="Compare two PDFs privately on your device. Spot changed pages, added words, removed words, and version drift before you send or approve."
      steps={steps}
      faqs={faqs}
    >
      <ComparePdfTool />
    </PdfToolPage>
  );
}
