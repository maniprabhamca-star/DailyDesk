import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { FillFormTool } from '@/components/tools/fill-form-tool';

export const metadata: Metadata = {
  title: 'Fill a PDF Form Online Free — Type, Tick & Sign | DiemDesk',
  description:
    "Fill any PDF form free in your browser — type text, add checkmarks and dates, drop in a signature, then flatten. Works on real fields and flat scans.",
  alternates: { canonical: '/fill-pdf-form' },
  openGraph: {
    images: ['/og.png'],
    title: 'Fill a PDF Form — Free & On Your Device | DiemDesk',
    description: 'Type, tick, date and sign any PDF — form fields or flat scans — then flatten. On your device, no upload.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in — a real form or a flat scan.',
  'Pick a tool (text, check, date, signature) and click where it goes; drag to adjust.',
  'Download the filled PDF, flattened so it can’t be changed.',
];

const faqs = [
  { q: 'Does it work on scanned forms without real fields?', a: 'Yes. Use the toolbar to place text, checkmarks, dates and a signature anywhere on the page — it works the same on a flat scan as on a form with real fields.' },
  { q: 'Is my document uploaded?', a: 'No. The PDF is opened, filled and exported entirely inside your browser on your own device — it never leaves your computer.' },
  { q: 'Can I add my signature?', a: 'Yes — type your name and it’s placed in a signature style you can position and resize. A draw-your-own signature pad is coming next.' },
  { q: 'What does “flatten” mean?', a: 'Flattening bakes everything you added into the page so the form and your entries can’t be edited afterwards — ideal before emailing or submitting.' },
  { q: 'Is there a size or daily limit?', a: 'No daily limit and no watermark. Since it runs on your device there’s no server cap — only your device’s memory, which we warn about before very large files.' },
];

export default function FillPdfFormPage() {
  return (
    <PdfToolPage
      title="Fill a PDF form"
      description="Type into any PDF — real form fields or a flat scan — add checkmarks, dates and a signature, then flatten so it can’t be changed. Free, and entirely on your device. Your document never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <FillFormTool />
    </PdfToolPage>
  );
}
