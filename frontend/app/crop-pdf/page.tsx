import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CropPdfTool } from '@/components/pdf/crop-pdf-tool';

export const metadata: Metadata = {
  title: 'Crop PDF — Trim Margins & Crop Pages Free | DiemDesk',
  description:
    'Crop a PDF in your browser: drag a box to trim white margins or crop every page to the same area. Lossless, private, and never uploaded.',
  alternates: { canonical: '/crop-pdf' },
  robots: { index: false, follow: false },
  openGraph: {
    images: ['/og.png'],
    title: 'Crop PDF — DiemDesk',
    description: 'Trim margins and crop every page of a PDF right in your browser. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a PDF — it opens right in your browser, never uploaded.',
  'Drag the crop box over the area you want to keep.',
  'Download your cropped PDF — the same crop is applied to every page.',
];

const faqs = [
  { q: 'Is anything deleted from the file?', a: 'No — cropping is lossless. It sets each page’s visible area (the CropBox), so the trimmed content is hidden, not destroyed. The file stays crisp and text stays selectable.' },
  { q: 'Does the crop apply to all pages?', a: 'Yes. You set the box on the first page and it’s applied proportionally to every page, so documents with mixed page sizes stay aligned. Great for trimming consistent scan margins.' },
  { q: 'Is my file uploaded?', a: 'No. Cropping runs entirely in your browser — the PDF is opened and rewritten on your device. Nothing is sent to a server.' },
  { q: 'Can I un-crop it later?', a: 'Because the crop only hides content rather than deleting it, a tool that resets the CropBox can restore the full page. For permanent removal of hidden content, use Redact instead.' },
];

export default function CropPdfPage() {
  return (
    <PdfToolPage
      title="Crop PDF"
      description="Trim white margins or crop every page to the same area — a real drag-to-crop box, lossless, and 100% on your device."
      steps={steps}
      faqs={faqs}
    >
      <CropPdfTool />
    </PdfToolPage>
  );
}
