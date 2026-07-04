import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OcrTool } from '@/components/tools/ocr-tool';

export const metadata: Metadata = {
  title: 'OCR PDF — Make Scanned PDFs Searchable & Extract Text Free | DiemDesk',
  description:
    'Turn a scanned PDF or image into a searchable PDF and extract the text with OCR — free, no signup, no watermark. Pages prepared in your browser; recognised securely and deleted immediately.',
  alternates: { canonical: '/ocr-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'OCR PDF — Make Scanned PDFs Searchable & Extract Text Free | DiemDesk',
    description: 'Make scanned PDFs searchable and pull out the text with OCR — handled securely and deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop in a scanned PDF or a photo/image of a document.',
  'Your pages are sharpened to 300 DPI in your browser, then read by our OCR engine.',
  'Download a searchable PDF (with a selectable text layer) plus the extracted text — your file is deleted immediately.',
];

const faqs = [
  { q: 'What does OCR do?', a: 'OCR (optical character recognition) reads the text inside a scan or photo, which is otherwise just a picture. You get back a PDF whose text you can select, copy, and search — plus the plain text on its own.' },
  { q: 'Why does this tool use a server?', a: 'Accurate text recognition uses a full OCR engine (Tesseract) that runs best on a server. To keep it private, your pages are prepared in your browser first, sent over an encrypted connection, read, and then deleted immediately — nothing is stored or logged. See the “Where your data goes” table on our Security page.' },
  { q: 'Does the layout stay the same?', a: 'Yes — the searchable PDF keeps your original page image exactly as-is and adds an invisible, selectable text layer on top. So it looks identical, but the text is now searchable and copyable.' },
  { q: 'Which languages are supported?', a: 'Over 100 — from English, Spanish, French, German and Chinese to Arabic, Hindi, Japanese, Russian, Thai and many more. Pick your document’s language before running (it improves accuracy). Clear, straight scans work best; very faint, skewed, or handwritten pages are harder for any OCR.' },
  { q: 'How big a document can it handle?', a: 'Large ones. Pages are prepared in your browser and streamed to the server in small batches, so a 100-plus-page, tens-of-megabytes PDF works fine without overloading anything — up to 500 pages per job. You can also OCR just a page range, and choose Best (300 DPI, most accurate) or Fast (200 DPI) quality.' },
];

export default function OcrPdfPage() {
  return (
    <PdfToolPage
      title="OCR — make scans searchable"
      description="Turn a scanned PDF or image into a searchable PDF and pull out the text — free, accurate 300-DPI recognition, handled honestly: prepared in your browser, recognised securely, then deleted immediately."
      steps={steps}
      faqs={faqs}
    >
      <OcrTool />
    </PdfToolPage>
  );
}
