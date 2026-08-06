import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SheetConvertTool } from '@/components/tools/sheet-convert-tool';

export const metadata: Metadata = {
  title: 'CSV to Excel — Convert to XLSX in Your Browser | DiemDesk',
  description: 'Turn a CSV into a proper .xlsx workbook — semicolons and tabs detected, numbers kept as numbers. On your device, nothing uploaded. Free.',
  alternates: { canonical: '/csv-to-excel' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'CSV to Excel — private, in your browser',
    description: 'Convert CSV to a real .xlsx workbook on your device — separators detected, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a .csv or .tsv — or paste the rows straight in. It’s read in your browser, never uploaded.',
  'The separator is detected for you (comma, semicolon or tab), and quoted fields with commas inside stay in one cell.',
  'Check the grid, then download a real .xlsx workbook. Free, no signup.',
];

const faqs = [
  { q: 'Why does my CSV open as one column in Excel?', a: 'Because Excel assumes your region’s separator. A file exported in Germany uses semicolons; one copied out of a table uses tabs. Open it in the wrong locale and every row lands in column A. This detects the separator from the file itself, so the columns come out right regardless of where it was made.' },
  { q: 'Will numbers stay numbers?', a: 'Yes. Anything that reads as a number is written as one, so Excel can sum it straight away instead of showing the green “number stored as text” warning on every cell.' },
  { q: 'What about a comma inside a quoted field?', a: 'Handled — that’s the part naive converters get wrong. “Smith, John” stays in one cell, doubled quotes come through as one quote, and a field containing a line break stays a single cell.' },
  { q: 'Is my file uploaded?', a: 'No. The CSV is parsed and the .xlsx is written inside this browser tab. Nothing is sent to a server, which is the difference between this and most online converters — worth caring about when the file is customer or payroll data.' },
  { q: 'Can I paste instead of uploading?', a: 'Yes — switch to the Paste tab and drop the rows in. Useful when you’ve copied a table out of somewhere and don’t have a file at all.' },
  { q: 'What about the other direction?', a: 'Excel to CSV, at /excel-to-csv — the same thing in reverse, including readable dates.' },
];

export default function CsvToExcelPage() {
  return (
    <PdfToolPage
      title="CSV to Excel"
      description="Turn a CSV into a proper .xlsx workbook — with the separator detected for you, so it doesn’t all land in column A. It runs in your browser, so your data is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SheetConvertTool
        from="csv"
        to={['xlsx', 'csv', 'json']}
        dropTitle="Drop a CSV file"
        dropHint="commas, semicolons or tabs — detected for you, read on your device"
        pasteHint={'Paste your rows here, e.g.\nName,Team,Joined\nPriya,Design,2026-01-14\nSam,Engineering,2025-11-02'}
      />
    </PdfToolPage>
  );
}
