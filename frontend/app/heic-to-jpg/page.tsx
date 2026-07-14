import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { HeicTool } from '@/components/tools/heic-tool';

export const metadata: Metadata = {
  title: 'HEIC to JPG — Convert iPhone Photos Free | DiemDesk',
  description:
    "Convert HEIC and HEIF iPhone photos to JPG or PNG free in your browser — full quality, burst photos included, nothing uploaded. Works on any device.",
  alternates: { canonical: '/heic-to-jpg' },
  openGraph: {
    images: ['/og.png'],
    title: 'HEIC to JPG — Convert iPhone Photos Free | DiemDesk',
    description: 'Open iPhone HEIC photos anywhere: convert to JPG or PNG privately in your browser. Free, no signup, no upload.',
    type: 'website',
  },
};

const steps = [
  'Drop your HEIC photos in, or click to choose them.',
  'Pick JPG (opens everywhere) or lossless PNG, and a quality level.',
  'Convert and download — one photo directly, or all of them as a ZIP.',
];

const faqs = [
  { q: 'What is a HEIC file?', a: 'HEIC (High Efficiency Image Container) is the format iPhones have used since iOS 11 — roughly half the file size of JPG at the same quality. The catch: Windows, Android, and most websites can’t open it, which is why converting to JPG is so often needed.' },
  { q: 'Are my photos uploaded to a server?', a: 'No — and for personal photos that matters. The conversion runs entirely inside your browser on your own device, so your pictures never leave your computer. You can verify in your browser’s Network tab.' },
  { q: 'Will the quality drop?', a: 'The photo is decoded at its full original resolution and re-encoded with mozjpeg, the professional-grade JPEG encoder, at High quality by default. Choose PNG if you want a mathematically lossless copy.' },
  { q: 'Can I convert several photos at once?', a: 'Free converts one photo per go. DiemDesk Pro unlocks batch conversion — drop in a whole camera roll and download everything as a ZIP.' },
  { q: 'What about burst or multi-image HEIC files?', a: 'Some HEIC files contain several images in one container. DiemDesk converts every image inside and names them photo-1, photo-2, and so on — most converters silently give you only the first.' },
  { q: 'Does it work on Windows and Android?', a: 'Yes — that’s the point. Any modern browser on Windows, Mac, Linux, Android, or iOS can run the converter; nothing needs to be installed.' },
  { q: 'How does it work under the hood?', a: 'The decoder is libheif, the same open-source engine used across the industry, compiled to WebAssembly so it runs on your device instead of a server. Its LGPL license text ships with the site at /libheif/LICENSE.txt.' },
];

export default function HeicToJpgPage() {
  return (
    <PdfToolPage
      title="HEIC to JPG"
      description="Turn iPhone HEIC photos into JPG or PNG that open anywhere — full resolution, burst photos included. Free, instant, and private: your pictures never leave your browser."
      steps={steps}
      faqs={faqs}
    >
      <HeicTool />
    </PdfToolPage>
  );
}
