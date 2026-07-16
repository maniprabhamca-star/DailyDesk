import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PassportPhotoTool } from '@/components/tools/passport-photo-tool';

export const metadata: Metadata = {
  title: "Passport & ID Photo Maker — 45+ Countries, Free | DiemDesk",
  description:
    "Make a compliant passport, visa or ID photo for 45+ countries — auto-crop, swap the background and hit the file-size limit, all in your browser.",
  alternates: { canonical: '/passport-photo' },
  openGraph: {
    images: ['/og/passport-photo.png'],
    title: 'Passport & ID Photo Maker — 45+ Country Specs | DiemDesk',
    description: 'Compliant passport/visa/ID photos for 45+ countries — cropped, background swapped, sized to fit. On your device, no upload.',
    type: 'website',
  },
};

const steps = [
  'Pick your country and document (US visa, Schengen, India passport… 45+).',
  'Drop your photo in and line your head up with the guides.',
  'Choose a background if needed, then download the photo — or a 4×6 print sheet.',
];

const faqs = [
  { q: 'Which countries are supported?', a: 'Over 45 — including US visa & passport, Schengen (Germany, France, Italy, Spain and more), UK, India, Canada, Australia, China, Japan, UAE and others. Each preset sets the exact pixel size, head-size rule, background, and file-size cap.' },
  { q: 'Is my photo uploaded to a server?', a: 'No. Cropping, background removal and export all run inside your browser on your own device — your photo never leaves your computer.' },
  { q: 'Can it change the background to white?', a: 'Yes. Pick a background colour (white, off-white, light blue, grey) and we remove the original background on your device and drop your photo onto the new one.' },
  { q: 'Does it meet the file-size limit too?', a: 'Yes — where a portal has a KB cap (e.g. US visa ≤240 KB, India passport ≤250 KB) we compress the export to fit under it automatically.' },
  { q: 'Can I print copies?', a: 'Yes. The print sheet tiles as many copies as fit on a standard 4×6 in photo at true size, with cut guides — take it to any photo kiosk.' },
  { q: 'Will it guarantee my photo is accepted?', a: 'We match the published size, background and file rules, but every office is strict in its own way — always double-check your specific portal’s requirements before submitting.' },
];

export default function PassportPhotoPage() {
  return (
    <PdfToolPage
      title="Passport & ID photo maker"
      description="Make a compliant passport, visa or ID photo for 45+ countries — cropped to the exact size, background swapped, and sized to fit the upload limit. Free, and entirely on your device. Your photo never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <PassportPhotoTool />
    </PdfToolPage>
  );
}
