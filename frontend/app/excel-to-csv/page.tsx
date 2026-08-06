import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SheetConvertTool } from '@/components/tools/sheet-convert-tool';

export const metadata: Metadata = {
  title: 'Excel to CSV — Convert XLSX in Your Browser | DiemDesk',
  description: 'Turn an Excel workbook into CSV — every sheet, dates readable, nothing uploaded. Runs on your device. Free, no signup.',
  alternates: { canonical: '/excel-to-csv' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Excel to CSV — private, in your browser',
    description: 'Convert .xlsx to CSV on your device — every sheet, dates kept readable, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop an .xlsx workbook — it’s unzipped and read in your browser, never uploaded.',
  'Every sheet comes through with its own tab. Check the grid, fix a cell or drop a row if you need to.',
  'Download CSV — one sheet, or all of them one after another. Free, no signup.',
];

const faqs = [
  { q: 'Why not just “Save as CSV” in Excel?', a: 'You can, if you have Excel open on that machine. This is for the times you don’t: a workbook someone emailed you, a file on a locked-down work laptop, a Chromebook, or a phone. It also means the spreadsheet doesn’t go near an upload site — which matters when it’s payroll, patient lists or customer data.' },
  { q: 'What happens to dates?', a: 'Excel stores dates as a day count, which is why so many converters hand you five-digit numbers where the dates should be. We read the cell’s format, spot the date ones and write them as plain YYYY-MM-DD instead — so the CSV is readable the moment it opens.' },
  { q: 'What about formulas?', a: 'You get the value the formula produced, not the formula itself — which is what CSV can hold. If you need the formulas preserved, keep the .xlsx.' },
  { q: 'Does it handle multiple sheets?', a: 'Yes. Each sheet is listed as a tab, and on export you can take them one after another in a single CSV or combine them. CSV has no concept of sheets, so there’s no way to keep them properly separate in one file.' },
  { q: 'Is my spreadsheet uploaded?', a: 'No. An .xlsx is a zip of XML, and we unzip and read it right here in the browser. Nothing is sent to a server — check the Network tab and you’ll see it.' },
  { q: 'What about the other direction?', a: 'Use CSV to Excel, at /csv-to-excel — same idea, same privacy, going the other way.' },
];

export default function ExcelToCsvPage() {
  return (
    <PdfToolPage
      title="Excel to CSV"
      description="Turn an Excel workbook into clean CSV — every sheet, with dates that read as dates instead of five-digit numbers. It runs in your browser, so the spreadsheet is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SheetConvertTool
        from="xlsx"
        to={['csv', 'json', 'xlsx']}
        dropTitle="Drop an Excel workbook"
        dropHint="every sheet becomes CSV — read on your device, never uploaded"
      />
    </PdfToolPage>
  );
}
