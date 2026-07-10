import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { AnnotateTool } from '@/components/pdf/annotate-tool';

export const metadata: Metadata = {
  title: 'Annotate PDF — Highlight, Draw & Comment Free | DiemDesk',
  description:
    'Annotate a PDF in your browser: highlight text, draw freehand, add text and boxes, then download. Private by design — your file never leaves your device.',
  alternates: { canonical: '/annotate-pdf' },
  robots: { index: false, follow: false },
  openGraph: {
    images: ['/og.png'],
    title: 'Annotate PDF — DiemDesk',
    description: 'Highlight, draw, and comment on PDFs right in your browser. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a PDF — it opens right in your browser, never uploaded.',
  'Pick a tool — highlight, pen, box or text — choose a colour, and mark up the page.',
  'Download your annotated PDF. Close the tab and nothing is left anywhere but your device.',
];

const faqs = [
  { q: 'Is my file uploaded anywhere?', a: 'No. Annotate PDF runs entirely in your browser — the document is opened locally and your markups are burned in on your device. Nothing is sent to a server.' },
  { q: 'What can I add?', a: 'Highlights, freehand pen strokes, rectangles and text — in your choice of colour and thickness. Undo and clear are one click away.' },
  { q: 'Will the annotations be permanent?', a: 'Yes — your markups are flattened onto the pages, so they look the same in any PDF viewer and can’t be toggled off.' },
  { q: 'Can I annotate more than one page?', a: 'Yes. Move between pages and mark up as many as you like; every page’s annotations are saved into the final file.' },
];

export default function AnnotatePdfPage() {
  return (
    <PdfToolPage
      title="Annotate PDF"
      description="Highlight, draw, box and add text on any PDF — right in your browser. Your file never leaves your device."
      steps={steps}
      faqs={faqs}
      wide
    >
      <AnnotateTool />
    </PdfToolPage>
  );
}
