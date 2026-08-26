import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { RasterizeTool } from '@/components/pdf/page-ops-tool';

export const metadata: Metadata = {
  title: 'Rasterize PDF — Flatten Pages to Images | DiemDesk',
  description:
    'Turn every PDF page into an image so nothing can be selected, copied or edited. Free, and your file never leaves your browser.',
  alternates: { canonical: '/rasterize-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Rasterize PDF — Flatten Every Page to an Image | DiemDesk',
    description: 'Convert PDF pages to images inside one PDF, privately in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF you want flattened.',
  'Pick the detail level — 150 DPI prints well, 96 is fine on screen.',
  'Download. Every page is now a picture inside the same PDF.',
];

const faqs = [
  { q: 'What does rasterizing actually do?', a: 'It draws each page as a picture and puts that picture back into a PDF of the same size. The result looks the same to a reader, but there is no longer any text, vector art or interactive content underneath — only pixels.' },
  { q: 'Why would I want that?', a: 'Three common reasons. To make a document look identical everywhere, regardless of which fonts the reader has. To stop people lifting the text, tweaking a form field or editing a figure. And to tame a file that renders slowly or inconsistently because of exotic fonts or transparency.' },
  { q: 'How is this different from Flatten PDF?', a: 'They overlap, and it would be misleading to pretend otherwise. Flatten PDF has two modes: one fixes interactive form fields into the page and leaves the text selectable, and the other locks the pages as images — which is the same operation as this tool. Use Flatten when your document has form fields or annotations you want made permanent, and this when the document has none and you simply want every page turned into a picture, with the detail level and greyscale under your control.' },
  { q: 'What does “flattening” mean, then?', a: 'Flattening merges an interactive layer into the page: a form field someone could retype becomes fixed content, like printed ink. That is a different job from rasterizing, which discards the text entirely. A flattened form still has selectable text unless you also lock the pages as images.' },
  { q: 'Can I undo it?', a: 'Not really. Once the text is pixels it is gone — running OCR afterwards can recover approximate text, but the original is not coming back. Keep your original file.' },
  { q: 'Which DPI should I choose?', a: '150 DPI is the sensible default and prints well. 96 is fine for something only read on screen and produces a much smaller file. 300 is for archival or fine detail and will make the file considerably larger.' },
  { q: 'Is my file uploaded?', a: 'No. Each page is rendered and re-assembled inside your browser, so the document never reaches a server. That matters here — people usually rasterize precisely because a document is sensitive.' },
];

export default function RasterizePdfPage() {
  return (
    <PdfToolPage
      title="Rasterize PDF"
      description="Turn every page into an image inside the same PDF — nothing left to select, copy or edit, and it looks identical on every device."
      steps={steps}
      faqs={faqs}
    >
      <RasterizeTool />
    </PdfToolPage>
  );
}
