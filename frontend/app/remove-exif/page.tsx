import type { Metadata } from 'next';
import { KeywordLanding } from '@/components/app/keyword-landing';

export const metadata: Metadata = {
  title: 'Remove EXIF & GPS Data from Photos Online Free | DiemDesk',
  description:
    'Strip hidden EXIF metadata — GPS location, camera/device, timestamps — from your photos free, right in your browser. See what’s hidden, then download a clean copy. Nothing is uploaded.',
  alternates: { canonical: '/remove-exif' },
  openGraph: { images: ['/og.png'], title: 'Remove EXIF & GPS from Photos — Free | DiemDesk', description: 'Strip hidden location & device data on your device.', type: 'website' },
};

export default function Page() {
  return (
    <KeywordLanding
      h1="Remove EXIF & GPS data from a photo"
      lede="Photos carry hidden data — where they were taken, on what device, and when. Strip all of it before you share, right in your browser. We even show you what was hidden."
      ctaHref="/photo-privacy"
      ctaLabel="Remove metadata now"
      bullets={[
        'Removes GPS location, camera/device make & model, and timestamps',
        'Shows you exactly what the photo was leaking',
        'Runs on your device — the photo is never uploaded',
        'Also blur faces, plates or text in the same tool',
        'No signup, no watermark',
      ]}
      faqs={[
        { q: 'What is EXIF data?', a: 'Metadata embedded in image files — including GPS coordinates, the device that took the photo, and the date/time. It can reveal your home or routine.' },
        { q: 'How do I remove it?', a: 'Open the tool, drop your photo in, and download — the exported copy is re-encoded with all metadata stripped.' },
        { q: 'Is my photo uploaded?', a: 'No. Reading and stripping the metadata happens entirely in your browser.' },
      ]}
    />
  );
}
