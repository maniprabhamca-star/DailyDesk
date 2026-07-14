import type { Metadata } from 'next';
import { KeywordLanding } from '@/components/app/keyword-landing';

export const metadata: Metadata = {
  title: 'Blur Image Online Free — Faces, Plates & Text | DiemDesk',
  description:
    "Blur faces, license plates or sensitive text in a photo free, in your browser. Draw a box, or auto-detect faces with Pro. Nothing is uploaded.",
  alternates: { canonical: '/blur-image' },
  openGraph: { images: ['/og.png'], title: 'Blur Image — Faces & Plates — Free | DiemDesk', description: 'Blur faces, plates or text on your device.', type: 'website' },
};

export default function Page() {
  return (
    <KeywordLanding
      h1="Blur an image — faces, plates, or text"
      lede="Hide a face, a license plate, an address or anything sensitive in a photo before you post it. Drag a box to blur, and it’s permanently baked into the download — all on your device."
      ctaHref="/photo-privacy"
      ctaLabel="Blur my image"
      bullets={[
        'Drag a box over anything to blur it',
        'Auto-detect and blur every face with one click (Pro)',
        'The blur is permanent in the downloaded file — not recoverable',
        'Also strips hidden GPS/EXIF metadata at the same time',
        'On your device — never uploaded',
      ]}
      faqs={[
        { q: 'How do I blur a face in a photo?', a: 'Open the tool, drop your photo in, and drag a box over the face. Download and the blur is baked in. With Pro, one click auto-blurs every face.' },
        { q: 'Can the blur be undone?', a: 'No — the blurred pixels are re-drawn into the exported image, so the original detail can’t be recovered from the file you download.' },
        { q: 'Is my image uploaded?', a: 'No. Blurring and export happen entirely in your browser.' },
      ]}
    />
  );
}
