import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { EditTool } from '@/components/pdf/edit-tool';

export const metadata: Metadata = {
  title: 'Edit PDF — Change Text in a PDF, Free | DiemDesk',
  description:
    'Edit text in a PDF right in your browser: click any line and change the words. A smart hybrid — true edits where the font allows, seamless cover-and-redraw elsewhere. Never uploaded.',
  alternates: { canonical: '/edit-pdf' },
  robots: { index: false, follow: false },
  openGraph: {
    images: ['/og.png'],
    title: 'Edit PDF — DiemDesk',
    description: 'Click any text in a PDF and edit it, right in your browser. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a PDF — it opens in your browser, never uploaded.',
  'Click any line of text; the words become editable in place.',
  'Type your change and download — the original text is replaced seamlessly.',
];

const faqs = [
  { q: 'How does editing a PDF actually work?', a: 'A PDF stores text as fixed, positioned glyphs — not paragraphs — so it can’t be edited like a Word file. We detect each line’s exact position and font, then either re-use the original font where it allows, or seamlessly cover the old text and redraw your new words in a matched font. It looks native on normal documents.' },
  { q: 'Will it match the original font exactly?', a: 'Often, yes — for common fonts (Helvetica/Times/Courier) and fully-embedded fonts. Some PDFs embed only the letters they use, so an exact match isn’t always possible; we then pick the closest of our bundled fonts at the same size and colour.' },
  { q: 'Why does an edit sometimes show a faint patch?', a: 'When text sits on a photo or textured background, covering the original can leave a subtle patch. It’s a limitation of the PDF format (fixed layout), not a bug — it looks clean on plain backgrounds, which is most documents.' },
  { q: 'Can I edit a scanned PDF?', a: 'No — a scan is an image with no selectable text, so there’s nothing to click. Run OCR first to add a text layer, then edit.' },
  { q: 'Is my file uploaded?', a: 'No. Editing runs entirely in your browser — the document is opened and rebuilt on your device. Nothing is sent to a server.' },
];

export default function EditPdfPage() {
  return (
    <PdfToolPage
      title="Edit PDF"
      description="Click any text in your PDF and change the words — a smart hybrid editor that runs entirely in your browser. Your file never leaves your device."
      steps={steps}
      faqs={faqs}
    >
      <EditTool />
    </PdfToolPage>
  );
}
