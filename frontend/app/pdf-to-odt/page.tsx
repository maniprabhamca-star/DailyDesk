import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ServerConvertTool } from '@/components/tools/server-convert-tool';

export const metadata: Metadata = {
  title: 'PDF to ODT — Editable OpenDocument Converter | DiemDesk',
  description:
    'Convert a PDF into an editable ODT for LibreOffice or OpenOffice — the open format, no Microsoft round trip. 3 free a day.',
  alternates: { canonical: '/pdf-to-odt' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to ODT — editable OpenDocument',
    description: 'Turn a PDF into an editable .odt for LibreOffice. Converted on our server, then deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF — it goes over an encrypted connection to our converter.',
  'It is rebuilt as an OpenDocument text file, keeping text and layout where it can.',
  'Download the .odt and edit it. Your PDF is deleted the moment it finishes.',
];

const faqs = [
  {
    q: 'Why ODT instead of Word?',
    a: 'If you work in LibreOffice or OpenOffice, ODT is the native format — nothing is translated on the way in, so nothing shifts. Converting to .docx and opening that in LibreOffice puts an extra translation between you and your document, and that is where formatting tends to drift.',
  },
  {
    q: 'Is ODT an open standard?',
    a: 'Yes. OpenDocument is an ISO standard (ISO/IEC 26300), which is why a number of governments and public bodies require documents in it. If you have been asked for ODF rather than a Microsoft format, this is what they mean.',
  },
  {
    q: 'How well does the layout survive?',
    a: 'Text, headings, lists and straightforward tables come across well. Multi-column layouts and heavy design will need tidying — that is true of every PDF-to-editable conversion, because a PDF stores the finished appearance, not the structure that produced it.',
  },
  {
    q: 'What about a scanned PDF?',
    a: 'There is no text in a scan to recover — it is a picture. Run OCR PDF over it first, then convert.',
  },
  {
    q: 'Why does this one upload when your other tools do not?',
    a: 'It needs a full office engine, which cannot run in a browser. Your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read.',
  },
];

export default function PdfToOdtPage() {
  return (
    <PdfToolPage
      title="PDF to ODT"
      description="Turn a PDF into an editable OpenDocument file for LibreOffice or OpenOffice — the open format, without a detour through Microsoft."
      steps={steps}
      faqs={faqs}
    >
      <ServerConvertTool
        endpoint="/api/convert/pdf-to-odt"
        sessionKey="pdf-to-odt"
        outExt="odt"
        ctaLabel="Convert to ODT"
        hint="Get an editable .odt — up to 50 MB, 3 free a day"
        excludeHref="/pdf-to-odt"
        disclosure="Unlike our in-browser tools, rebuilding a PDF as an editable document needs our server: your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read."
      />
    </PdfToolPage>
  );
}
