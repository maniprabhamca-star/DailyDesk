import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ServerConvertTool } from '@/components/tools/server-convert-tool';

export const metadata: Metadata = {
  title: 'PDF to PowerPoint — Editable PPTX Converter | DiemDesk',
  description: 'Convert a PDF into an editable PowerPoint (.pptx) — each page becomes a slide. 3 free a day, unlimited on Pro. Converted then deleted, never stored.',
  alternates: { canonical: '/pdf-to-powerpoint' },
  openGraph: { images: ['/og.png'], title: 'PDF to PowerPoint — editable slides', description: 'Turn a PDF into an editable .pptx deck. Converted on our server, then deleted immediately.', type: 'website' },
};

const steps = [
  'Drop your PDF — it’s sent over an encrypted connection to our converter.',
  'Each page is rebuilt as an editable PowerPoint slide, keeping text and shapes where it can.',
  'Download the .pptx and keep editing. Your PDF is deleted from the server the moment it downloads.',
];

const faqs = [
  { q: 'Will the slides be editable?', a: 'Yes — the converter keeps text and vector shapes as editable objects wherever the PDF allows. Complex or scanned pages may come through as an image on the slide; a text-based PDF converts most cleanly.' },
  { q: 'Why does this one upload when your other tools don’t?', a: 'Real PDF-to-PowerPoint conversion needs a full office engine that can’t run in a browser. So this is a server tool: your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read.' },
  { q: 'Is it free?', a: 'Three conversions a day are free, no signup. Pro removes the daily cap and the file-size limit. (Our in-browser tools stay free and unlimited — this one costs us server time.)' },
  { q: 'Is there a size limit?', a: 'Up to 50 MB per file on the free tier. Pro lifts the cap.' },
];

export default function PdfToPowerPointPage() {
  return (
    <PdfToolPage
      title="PDF to PowerPoint"
      description="Turn a PDF into an editable PowerPoint deck — each page becomes a slide. This one runs on our server (it can’t be done in a browser); your file is converted and deleted immediately, never stored."
      steps={steps}
      faqs={faqs}
    >
      <ServerConvertTool
        endpoint="/api/convert/pdf-to-powerpoint"
        sessionKey="pdf-to-powerpoint"
        outExt="pptx"
        ctaLabel="Convert to PowerPoint"
        hint="Get an editable PowerPoint (.pptx) — up to 50 MB, 3 free a day"
        excludeHref="/pdf-to-powerpoint"
        disclosure="Unlike our in-browser tools, converting to an editable PowerPoint needs our server: your PDF is sent over an encrypted connection, converted, and deleted immediately — never stored, never read."
      />
    </PdfToolPage>
  );
}
