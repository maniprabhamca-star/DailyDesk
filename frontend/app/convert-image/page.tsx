import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ConvertImageTool } from '@/components/tools/convert-image-tool';

export const metadata: Metadata = {
  title: 'Convert Image — WebP to PNG, PNG to JPG & More, Free | DiemDesk',
  description:
    'Convert images between WebP, PNG, and JPG free in your browser — WebP to PNG, PNG to JPG, JPG to WebP, GIF and BMP in too. Full quality, nothing uploaded, no signup.',
  alternates: { canonical: '/convert-image' },
  openGraph: {
    images: ['/og.png'],
    title: 'Convert Image — WebP to PNG, PNG to JPG & More, Free | DiemDesk',
    description: 'Switch images between WebP, PNG, and JPG privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your image in — JPG, PNG, WebP, GIF, or BMP.',
  'Pick the target format (we pre-select the sensible opposite).',
  'Convert and download — same resolution, new format.',
];

const faqs = [
  { q: 'Why can’t I use the WebP images I download from websites?', a: 'Many apps and older tools still don’t accept WebP — the classic fix is converting to PNG (keeps transparency, lossless) or JPG (smallest). That’s the most common job this tool does.' },
  { q: 'Is my image uploaded to a server?', a: 'No — the conversion runs entirely in your browser on your device. Nothing is transmitted, stored, or logged.' },
  { q: 'PNG or JPG — which should I pick?', a: 'PNG for graphics, screenshots, logos, and anything with transparency (it’s lossless). JPG for photos — dramatically smaller with no visible difference at quality 85+.' },
  { q: 'Does converting lose quality?', a: 'To PNG: never — it’s lossless. To JPG or WebP: you control the quality slider; at 90 the difference is invisible for photos. The resolution always stays identical.' },
  { q: 'What happens to transparency when I convert to JPG?', a: 'JPG has no transparency, so transparent areas become white. Choose PNG (or WebP) to keep the alpha channel.' },
  { q: 'Can I convert HEIC iPhone photos here?', a: 'Use our dedicated HEIC to JPG tool for those — it decodes Apple’s format on your device and hands you JPG or PNG.' },
];

export default function ConvertImagePage() {
  return (
    <PdfToolPage
      title="Convert image"
      description="Switch images between WebP, PNG, and JPG at full quality — the classic “WebP to PNG” fix included. Free, instant, and private: nothing leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <ConvertImageTool />
    </PdfToolPage>
  );
}
