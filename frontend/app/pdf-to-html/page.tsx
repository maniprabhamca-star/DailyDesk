import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ServerConvertTool } from '@/components/tools/server-convert-tool';

export const metadata: Metadata = {
  title: 'PDF to HTML — One Self-Contained Web Page | DiemDesk',
  description:
    'Convert a PDF into a single HTML file with the images built in — no folder of loose pictures to keep track of. 3 free a day.',
  alternates: { canonical: '/pdf-to-html' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to HTML — a single self-contained page',
    description: 'Turn a PDF into one HTML file with its images embedded. Converted on our server, then deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF — it goes over an encrypted connection to our converter.',
  'The page is rebuilt as HTML and every image is folded into the file itself.',
  'Download one .html that opens in any browser. Your PDF is deleted immediately.',
];

const faqs = [
  {
    q: 'Do I get a folder of loose images?',
    a: 'No, and that is the point. Converters usually hand you a page plus a pile of separate picture files, and the moment one goes missing the document is broken. We embed every image inside the HTML, so what you download is one self-contained file you can email, upload or open offline.',
  },
  {
    q: 'What is this actually useful for?',
    a: 'Getting the contents of a PDF onto a website or into a CMS without retyping it, making a long document searchable and linkable, and reading something on a phone without pinching and zooming a fixed page.',
  },
  {
    q: 'Will it look exactly like the PDF?',
    a: 'Close, not identical. A PDF is a fixed page and a web page reflows, so the two cannot be the same thing. Text, headings, images and tables come across; precise typesetting will shift. If you need it to look identical everywhere, rasterizing the PDF is the tool for that, not HTML.',
  },
  {
    q: 'Is the file bigger than the PDF?',
    a: 'Usually somewhat, because embedded images are encoded as text and that costs about a third extra. In exchange there is only one file to keep.',
  },
  {
    q: 'Why does this one upload when your other tools do not?',
    a: 'The conversion needs a full office engine, which cannot run in a browser. Your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read.',
  },
];

export default function PdfToHtmlPage() {
  return (
    <PdfToolPage
      title="PDF to HTML"
      description="Turn a PDF into a web page — one self-contained HTML file with the images built in, not a page plus a folder of pictures to lose."
      steps={steps}
      faqs={faqs}
    >
      <ServerConvertTool
        endpoint="/api/convert/pdf-to-html"
        sessionKey="pdf-to-html"
        outExt="html"
        ctaLabel="Convert to HTML"
        hint="Get one self-contained .html — up to 50 MB, 3 free a day"
        excludeHref="/pdf-to-html"
        disclosure="Unlike our in-browser tools, rebuilding a PDF as a web page needs our server: your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read."
      />
    </PdfToolPage>
  );
}
