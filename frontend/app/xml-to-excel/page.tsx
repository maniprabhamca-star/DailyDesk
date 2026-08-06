import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SheetConvertTool } from '@/components/tools/sheet-convert-tool';

export const metadata: Metadata = {
  title: 'XML to Excel — Convert XML to XLSX or CSV | DiemDesk',
  description: 'Turn an XML file into a spreadsheet — repeating records become rows, attributes become columns. On your device, nothing uploaded. Free.',
  alternates: { canonical: '/xml-to-excel' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'XML to Excel — private, in your browser',
    description: 'Convert XML records into .xlsx or CSV on your device — attributes and child elements become columns.',
    type: 'website',
  },
};

const steps = [
  'Drop an .xml file or paste the XML — a bank export, an invoice batch, an RSS feed, a database dump.',
  'We find the element that repeats and make each one a row; child elements and attributes become the columns.',
  'Check the grid, then download .xlsx or CSV — in your browser, free, nothing uploaded.',
];

const faqs = [
  { q: 'How does it know what a row is?', a: 'By what repeats. In almost every real XML file the records are the element that appears most — <row>, <item>, <record>, <Invoice> — so we pick that and make each one a row, rather than asking you to name it. Attributes come through as columns prefixed with @, and repeated child elements as parent.child.' },
  { q: 'What kinds of XML does this suit?', a: 'The data-shaped kind: bank and accounting exports, invoice batches, RSS and sitemap feeds, API dumps, product feeds. A document-shaped XML — one long article with markup through it — has no repeating record to turn into rows, and this will tell you so instead of guessing.' },
  { q: 'Does it handle namespaces?', a: 'Yes, and the prefix is kept in the column name so two similarly named fields from different namespaces don’t silently merge into one column.' },
  { q: 'Is my file uploaded?', a: 'No — it’s parsed in this browser tab and the spreadsheet is written here too. XML exports are often financial or customer records, so this is exactly the sort of file that shouldn’t be handed to a converter site.' },
  { q: 'It says there’s no repeating element.', a: 'That means the file has no list in it — a single record, or a document rather than data. There’s nothing to lay out as rows, so we say so rather than hand you a one-row spreadsheet that looks like a bug.' },
  { q: 'What about e-invoice XML?', a: 'A Factur-X or ZUGFeRD invoice will read as one record, which is often not what you want. Proper structured e-invoice handling is on our roadmap as its own tool.' },
];

export default function XmlToExcelPage() {
  return (
    <PdfToolPage
      title="XML to Excel"
      description="Turn an XML export into a spreadsheet — the repeating record becomes a row, attributes and child elements become columns. It runs in your browser, so the file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SheetConvertTool
        from="xml"
        to={['xlsx', 'csv', 'json']}
        dropTitle="Drop an XML file"
        dropHint="repeating records become rows — read on your device, never uploaded"
        pasteHint={'Paste XML here, e.g.\n<orders>\n  <order id="1001"><customer>Priya</customer><total>420.50</total></order>\n  <order id="1002"><customer>Sam</customer><total>98.00</total></order>\n</orders>'}
      />
    </PdfToolPage>
  );
}
