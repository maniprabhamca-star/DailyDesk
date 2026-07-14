import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PhotoPrivacyTool } from '@/components/tools/photo-privacy-tool';

export const metadata: Metadata = {
  title: 'Blur Faces & Remove Photo Metadata (EXIF/GPS) — Free | DiemDesk',
  description:
    'Strip hidden GPS location, device and timestamp data from a photo and blur faces, plates or text — free, right in your browser. Auto-detect faces and batch-scrub with Pro. Your photo is never uploaded.',
  alternates: { canonical: '/photo-privacy' },
  openGraph: {
    images: ['/og.png'],
    title: 'Blur Faces & Remove Photo Metadata — Free | DiemDesk',
    description: 'Strip EXIF/GPS and blur faces or plates before you share. On your device, no upload.',
    type: 'website',
  },
};

const steps = [
  'Drop your photo in — we show what hidden data it’s carrying.',
  'Drag a box over any face, plate or text to blur it (or auto-blur faces with Pro).',
  'Download a clean copy — metadata stripped, blurs baked in.',
];

const faqs = [
  { q: 'What metadata does it remove?', a: 'Everything embedded in the file — GPS location, camera/device make and model, timestamps and other EXIF data. Downloading always produces a metadata-free copy.' },
  { q: 'Is my photo uploaded?', a: 'No. Reading the metadata, blurring and exporting all happen inside your browser on your own device — the photo never leaves your computer.' },
  { q: 'What’s free vs Pro?', a: 'Free: strip all metadata and blur regions you draw yourself. Pro: one-click auto-detect and blur of faces (and license plates), and batch-scrubbing a whole folder at once — features that run on your device, unlike server-based tools.' },
  { q: 'Does the blur really hide the information?', a: 'Yes — the blurred pixels are permanently re-drawn into the exported image, so the original detail can’t be recovered from the file you download.' },
  { q: 'Which formats work?', a: 'JPG, PNG and WebP go in; a clean JPG comes out. iPhone HEIC? Convert it first with our free HEIC to JPG tool.' },
];

export default function PhotoPrivacyPage() {
  return (
    <PdfToolPage
      title="Blur & remove metadata"
      description="Strip hidden GPS, device and timestamp data from a photo — and blur faces, plates or text — before you share it. Free, and entirely on your device. Your photo never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <PhotoPrivacyTool />
    </PdfToolPage>
  );
}
