import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CleanScannedPdfTool } from '@/components/pdf/clean-scanned-pdf-tool';

export const metadata: Metadata = {
  title: 'Clean Scanned PDF - Improve Scan Readability | DiemDesk',
  description: 'Clean scanned PDFs in your browser with grayscale, contrast, and black-and-white modes. Your file stays on your device.',
  alternates: { canonical: '/clean-scanned-pdf' },
};

const steps = [
  'Drop in a scanned or photo-based PDF.',
  'Choose grayscale cleanup or black-and-white mode.',
  'Download a cleaner, easier-to-read PDF.',
];

const faqs = [
  { q: 'Is this for normal digital PDFs?', a: 'It works best for scans and photo PDFs. A normal text PDF will be rasterized, so use it only when readability matters more than selectable text.' },
  { q: 'Does it upload my PDF?', a: 'No. Pages are rendered and cleaned in your browser.' },
  { q: 'Does it run OCR?', a: 'No. This improves the page image. Use OCR when you need searchable text.' },
];

export default function CleanScannedPdfPage() {
  return (
    <PdfToolPage
      title="Clean Scanned PDF"
      description="Improve scanned PDFs with private, on-device contrast cleanup. Great for faint scans, photos of pages, and washed-out documents."
      steps={steps}
      faqs={faqs}
    >
      <CleanScannedPdfTool />
    </PdfToolPage>
  );
}
