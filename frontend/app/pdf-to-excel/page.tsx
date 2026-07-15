import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToExcelTool } from '@/components/tools/pdf-to-excel-tool';

export const metadata: Metadata = {
  title: 'PDF to Excel — Convert Tables Free, No Upload | DiemDesk',
  description: 'Extract tables from PDF into Excel or CSV — bank statements, invoices, reports. Editable cells, .xlsx or .csv, and your file never leaves your browser.',
  alternates: { canonical: '/pdf-to-excel' },
  openGraph: { images: ['/og.png'], title: 'PDF to Excel — private, in your browser', description: 'Turn PDF tables into an editable spreadsheet without uploading your file. Export .xlsx or .csv.', type: 'website' },
};

const steps = [
  'Drop a PDF with tables in — it opens on your device and the layout is read in your browser, never uploaded.',
  'We rebuild each table into an editable grid. Check the columns and fix any cell right there.',
  'Export to Excel (.xlsx) or CSV — one sheet per table or combined into one.',
];

const faqs = [
  { q: 'Is my PDF uploaded?', a: 'No. Unlike Smallpdf, iLovePDF or Adobe, DiemDesk reads the page layout entirely in your browser — the file never leaves your device. That matters most for the #1 use: bank and card statements.' },
  { q: 'What formats can I export?', a: 'Excel (.xlsx) or CSV. For multi-page documents you can put each table on its own sheet or combine them into one, and choose whether the first row is a header.' },
  { q: 'How accurate is it?', a: 'For digital PDFs with real text it rebuilds columns from the page layout and is very good. Complex, merged or right-aligned tables can need a tweak — every cell is editable before you export, so you always get it exactly right.' },
  { q: 'Does it work on scanned PDFs?', a: 'A photo-only scan has no text to read. Run it through OCR first to add a text layer, then convert it here. (Automatic OCR + AI cleanup for messy tables are on the way for Pro.)' },
  { q: 'Is there a limit or watermark?', a: 'No watermark, no daily cap, no signup. Basic on-device conversion is free — that’s our privacy calling card. Pro will add batch conversion and AI cleanup for the trickiest tables.' },
];

export default function PdfToExcelPage() {
  return (
    <PdfToolPage
      title="PDF to Excel"
      description="Turn the tables in a PDF into an editable spreadsheet — bank statements, invoices, reports — and export .xlsx or .csv. Converted on your device, never uploaded."
      steps={steps}
      faqs={faqs}
      wide
    >
      <PdfToExcelTool />
    </PdfToolPage>
  );
}
