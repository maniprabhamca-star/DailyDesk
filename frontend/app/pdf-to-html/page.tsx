import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToHtmlTool } from '@/components/tools/pdf-to-html-tool';

export const metadata: Metadata = {
  title: 'PDF to HTML — Convert a PDF to a Web Page | DiemDesk',
  description:
    'Turn a PDF into clean HTML with real text, headings, lists and tables — free, and converted on your device rather than uploaded.',
  alternates: { canonical: '/pdf-to-html' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to HTML — a real web page, not a picture of one',
    description: 'Convert a PDF to clean HTML with selectable text, entirely in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF — it is read in your browser, not uploaded.',
  'Headings, lists and tables are detected; turn either off if you prefer plain paragraphs.',
  'Copy the HTML or download one self-contained .html file.',
];

const faqs = [
  {
    q: 'Do I get real text, or a picture of the page?',
    a: 'Real text. That distinction matters more than it sounds: the usual desktop-office route converts a PDF by drawing each block as an image, so you end up with a page full of pictures and nothing you can search, select, translate or index. We read the actual text layer, so the output is a proper document.',
  },
  {
    q: 'What comes across?',
    a: 'Headings, paragraphs, bulleted and numbered lists, and tables. Headings are worked out from the size and weight of the type rather than guessed, and you can switch that off if a document confuses it.',
  },
  {
    q: 'What about images in the PDF?',
    a: 'They are not carried over — this converts the text and structure. If you need the pictures, Extract images from PDF pulls them out at their original quality, and you can drop them into the page yourself.',
  },
  {
    q: 'Will it look exactly like the PDF?',
    a: 'No, and it should not. A PDF is a fixed page; a web page reflows to fit whatever it is read on. You get the content in a form that works on a phone, in a CMS or in a search index. If you need something that looks identical everywhere, rasterize the PDF instead.',
  },
  {
    q: 'What about a scanned PDF?',
    a: 'A scan holds no text to read — it is a photograph of a page. Run OCR PDF over it first to add a text layer, then convert. The tool tells you when it sees this rather than handing you an empty page.',
  },
  {
    q: 'Is my file uploaded?',
    a: 'No. The PDF is read in your browser and the HTML is built there too, so the document never reaches a server. There is no daily limit either, because it costs us nothing to run.',
  },
];

export default function PdfToHtmlPage() {
  return (
    <PdfToolPage
      title="PDF to HTML"
      description="Turn a PDF into a real web page — selectable text, headings, lists and tables — converted in your browser, never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <PdfToHtmlTool />
    </PdfToolPage>
  );
}
