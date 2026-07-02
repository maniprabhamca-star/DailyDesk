import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { WatermarkTool } from '@/components/pdf/watermark-tool';

export const metadata: Metadata = {
  title: 'Watermark PDF — Stamp Text on Every Page Free | DailyDesk',
  description:
    'Add a text watermark to a PDF free, in your browser — live preview, diagonal, straight or tiled, any color and opacity. No signup, no watermark-on-your-watermark, and your file is never uploaded.',
  alternates: { canonical: '/watermark-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Watermark PDF — Stamp Text on Every Page Free | DailyDesk',
    description: 'Stamp CONFIDENTIAL, DRAFT, or any text across your PDF with a live preview — free, private, in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Type your text and tune position, color, size, and opacity — the preview updates live.',
  'Click Watermark and your stamped PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — watermarking is completely free, with no signup and no limits on pages.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The watermark is stamped entirely inside your browser, so your document never leaves your computer.' },
  { q: 'Can I see the watermark before downloading?', a: 'Yes — the first page is previewed live, and it updates instantly as you change the text, position, color, size, or opacity.' },
  { q: 'Does it watermark every page?', a: 'Yes, every page gets the same stamp. Choose Diagonal for the classic look, Straight for a centered label, or Tiled to repeat it across the page.' },
  { q: 'Will it cover my text?', a: 'The watermark is drawn with adjustable transparency (18% by default), so the document underneath stays readable. Turn opacity up for a stronger stamp.' },
  { q: 'Can I use my logo as the watermark?', a: 'Image watermarks are coming soon — text watermarks (like CONFIDENTIAL, DRAFT, or your company name) are available today.' },
];

export default function WatermarkPdfPage() {
  return (
    <PdfToolPage
      title="Watermark PDF"
      description="Stamp CONFIDENTIAL, DRAFT, or any text across every page — with a live preview so you get it right the first time. Free, instant, and private. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <WatermarkTool />
    </PdfToolPage>
  );
}
