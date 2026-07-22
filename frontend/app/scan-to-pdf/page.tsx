import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ScanToPdfTool } from '@/components/tools/scan-to-pdf-tool';

export const metadata: Metadata = {
  title: 'Scan to PDF — Phone Camera to PDF, Private | DiemDesk',
  description: 'Scan documents with your phone camera into a clean multi-page PDF — enhanced for readability, on your device. Never uploaded, always free.',
  alternates: { canonical: '/scan-to-pdf' },
  openGraph: { images: ['/og.png'], title: 'Scan to PDF — camera to PDF, privately', description: 'Photograph documents into a clean PDF, entirely in your browser. Nothing uploaded.', type: 'website' },
};

const steps = [
  'Point your phone camera at a page and capture — add as many pages as you need. No camera? Add photos you already took.',
  'Each page is enhanced for readability and lined up in order — reorder or delete any before you save.',
  'Save one clean multi-page PDF. Everything happens on your device; nothing is uploaded.',
];

const faqs = [
  { q: 'Do my scans get uploaded?', a: 'No. The camera stream and every captured page stay in your browser — an ID, a signed contract or a receipt never touches a server. The PDF is assembled on your device.' },
  { q: 'What does “Enhance for readability” do?', a: 'It applies a light grayscale and contrast lift so a photographed page reads like a proper scan — paper brightens toward white, ink darkens. It’s deliberately gentle so faint text isn’t lost; turn it off for color documents or photos.' },
  { q: 'Can I use it on a laptop without a camera?', a: 'Yes — use “Add photos” to pick images you already have. It builds the same clean PDF from them.' },
  { q: 'Is there a page limit or a watermark?', a: 'No limit, no watermark, no signup — it runs on your device, so it stays free and unlimited.' },
];

export default function ScanToPdfPage() {
  return (
    <PdfToolPage
      title="Scan to PDF"
      description="Turn your phone camera into a document scanner — capture pages, enhance them for readability, and save one clean PDF. Everything runs on your device; nothing is uploaded."
      steps={steps}
      faqs={faqs}
      wide
    >
      <ScanToPdfTool />
    </PdfToolPage>
  );
}
