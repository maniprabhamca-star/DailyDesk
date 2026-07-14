import type { Metadata } from 'next';
import { KeywordLanding } from '@/components/app/keyword-landing';

export const metadata: Metadata = {
  title: 'Fill a PDF Form Online Free — Type, Tick & Sign | DiemDesk',
  description:
    'Fill any PDF form online free — type text, add checkmarks and dates, drop in a signature, then flatten. Works on real form fields and flat scans. Your document is never uploaded.',
  alternates: { canonical: '/fill-pdf-form-online' },
  openGraph: { images: ['/og.png'], title: 'Fill a PDF Form Online — Free | DiemDesk', description: 'Type, tick, date and sign any PDF, on your device.', type: 'website' },
};

export default function Page() {
  return (
    <KeywordLanding
      h1="Fill a PDF form online, free"
      lede="Type into any PDF — a real form or a flat printed scan — add checkmarks, dates and a signature, then flatten it so it can’t be changed. Entirely in your browser."
      ctaHref="/fill-pdf-form"
      ctaLabel="Fill a PDF form"
      bullets={[
        'Works on flat scans, not just PDFs with real fields',
        'Add text, checkmarks, X marks, dates and a signature',
        'Flatten so your entries can’t be edited after',
        'On your device — the document never leaves your browser',
        'No signup, no watermark',
      ]}
      faqs={[
        { q: 'Can I fill a scanned PDF with no form fields?', a: 'Yes. Pick the Text tool, click a blank line and type — it works the same on a flat scan as on a form with real fields.' },
        { q: 'Is my document uploaded?', a: 'No — filling and export happen entirely in your browser.' },
        { q: 'What does flatten mean?', a: 'It bakes your entries into the page so the filled form can’t be edited afterwards — ideal before emailing or submitting.' },
      ]}
    />
  );
}
