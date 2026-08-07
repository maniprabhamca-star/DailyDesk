import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { DocExportTool } from '@/components/tools/doc-export-tool';

export const metadata: Metadata = {
  title: 'EPUB to PDF — Convert an E-book in Your Browser | DiemDesk',
  description: 'Turn an EPUB into a PDF, Word document or plain text — chapters in the right order. On your device, nothing uploaded. Free.',
  alternates: { canonical: '/epub-to-pdf' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'EPUB to PDF — private, in your browser',
    description: 'Convert an EPUB to PDF, Word or plain text on your device — chapters in the book’s own order.',
    type: 'website',
  },
};

const steps = [
  'Drop an .epub — it’s unzipped and read in your browser, never uploaded.',
  'Chapters are followed in the order the book declares, not by file name, so nothing arrives shuffled.',
  'Download a PDF, a Word document or plain text. Free, no signup.',
];

const faqs = [
  { q: 'Why would I turn an e-book into a PDF?', a: 'To print it, to mark it up in a tool that only takes PDFs, or to hand it to someone whose device won’t open EPUB. It’s the opposite trade to reading: you give up reflowing and get a fixed page you can annotate and print.' },
  { q: 'Do the chapters come out in the right order?', a: 'Yes. An EPUB declares its reading order in a spine, and that’s what we follow. Converters that just list the files inside the zip get books back in alphabetical order — which is why chapter 10 sometimes lands after chapter 1.' },
  { q: 'What does the PDF look like?', a: 'Clean and readable rather than typeset: headings, paragraphs and lists on A4, with each chapter starting a new page. It’s made for reading and printing, not for reproducing the publisher’s design.' },
  { q: 'What about books in Tamil, Arabic or Chinese?', a: 'The built-in PDF fonts only cover Latin characters, so those would come out as empty boxes. The tool detects this and says so — choose Word or plain text and every character comes through intact.' },
  { q: 'Are pictures included?', a: 'Not in this version — the text, headings and lists come across. Images inside the EPUB are a later addition.' },
  { q: 'Is my book uploaded?', a: 'No. An EPUB is a zip of XHTML, and it’s unzipped and read entirely in this browser tab. Nothing is sent anywhere — which also matters if the book is a manuscript rather than something published.' },
  { q: 'Can I go the other way?', a: 'Yes — PDF to EPUB, at /pdf-to-epub, turns a fixed-page PDF into a reflowable book with chapters, a cover and pictures in place.' },
];

export default function EpubToPdfPage() {
  return (
    <PdfToolPage
      title="EPUB to PDF"
      description="Turn an e-book into a PDF, a Word document or plain text — with the chapters in the order the book itself declares. It runs in your browser, so the file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <DocExportTool
        source="epub"
        to={['pdf', 'docx', 'txt']}
        dropTitle="Drop an EPUB"
        dropHint="chapters in the book’s own order — read on your device, never uploaded"
      />
    </PdfToolPage>
  );
}
