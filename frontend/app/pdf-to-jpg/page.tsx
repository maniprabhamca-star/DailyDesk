import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToJpgTool } from '@/components/pdf/pdf-to-jpg-tool';

export const metadata: Metadata = {
  title: 'PDF to JPG — Convert PDF Pages to Images Free | DailyDesk',
  description:
    'Convert PDF pages to JPG or PNG images, free and in your browser. Choose quality and resolution, pick pages, no signup, no watermark — your PDF never leaves your device.',
  alternates: { canonical: '/pdf-to-jpg' },
  openGraph: {
    title: 'PDF to JPG — Convert PDF Pages to Images Free | DailyDesk',
    description: 'Turn PDF pages into JPG or PNG images, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick the format (JPG or PNG) and resolution — 300 DPI for true print quality.',
  'Convert, then preview every page and download them one by one or all as a ZIP.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — converting PDF pages to images is completely free, with no signup, no watermark, and no file-size paywall.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The conversion happens entirely inside your browser using your device, so your PDF never leaves your computer.' },
  { q: 'JPG or PNG — which should I pick?', a: 'JPG gives smaller files and is great for photos and scans. PNG is lossless and better for sharp text or transparency.' },
  { q: 'Can I convert only some pages?', a: 'Yes. Type page numbers and ranges separated by commas — for example, 1-3, 5, 8-10.' },
  { q: 'How do I get the sharpest images?', a: 'Choose “High · 300 DPI”. Pages are rendered at true print resolution for crisp text and fine detail. “Standard · 150 DPI” is lighter and still sharp on screen.' },
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
