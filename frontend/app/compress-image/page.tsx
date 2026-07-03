import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CompressImageTool } from '@/components/tools/compress-image-tool';

export const metadata: Metadata = {
  title: 'Compress Image — JPG, PNG & WebP Free | DiemDesk',
  description:
    'Compress images free, right in your browser — shrink JPG, PNG, and WebP with the pro-grade mozjpeg encoder, compare before and after, and your photo is never uploaded.',
  alternates: { canonical: '/compress-image' },
  openGraph: {
    images: ['/og.png'],
    title: 'Compress Image — JPG, PNG & WebP Free | DiemDesk',
    description: 'Shrink JPG, PNG, and WebP privately in your browser. Pro-grade encoder, before/after compare, no upload.',
    type: 'website',
  },
};

const steps = [
  'Drop your image in, or click to choose it.',
  'Pick a quality level — and optionally a smaller size for web or email.',
  'Compare before and after, then download your smaller image.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — compressing images is completely free, with no signup, no watermark, and no daily limit.' },
  { q: 'Is my photo uploaded to a server?', a: 'No. Compression runs entirely inside your browser on your own device, so your image never leaves your computer — you can verify in your browser’s Network tab.' },
  { q: 'How much smaller will my image get?', a: 'Photos straight from a phone or camera typically shrink by 50–80% at the Recommended level with no visible difference. PNG screenshots and graphics often shrink even more when converted to JPG.' },
  { q: 'What happens to PNG transparency?', a: 'The output is a JPG, which has no transparency — transparent areas become white. Keeping PNGs as smaller PNGs is on our roadmap.' },
  { q: 'Will the quality drop?', a: 'We use mozjpeg, the same professional encoder used by major websites, which keeps images looking sharp at much smaller sizes. Use the built-in before/after compare (with zoom) to judge with your own eyes before downloading.' },
  { q: 'What formats can I compress?', a: 'JPG, PNG, and WebP go in; an optimized JPG comes out. Got iPhone HEIC photos? Convert them first with our free HEIC to JPG tool, then compress away.' },
  { q: 'Is there a file size limit?', a: 'No server limit — images are compressed on your device and never uploaded. Even large photos are light on memory, so there’s effectively no practical cap for everyday images.' },
];

export default function CompressImagePage() {
  return (
    <PdfToolPage
      title="Compress Image"
      description="Make JPG, PNG, and WebP images smaller without wrecking them — pro-grade compression with a before/after compare. Free, instant, and private. Your photo never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <CompressImageTool />
    </PdfToolPage>
  );
}
