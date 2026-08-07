import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { DocExportTool } from '@/components/tools/doc-export-tool';

export const metadata: Metadata = {
  title: 'PDF to Text — Extract Text in Your Browser | DiemDesk',
  description: 'Pull the plain text out of a PDF — running heads and hyphens tidied. Copy it or save a .txt. On your device, nothing uploaded. Free.',
  alternates: { canonical: '/pdf-to-text' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to Text — private, in your browser',
    description: 'Extract the plain text from a PDF on your device — tidied for reading, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a PDF — the text is read on your device with the same engine as our other tools.',
  'Running headers, footers and page numbers are dropped, and words broken across a line are rejoined.',
  'Copy the text straight out, or download a .txt, Word file or clean PDF. Free, no signup.',
];

const faqs = [
  { q: 'Why not just select all and copy?', a: 'You can, on a short document. On a long one you also copy the running header from every page, the page numbers, and words split across line breaks — so you spend longer cleaning it than reading it. This drops that furniture and rejoins the hyphens as it goes.' },
  { q: 'What does “Tidy for reading” do?', a: 'Three things: it removes lines that repeat at the same edge on half the pages or more (headers and footers), drops stray page numbers, and rejoins a word hyphenated across a line break. Untick it and you get the text exactly as the PDF holds it.' },
  { q: 'Will it work on a scanned PDF?', a: 'No — a scan is a picture of a page with no text layer to extract. The tool detects this and points you at OCR, which adds a text layer first.' },
  { q: 'Does it keep the layout?', a: 'No, and that’s the point of plain text. Columns, tables and boxes are flattened into reading order. If you need the table structure, use PDF to Excel; if you want headings and lists preserved, use PDF to Markdown.' },
  { q: 'Is my PDF uploaded?', a: 'No. Extraction happens in this browser tab, which matters because the documents people most want as text — contracts, statements, reports — are exactly the ones that shouldn’t be handed to a website.' },
  { q: 'Is it free?', a: 'Yes, unlimited and no signup. It runs on your machine, so it costs us nothing to offer.' },
];

export default function PdfToTextPage() {
  return (
    <PdfToolPage
      title="PDF to Text"
      description="Pull the plain text out of a PDF, with the running heads, page numbers and broken hyphens cleaned up. It runs in your browser, so the file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <DocExportTool
        source="pdf"
        to={['txt', 'docx', 'pdf']}
        dropTitle="Drop a PDF to get its text"
        dropHint="headers, footers and hyphen breaks tidied — read on your device, never uploaded"
      />
    </PdfToolPage>
  );
}
