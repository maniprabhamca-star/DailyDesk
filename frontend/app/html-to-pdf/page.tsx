import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OfficeToPdfTool } from '@/components/tools/office-to-pdf-tool';

export const metadata: Metadata = {
  title: 'HTML to PDF — Convert HTML, TXT, RTF & ODT to PDF Free | DiemDesk',
  description:
    'Convert an HTML page, plain-text file, RTF, or ODT document to PDF free — layout and fonts preserved. No signup, no watermark. Sent encrypted, converted, and deleted from our server immediately.',
  alternates: { canonical: '/html-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'HTML to PDF — Convert HTML, TXT, RTF & ODT to PDF Free | DiemDesk',
    description: 'Turn HTML, text, RTF, and ODT files into clean PDFs free — converted securely and deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your HTML, TXT, RTF, or ODT file in — it uploads over an encrypted connection.',
  'Our server renders it to a clean PDF with layout and fonts preserved.',
  'The PDF downloads automatically — and your file is deleted immediately.',
];

const faqs = [
  { q: 'Which files can I convert here?', a: 'A saved HTML page (.html/.htm), a plain-text file (.txt), Rich Text (.rtf), or an OpenDocument Text file (.odt). Word, Excel, and PowerPoint each have their own dedicated tool.' },
  { q: 'Will my HTML look the same as in a browser?', a: 'Layout, headings, tables, lists, and inline styles come through faithfully. Very complex CSS, JavaScript-rendered content, and externally-hosted images/fonts may not — the converter renders the document itself, not a live web page.' },
  { q: 'What happens to my file?', a: 'It travels over an encrypted connection, is converted in an isolated temporary folder, and is deleted the moment your download starts. Nothing is stored or read — see the “Where your data goes” table on our Security page.' },
  { q: 'Why does this tool use a server?', a: 'Honest answer: faithful document rendering needs a full office engine that can’t run in a browser. Our PDF tools that CAN run on your device do — this one can’t, so we’re upfront about it.' },
  { q: 'Is there a size limit?', a: 'Up to 50 MB per file.' },
  { q: 'Is it really free?', a: 'Yes — free, no signup, no watermark. After converting, “Keep moving” hands your new PDF straight to Compress, Merge, Sign, or any other tool.' },
];

export default function HtmlToPdfPage() {
  return (
    <PdfToolPage
      title="HTML to PDF"
      description="Convert HTML, plain-text, RTF, and ODT files into clean PDFs — layout and fonts preserved. Free, fast, and handled honestly: encrypted in transit, converted, then deleted immediately."
      steps={steps}
      faqs={faqs}
    >
      <OfficeToPdfTool kindId="document" />
    </PdfToolPage>
  );
}
