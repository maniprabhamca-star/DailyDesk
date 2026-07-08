import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { EditTool } from '@/components/pdf/edit-tool';

export const metadata: Metadata = {
  title: 'Edit PDF - Paragraph Editor and PDF Markup Tools | DiemDesk',
  description:
    'Edit PDF paragraph blocks, add text, highlight, draw, sign, and place images right in your browser. Your file stays on your device.',
  alternates: { canonical: '/edit-pdf' },
  robots: { index: false, follow: false },
  openGraph: {
    images: ['/og.png'],
    title: 'Edit PDF - DiemDesk',
    description: 'Edit PDF paragraphs and mark up documents in your browser. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a PDF - it opens in your browser, never uploaded.',
  'Click a detected paragraph block or use the toolbar to add text, highlight, draw, sign, or add images.',
  'Download the edited PDF with your paragraph changes and markup applied.',
];

const faqs = [
  { q: 'How does paragraph editing work?', a: 'PDF text is stored as fixed positioned glyphs, not Word-style paragraphs. We group nearby text into editable paragraph blocks, cover the original block, and redraw the updated paragraph in the same place.' },
  { q: 'Can I edit every single word separately?', a: 'No. This editor is intentionally paragraph-based, so users edit natural text blocks instead of individual words.' },
  { q: 'What premium tools are included?', a: 'The toolbar supports paragraph edits, add text, highlight, freehand drawing, rectangle, circle, line, arrow, signatures, image placement, colors, stroke size, undo, and clear-page controls.' },
  { q: 'Can I edit a scanned PDF?', a: 'No. A scan is an image with no selectable text, so there are no paragraph blocks to edit. Run OCR first to add a text layer, then edit.' },
  { q: 'Is my file uploaded?', a: 'No. Editing runs entirely in your browser. The document is opened and rebuilt on your device, and nothing is sent to a server.' },
];

export default function EditPdfPage() {
  return (
    <PdfToolPage
      title="Edit PDF"
      description="Edit PDF paragraph blocks and use a premium toolbar for text boxes, highlights, drawings, shapes, signatures, and images. Your file never leaves your device."
      steps={steps}
      faqs={faqs}
      wide
    >
      <EditTool />
    </PdfToolPage>
  );
}
