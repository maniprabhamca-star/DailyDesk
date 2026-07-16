import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CropImageTool } from '@/components/tools/crop-image-tool';

export const metadata: Metadata = {
  title: 'Crop Image — Free Online Photo Cropper | DiemDesk',
  description:
    "Crop a photo free in your browser — drag the crop box where you want it, with 1:1, 4:3, 16:9 and 3:2 presets. Full resolution kept, nothing uploaded.",
  alternates: { canonical: '/crop-image' },
  openGraph: {
    images: ['/og/crop-image.png'],
    title: 'Crop Image — Free Online Photo Cropper | DiemDesk',
    description: 'Drag-to-crop with aspect presets, privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your image in — the crop box appears right on the photo.',
  'Drag the box to position it, resize from the corner, or pick an aspect preset.',
  'Download the crop — at the image’s full original resolution.',
];

const faqs = [
  { q: 'Is my photo uploaded anywhere?', a: 'No — cropping happens entirely in your browser on your own device. Nothing is transmitted or stored.' },
  { q: 'What are the aspect presets for?', a: '1:1 for profile pictures and Instagram, 16:9 for covers and YouTube thumbnails, 4:3 and 3:2 for classic photo frames — or Free to crop any region. The live pixel readout shows exactly what you’ll get.' },
  { q: 'Does cropping reduce quality?', a: 'No — the crop is cut from the image at its full original resolution. Nothing is rescaled unless you also run it through our Resize tool afterwards.' },
  { q: 'Which formats work?', a: 'JPG, PNG, WebP, GIF, and BMP go in; JPG, PNG, or WebP comes out, with a quality slider for the lossy formats. iPhone HEIC photos: convert them with our HEIC to JPG tool first.' },
  { q: 'Can I fine-tune after seeing the result?', a: 'Yes — “Adjust again” takes you straight back to the crop box with your framing preserved.' },
];

export default function CropImagePage() {
  return (
    <PdfToolPage
      title="Crop image"
      description="Drag a crop box exactly where you want it — with aspect presets for profiles, covers, and thumbnails. Full resolution kept, free and private in your browser."
      steps={steps}
      faqs={faqs}
    >
      <CropImageTool />
    </PdfToolPage>
  );
}
