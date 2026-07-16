import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToWordTool } from '@/components/tools/pdf-to-word-tool';

export const metadata: Metadata = {
  title: 'PDF to Word — Convert PDF to Editable DOCX Free | DiemDesk',
  description:
    "Convert a PDF to an editable Word document (.docx) free — no signup, no watermark. Sent encrypted, converted and deleted from our server immediately.",
  alternates: { canonical: '/pdf-to-word' },
  openGraph: {
    images: ['/og/pdf-to-word.png'],
    title: 'PDF to Word — Convert PDF to Editable DOCX Free | DiemDesk',
    description: 'Turn a PDF into an editable Word document free — converted securely and deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in — it uploads over an encrypted connection.',
  'Our server converts it to an editable Word document in seconds.',
  'The .docx downloads automatically — and your PDF is deleted immediately.',
];

const faqs = [
  { q: 'Why does this tool use a server when the others don’t?', a: 'Honest answer: turning a PDF into a real editable Word document takes a full office engine that can’t run inside a browser. It’s the one job in our catalog that genuinely needs a server — which is why this page tells you exactly what happens to your file, and our in-browser tools stay in-browser.' },
  { q: 'What happens to my file?', a: 'It travels over an encrypted connection, is converted in an isolated temporary folder, and is deleted the moment your download starts. Nothing is stored, logged, or looked at — see the “Where your data goes” table on our Security page.' },
  { q: 'How editable is the result?', a: 'All text comes through fully editable with fonts and sizes preserved. Being honest: PDFs don’t store Word-style flowing layouts, so complex pages arrive as positioned text sections rather than one continuous flow — normal for PDF conversion, and easy to tidy in Word.' },
  { q: 'Does it work on scanned PDFs?', a: 'Not yet — a scan is a photograph of text, so it needs OCR (text recognition), which is on our roadmap. This tool converts PDFs with real text: exports, reports, invoices, forms.' },
  { q: 'Is there a size limit?', a: 'Up to 50 MB per file, which covers all but the most enormous documents.' },
  { q: 'Is it really free?', a: 'Yes — free, no signup, no watermark, no per-day nagging.' },
];

export default function PdfToWordPage() {
  return (
    <PdfToolPage
      title="PDF to Word"
      description="Convert a PDF into an editable Word document (.docx) — free, fast, and handled honestly: encrypted in transit, converted, then deleted from our server immediately."
      steps={steps}
      faqs={faqs}
    >
      <PdfToWordTool />
    </PdfToolPage>
  );
}
