import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ResizeImageTool } from '@/components/tools/resize-image-tool';

export const metadata: Metadata = {
  title: 'Resize Image — Exact Pixels or Percent, Free | DiemDesk',
  description:
    "Resize a JPG, PNG or WebP to exact pixels or a percentage — high-quality resampling, aspect-ratio lock and presets. The photo never leaves your device.",
  alternates: { canonical: '/resize-image' },
  openGraph: {
    images: ['/og/resize-image.png'],
    title: 'Resize Image — Exact Pixels or Percent, Free | DiemDesk',
    description: 'Resize images to exact dimensions with pro-quality resampling — privately in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop your image in — JPG, PNG, WebP, GIF, or BMP.',
  'Type exact pixels (aspect ratio stays locked), pick a percent, or use a preset.',
  'Choose the output format and quality, then download the resized image.',
];

const faqs = [
  { q: 'Is my photo uploaded anywhere?', a: 'No — resizing happens entirely in your browser on your own device. Nothing is transmitted or stored.' },
  { q: 'Will the resized image stay sharp?', a: 'Yes — big downscales go through progressive high-quality resampling (halving steps) instead of one blurry jump, and JPGs are encoded with mozjpeg, the professional-grade encoder. This is what keeps text and edges crisp.' },
  { q: 'Can I set exact dimensions like 1200×630?', a: 'Yes — type any width and height. The aspect-ratio lock keeps proportions automatically; unlock it to set both sides independently (the image is stretched to fit).' },
  { q: 'What are the presets for?', a: 'One-click common sizes: 1920px (full-screen), 1280px (blog/social), 800px and 640px (email and thumbnails), plus 75/50/25 percent scales.' },
  { q: 'Can I make an image bigger?', a: 'You can — but upscaling can’t invent detail, so we warn you when the target is larger than the original.' },
  { q: 'Which formats can I save as?', a: 'JPG (smallest, universal), PNG (lossless, keeps transparency), and WebP in browsers that support creating it. iPhone HEIC photos: run them through our HEIC to JPG tool first.' },
];

export default function ResizeImagePage() {
  return (
    <PdfToolPage
      title="Resize image"
      description="Resize any image to exact pixels or a percentage with pro-quality resampling — aspect-ratio lock, presets, and JPG/PNG/WebP output. Free and private, right in your browser."
      steps={steps}
      faqs={faqs}
    >
      <ResizeImageTool />
    </PdfToolPage>
  );
}
