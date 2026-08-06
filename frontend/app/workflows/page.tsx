import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { WorkflowsTool } from '@/components/tools/workflows-tool';

export const metadata: Metadata = {
  title: 'Workflows — Chain PDF Tools Into One Drop | DiemDesk',
  description:
    'Build a document assembly line — merge, clean, number, protect, compress — save it, then run the whole chain on a file in one drop. Every step on your device.',
  alternates: { canonical: '/workflows' },
  robots: { index: false, follow: false },
  openGraph: {
    images: ['/og.png'],
    title: 'Saved Workflows — DiemDesk',
    description: 'Chain your PDF tools into a one-drop workflow. Runs on your device, nothing uploaded between steps.',
    type: 'website',
  },
};

const steps = [
  'Pick a template or build your own chain — add steps like clean, number, protect and compress.',
  'Drop a PDF (or several to run the batch). Each step runs in your browser and passes the file to the next.',
  'Download the finished file. Nothing was uploaded at any step — save the workflow to reuse it in one click.',
];

const faqs = [
  { q: 'What is a workflow?', a: 'A saved chain of tools that runs in order on one drop — for example merge → remove metadata → compress. Instead of visiting five tools, you build the chain once and reuse it.' },
  { q: 'Do my files get uploaded between steps?', a: 'No. Every step runs on your own device, so the file is handed from one tool to the next entirely in your browser. Server-based tools can’t do this — they re-upload at each step.' },
  { q: 'Can I run a whole batch?', a: 'Yes. Drop several PDFs and the workflow runs on each, then hands you a zip of the results.' },
  { q: 'Are my saved workflows private?', a: 'Yes — they’re stored on your device. Syncing them across devices with your account is coming.' },
  { q: 'Which steps are available?', a: 'Merge, delete pages, rotate, remove metadata, page numbers, flatten, password-protect and compress-to-size run today. Sign, watermark, share-safe check and scan cleanup are coming to workflows next.' },
];

export default function WorkflowsPage() {
  return (
    <PdfToolPage
      title="Workflows"
      description="Chain your tools into a saved assembly line, then run the whole thing in one drop — on your device, nothing uploaded between steps."
      steps={steps}
      faqs={faqs}
      wide
    >
      <WorkflowsTool />
    </PdfToolPage>
  );
}
