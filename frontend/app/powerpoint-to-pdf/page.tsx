import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OfficeToPdfTool } from '@/components/tools/office-to-pdf-tool';

export const metadata: Metadata = {
  title: 'PowerPoint to PDF — Convert PPTX to PDF Free | DiemDesk',
  description:
    "Convert a PowerPoint (PPTX, PPT, ODP) to PDF free — one slide per page, layouts and images preserved. Sent encrypted, converted and deleted immediately.",
  alternates: { canonical: '/powerpoint-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'PowerPoint to PDF — Convert PPTX to PDF Free | DiemDesk',
    description: 'Turn presentations into shareable PDFs free — converted securely and deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your presentation in — it uploads over an encrypted connection.',
  'Our server renders each slide onto its own PDF page.',
  'The PDF downloads automatically — and your presentation is deleted immediately.',
];

const faqs = [
  { q: 'How do slides map to pages?', a: 'One slide per page, in order, at the slide’s own aspect ratio (16:9 stays 16:9). Layouts, images, charts, and fonts come through faithfully.' },
  { q: 'What about animations and transitions?', a: 'A PDF is a static document, so each slide is captured in its final state — the same as printing the deck. Speaker notes aren’t included.' },
  { q: 'What happens to my file?', a: 'Encrypted in transit, converted in an isolated temporary folder, deleted the moment your download starts — never stored, never read. See the “Where your data goes” table on our Security page.' },
  { q: 'Which formats can I convert?', a: 'PPTX, the older PPT, and ODP. After converting, “Keep moving” hands the PDF straight to Compress (decks shrink a LOT), Merge, or Watermark.' },
  { q: 'Is there a size limit?', a: 'Up to 50 MB per presentation.' },
  { q: 'Is it really free?', a: 'Yes — free, no signup, no watermark.' },
];

export default function PowerpointToPdfPage() {
  return (
    <PdfToolPage
      title="PowerPoint to PDF"
      description="Convert presentations to shareable PDFs — one slide per page, layouts preserved. Free, fast, and handled honestly: encrypted, converted, deleted immediately."
      steps={steps}
      faqs={faqs}
    >
      <OfficeToPdfTool kindId="powerpoint" />
    </PdfToolPage>
  );
}
