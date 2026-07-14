import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CompressTargetTool } from '@/components/tools/compress-target-tool';

export const metadata: Metadata = {
  title: 'Compress PDF or Image to a Target Size (100 KB, 200 KB, 1 MB) | DiemDesk',
  description:
    'Compress a PDF or image to an exact size — under 50 KB, 100 KB, 200 KB, 500 KB, 1 MB or 2 MB — for exam, visa and government portal uploads or email. Free, instant, and 100% on your device. Nothing is uploaded.',
  alternates: { canonical: '/compress-to-size' },
  openGraph: {
    images: ['/og.png'],
    title: 'Compress to a Target Size — PDF & Image | DiemDesk',
    description: 'Hit an exact KB/MB limit for exam, visa and portal uploads. PDF & image, on your device, no upload.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF or image in, or click to choose it.',
  'Pick a target size — a preset, a government/exam limit (UPSC 40 KB, SSC 100 KB…), or a custom KB value.',
  'Compress, then download a file that fits under your limit.',
];

const faqs = [
  { q: 'How do I compress a PDF to under 100 KB?', a: 'Drop the PDF in, tap the “100 KB” preset (or type a custom value), and press Compress. We reduce the resolution and quality just enough to land under your limit, then you download it — ready to upload to the portal.' },
  { q: 'Can I compress a photo to exactly 50 KB for an exam form?', a: 'Yes. Switch to Image, choose 50 KB (or an exam preset like IBPS/SBI 50 KB), and we shrink the photo to fit under that size while keeping it as sharp as the limit allows.' },
  { q: 'Is my file uploaded anywhere?', a: 'No. Everything runs inside your browser on your own device — the file never leaves your computer. You can verify in your browser’s Network tab.' },
  { q: 'What if it can’t reach my target?', a: 'If the target is smaller than the file can physically go without falling apart, we hand back the smallest version we could make and tell you — so you can pick a slightly larger target. For multi-page PDFs, splitting first often helps.' },
  { q: 'Will the PDF text stay selectable?', a: 'For small over-limits we optimize losslessly and text stays selectable. To hit very small targets we render pages as images (like every aggressive compressor does), which trades selectable text for meeting the limit.' },
  { q: 'Is there a size or daily limit?', a: 'No daily limit and no watermark. Because it runs on your device there’s no server cap — only your device’s memory, which we warn you about before very large files.' },
];

export default function CompressToSizePage() {
  return (
    <PdfToolPage
      title="Compress to a target size"
      description="Hit an exact file-size limit — under 100 KB, 200 KB, 1 MB, whatever the portal demands — for exam and visa forms, government uploads, or email. Works for PDFs and images, right in your browser. Your file never leaves your device."
      steps={steps}
      faqs={faqs}
    >
      <CompressTargetTool />
    </PdfToolPage>
  );
}
