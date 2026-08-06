import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToEpubTool } from '@/components/tools/pdf-to-epub-tool';

export const metadata: Metadata = {
  title: 'PDF to EPUB — Convert in Your Browser | DiemDesk',
  description: 'Turn a PDF into a real EPUB e-book — chapters, contents, cover and text that reflows on any e-reader. Runs on your device, never uploaded. Free.',
  alternates: { canonical: '/pdf-to-epub' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to EPUB — private, in your browser',
    description: 'Convert a PDF into a reflowable EPUB with chapters and a cover, on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a PDF — it’s read on your device with the same engine as our other tools, never uploaded.',
  'We rebuild the book: headings, lists and tables from the layout, pictures back where they were drawn, chapters from the PDF’s bookmarks or its own headings, and page one as the cover.',
  'Check the chapter list and preview, adjust the title, author and language, then download a real .epub — free, no signup.',
];

const faqs = [
  { q: 'Why convert a PDF to EPUB?', a: 'A PDF is a fixed page, so on a phone or e-reader you end up pinching and scrolling sideways. An EPUB is reflowable: the text rewraps to the screen, you can change the font size, and the reader remembers where you were. It’s the difference between looking at a document and reading a book.' },
  { q: 'Does it keep chapters and a table of contents?', a: 'Yes. If the PDF has bookmarks we split at those, because a person chose them. If it doesn’t, we split at the headings we detect, and fall back to fixed page blocks so a long book never becomes one huge file. Either way you get a working contents list — and you can override the choice before you download.' },
  { q: 'What does “Tidy for reading” do?', a: 'Three things that make a converted book stop looking photocopied: it drops running headers and footers that repeat on every page, removes stray page numbers, and rejoins words that were hyphenated across a line break. In a reflowed book those line breaks land somewhere else entirely, so the leftovers read as errors.' },
  { q: 'Are images included?', a: 'Yes. Pictures are pulled off each page in the order they were drawn and placed back at the same point in the text, so a diagram still sits with the paragraph that refers to it. Logos and letterheads that repeat on every page are left out, along with rules and bullets too small to be content, and there’s a cap so a heavily illustrated book doesn’t become a huge download. You can turn the whole thing off if you only want the text.' },
  { q: 'Does it handle Arabic, Hebrew or Urdu?', a: 'Yes. Pick the language and the book is built right-to-left properly: the text direction, the headings and tables, and the page-turn direction all follow, so the reader pages the book the way it should be read rather than back-to-front.' },
  { q: 'Will it work on my Kindle or Kobo?', a: 'The file is a standard EPUB 3 with an EPUB 2 contents list included as well, so it opens in Apple Books, Google Play Books, Kobo, Calibre and any modern reader. For Kindle, send the .epub to your Send-to-Kindle address and Amazon converts it on arrival.' },
  { q: 'What about scanned PDFs?', a: 'A scanned PDF is an image of a page with no selectable text, so there’s nothing to reflow. Run it through our OCR tool first to add a text layer, then convert it here.' },
  { q: 'Is my PDF uploaded?', a: 'No. The text extraction, the chapter split and the EPUB packing all happen in your browser — the file never leaves your device. You can confirm it in your browser’s Network tab: nothing is sent.' },
];

export default function PdfToEpubPage() {
  return (
    <PdfToolPage
      title="PDF to EPUB"
      description="Turn a PDF into a real e-book — chapters, a contents list, a cover and text that reflows to any screen. It runs entirely in your browser, so your file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <PdfToEpubTool />
    </PdfToolPage>
  );
}
