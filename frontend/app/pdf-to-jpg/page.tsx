import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToJpgTool } from '@/components/pdf/pdf-to-jpg-tool';

export const metadata: Metadata = {
  title: 'PDF to JPG — Convert PDF Pages to Images Free | DiemDesk',
  description:
    "Convert PDF pages to JPG or PNG images free, in your browser. Choose quality and resolution, pick pages — your PDF never leaves your device.",
  alternates: { canonical: '/pdf-to-jpg' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to JPG — Convert PDF Pages to Images Free | DiemDesk',
    description: 'Turn PDF pages into JPG or PNG images, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick the format (JPG or PNG) and a quality preset — High is the pro sweet spot.',
  'Convert, then preview every page and download them one by one or all as a ZIP.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — converting PDF pages to images is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The conversion happens entirely inside your browser using your device, so your PDF never leaves your computer.' },
  { q: 'JPG or PNG — which should I pick?', a: 'JPG gives smaller files and is great for photos and scans. PNG is lossless and better for sharp text or transparency.' },
  { q: 'Can I convert only some pages?', a: 'Yes. Type page numbers and ranges separated by commas — for example, 1-3, 5, 8-10.' },
  { q: 'How do I get the sharpest images?', a: 'High (200 DPI) is the recommended sweet spot — crisp enough to read fine print from embedded scans, while staying small and converting in seconds. Maximum (300 DPI) is for print or archival. Images are encoded with mozjpeg, the same high-quality engine the big paid tools use, so text stays sharp at a small file size.' },
  { q: 'What happens with multiple pages?', a: 'After converting you get a thumbnail of every page — download each one individually, or grab them all bundled into a single ZIP.' },
];

export default function PdfToJpgPage() {
  return (
    <PdfToolPage
      title="PDF to JPG"
      description="Convert PDF pages into JPG or PNG images — free, instantly, and privately. Your PDF never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <PdfToJpgTool />
    </PdfToolPage>
  );
}
