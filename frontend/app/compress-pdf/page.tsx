import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CompressTool } from '@/components/pdf/compress-tool';

export const metadata: Metadata = {
  title: 'Compress PDF — Reduce PDF File Size Free | DailyDesk',
  description:
    'Compress a PDF to make it smaller, free and in your browser. Shrinks images while keeping text crisp and selectable — no signup, no watermark, your file never leaves your device.',
  alternates: { canonical: '/compress-pdf' },
  openGraph: {
    title: 'Compress PDF — Reduce PDF File Size Free | DailyDesk',
    description: 'Make your PDF smaller privately in your browser. Shrinks images, keeps text sharp. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick a level — Recommended is the best balance of size and quality.',
  'Click Compress and your smaller PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — compressing PDFs is completely free, with no signup, no watermark, and no file-size paywall.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Compression runs entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'Will my text get blurry?', a: 'No. We only shrink and re-encode the images inside the PDF — the text and vector graphics are left completely untouched, so they stay crisp and selectable.' },
  { q: 'How much smaller will it get?', a: 'It depends on the file. Image-heavy PDFs (scans, photos) often shrink by half or more. PDFs that are mostly text are already small, so there may be little to gain — and we never hand back a larger file.' },
  { q: 'Which level should I choose?', a: 'Recommended suits most files. Choose Light to keep the most image detail, or Strong for the smallest possible size when quality is less critical.' },
];

export default function CompressPdfPage() {
  return (
    <PdfToolPage
      title="Compress PDF"
      description="Make your PDF smaller without wrecking it — we shrink the images and leave your text perfectly crisp. Free, instant, and private. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <CompressTool />
    </PdfToolPage>
  );
}
