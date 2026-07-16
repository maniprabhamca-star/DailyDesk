import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { FlattenTool } from '@/components/pdf/flatten-tool';

export const metadata: Metadata = {
  title: "Flatten PDF — Lock Forms & Annotations, Free | DiemDesk",
  description:
    "Flatten a PDF free in your browser: make form fields, signatures and annotations permanent, or lock every page as an image. No upload, no signup.",
  alternates: { canonical: '/flatten-pdf' },
  openGraph: {
    images: ['/og/flatten-pdf.png'],
    title: 'Flatten PDF — Make Forms & Annotations Uneditable, Free | DiemDesk',
    description: 'Make filled forms, signatures and annotations permanent — flattened on your device, never uploaded. No page limits.',
    type: 'website',
  },
};

const steps = [
  'Drop in your PDF — we show how many fillable fields and annotations it has.',
  'Pick a mode: flatten just the fields and annotations (text stays crisp), or lock whole pages as images.',
  'Download the flattened copy — what was filled in can no longer be changed.',
];

const faqs = [
  { q: 'What does “flattening” a PDF actually do?', a: 'It merges interactive layers into the page itself. A filled form field stops being a box someone can click and retype — its value becomes permanent page content, like printed ink. Signatures, stamps and comments are made permanent the same way.' },
  { q: 'When should I flatten a PDF?', a: 'Before sending out a filled form, signed agreement or annotated review copy when you don’t want the recipient editing what you wrote. It also fixes forms that print with empty fields — flattened values always print.' },
  { q: 'What’s the difference between the two modes?', a: '“Flatten fields & annotations” only touches the interactive parts and keeps text razor-sharp and selectable. “Lock pages as images” redraws every page as a picture, so nothing on the page can be selected, copied or edited — bigger files, maximum lock-down.' },
  { q: 'Is my file uploaded?', a: 'No. Both modes run entirely in your browser on your device — competitors process flattening on their servers; here the file never leaves your computer.' },
  { q: 'Is flattening the same as redacting?', a: 'No — flattening makes things permanent, it does not remove them. Text that is flattened (even as an image) may still be readable to anyone who opens the file. To hide sensitive content, delete it before flattening.' },
  { q: 'Are there page or file limits?', a: 'No page limits and no per-day task limits. Free covers files up to 100 MB — other tools cap free flattening at around 50 pages or 3 tasks per hour.' },
];

export default function FlattenPdfPage() {
  return (
    <PdfToolPage
      title="Flatten PDF"
      description="Make filled form fields, signatures and annotations a permanent part of the page — or lock entire pages as images. Flattened on your device, so the file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <FlattenTool />
    </PdfToolPage>
  );
}
