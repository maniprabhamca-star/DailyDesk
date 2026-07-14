import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OfficeToPdfTool } from '@/components/tools/office-to-pdf-tool';

export const metadata: Metadata = {
  title: 'Word to PDF — Convert DOCX to PDF Free | DiemDesk',
  description:
    "Convert a Word document (DOCX, DOC, ODT, RTF) to PDF free — layout, fonts and images preserved. Sent encrypted, converted and deleted immediately.",
  alternates: { canonical: '/word-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Word to PDF — Convert DOCX to PDF Free | DiemDesk',
    description: 'Turn Word documents into polished PDFs free — converted securely and deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your Word document in — it uploads over an encrypted connection.',
  'Our server renders it to PDF with layout and fonts preserved.',
  'The PDF downloads automatically — and your document is deleted immediately.',
];

const faqs = [
  { q: 'Will my document look the same as in Word?', a: 'Yes — this is the direction conversion engines are best at. Layout, fonts, images, headers and footers, and page breaks come through faithfully; the PDF looks like your document printed perfectly.' },
  { q: 'What happens to my file?', a: 'It travels over an encrypted connection, is converted in an isolated temporary folder, and is deleted the moment your download starts. Nothing is stored or read — see the “Where your data goes” table on our Security page.' },
  { q: 'Which formats can I convert?', a: 'DOCX and the older DOC, plus ODT (LibreOffice/OpenOffice) and RTF. Excel and PowerPoint have their own tools — and after converting, “Keep moving” hands your new PDF straight to Compress, Merge, Sign, or any other tool.' },
  { q: 'Why does this tool use a server?', a: 'Honest answer: faithful Word rendering needs a full office engine that can’t run in a browser. Our PDF tools that CAN run on your device do — this one can’t, so we’re upfront about it.' },
  { q: 'Is there a size limit?', a: 'Up to 50 MB per document.' },
  { q: 'Is it really free?', a: 'Yes — free, no signup, no watermark.' },
];

export default function WordToPdfPage() {
  return (
    <PdfToolPage
      title="Word to PDF"
      description="Convert Word documents to polished PDFs — layout and fonts preserved. Free, fast, and handled honestly: encrypted in transit, converted, then deleted immediately."
      steps={steps}
      faqs={faqs}
    >
      <OfficeToPdfTool kindId="word" />
    </PdfToolPage>
  );
}
