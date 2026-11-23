import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { FillFormTool } from '@/components/tools/fill-form-tool';

export const metadata: Metadata = {
  title: 'Fill a PDF Form Online Free — Type, Tick & Sign | DiemDesk',
  description:
    "Fill any PDF form free in your browser — type text, add checkmarks and dates, drop in a signature, then flatten. Works on real fields and flat scans.",
  alternates: { canonical: '/fill-pdf-form' },
  openGraph: {
    images: ['/og/fill-pdf-form.png'],
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
      afterTool={
        // Half the people who open this tool are holding a form number, not a
        // file: "I need to fill in a W-9". The form libraries fetch the current
        // edition from the agency and hand it straight to this tool, so this
        // strip is the shortest path for them — and it sits under the dropzone
        // rather than in the FAQ, where it would be read after the wrong move.
        <div className="mt-6 rounded-xl border bg-card p-4 shadow-soft sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">Don’t have the form yet?</b> Our form libraries open the
            current edition straight from the agency, already loaded here.
          </p>
          <div className="mt-3 flex shrink-0 gap-4 sm:mt-0">
            <Link href="/us-forms" className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              US federal forms <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/india-forms" className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Indian forms <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      }
    >
      <FillFormTool />
    </PdfToolPage>
  );
}
