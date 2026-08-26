import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ServerConvertTool } from '@/components/tools/server-convert-tool';

export const metadata: Metadata = {
  title: 'PDF to RTF — Convert to Rich Text Format | DiemDesk',
  description:
    'Convert a PDF to RTF — the editable format that opens in almost any word processor, however old. 3 free a day. Converted, then deleted.',
  alternates: { canonical: '/pdf-to-rtf' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to RTF — Rich Text Format converter',
    description: 'Turn a PDF into editable RTF that opens anywhere. Converted on our server, then deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF — it goes over an encrypted connection to our converter.',
  'The text and layout are rebuilt as Rich Text Format.',
  'Download the .rtf. Your PDF is deleted the moment it finishes.',
];

const faqs = [
  {
    q: 'Why RTF rather than Word?',
    a: 'Because RTF opens in nearly everything — WordPad, TextEdit, Pages, Google Docs, LibreOffice, and the elderly software that a lot of offices and courts still run. If a system has rejected your .docx, RTF is usually the format it will take.',
  },
  {
    q: 'Will the formatting survive?',
    a: 'Text, headings, bold and italic, and simple tables carry over well. RTF is an older format than DOCX and has no real equivalent for some modern layout, so a heavily designed page will come through plainer than it started.',
  },
  {
    q: 'What about a scanned PDF?',
    a: 'A scan is a picture of text, so there is nothing to convert into words. Run it through OCR PDF first to make the text real, then come back here.',
  },
  {
    q: 'Why does this one upload when your other tools do not?',
    a: 'Converting a PDF back into an editable document needs a full office engine, which cannot run in a browser. So your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read.',
  },
  {
    q: 'Is it free?',
    a: 'Three conversions a day are free, no signup. Pro removes the daily cap and the size limit. Our in-browser tools stay free and unlimited — this one costs us server time.',
  },
];

export default function PdfToRtfPage() {
  return (
    <PdfToolPage
      title="PDF to RTF"
      description="Turn a PDF into Rich Text Format — the editable document format that almost anything can open, including the software that refuses your .docx."
      steps={steps}
      faqs={faqs}
    >
      <ServerConvertTool
        endpoint="/api/convert/pdf-to-rtf"
        sessionKey="pdf-to-rtf"
        outExt="rtf"
        ctaLabel="Convert to RTF"
        hint="Get an editable .rtf — up to 50 MB, 3 free a day"
        excludeHref="/pdf-to-rtf"
        disclosure="Unlike our in-browser tools, rebuilding a PDF as an editable document needs our server: your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read."
      />
    </PdfToolPage>
  );
}
