import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OfficeToPdfTool } from '@/components/tools/office-to-pdf-tool';

export const metadata: Metadata = {
  title: 'ODT, ODS, ODP to PDF — OpenDocument Converter | DiemDesk',
  description:
    'Convert LibreOffice and OpenOffice files to PDF — ODT, ODS, ODP and ODG, all in one place. 3 free a day, converted then deleted.',
  alternates: { canonical: '/odf-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'OpenDocument to PDF — ODT, ODS, ODP and ODG',
    description: 'Turn LibreOffice documents, spreadsheets, slides and drawings into PDF. Converted on our server, then deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop an ODT, ODS, ODP or ODG file.',
  'It is rendered by LibreOffice itself, so it looks the way it does on your machine.',
  'Download the PDF. Your original is deleted the moment it finishes.',
];

const faqs = [
  {
    q: 'What is OpenDocument, and what is ODF?',
    a: 'ODF stands for OpenDocument Format — an open, published standard (ISO/IEC 26300) for office documents, and the format LibreOffice and OpenOffice use by default. The file extensions are the giveaway: ODT is a text document, ODS a spreadsheet, ODP a presentation and ODG a drawing. Being a standard rather than one company’s format is why public bodies in a number of countries require it.',
  },
  {
    q: 'Which OpenDocument files can I convert?',
    a: 'All four of the everyday ones: ODT documents, ODS spreadsheets, ODP presentations and ODG drawings — plus the flat-XML versions (FODT, FODS, FODP). One tool rather than four, because you should not have to find a different page depending on which LibreOffice app you happened to open.',
  },
  {
    q: 'Will it look right?',
    a: 'It should. The conversion is done by LibreOffice, which is the program that wrote the file — so it is the same renderer that shows it on your own machine, not a third party guessing at the format.',
  },
  {
    q: 'Why not just export from LibreOffice?',
    a: 'If you have LibreOffice in front of you, do that — it is the same engine. This is for when you do not: a borrowed computer, a phone, a locked-down work machine, or a file someone sent you in a format nothing on your device will open.',
  },
  {
    q: 'Do fonts survive?',
    a: 'Fonts the server has are embedded in the PDF as usual. A document using an unusual font installed only on your own machine will be rendered with the closest available substitute — the same thing that happens when you send that file to a colleague.',
  },
  {
    q: 'Why does this one upload when your other tools do not?',
    a: 'Rendering an office document needs a full office engine, which cannot run in a browser. Your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read.',
  },
  {
    q: 'Is it free?',
    a: 'Three conversions a day are free, no signup; Pro removes the daily cap and the size limit. Our in-browser tools stay free and unlimited — this one costs us server time.',
  },
];

export default function OdfToPdfPage() {
  return (
    <PdfToolPage
      title="OpenDocument to PDF"
      description="Turn LibreOffice and OpenOffice files into PDF — documents, spreadsheets, presentations and drawings, converted by LibreOffice itself."
      steps={steps}
      faqs={faqs}
    >
      <OfficeToPdfTool kindId="odf" />
    </PdfToolPage>
  );
}
