import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OfficeToPdfTool } from '@/components/tools/office-to-pdf-tool';

export const metadata: Metadata = {
  title: 'Excel to PDF — Convert XLSX to PDF Free | DiemDesk',
  description:
    "Convert an Excel spreadsheet (XLSX, XLS, ODS, CSV) to PDF free — every sheet paginated cleanly. Sent encrypted, converted and deleted immediately.",
  alternates: { canonical: '/excel-to-pdf' },
  openGraph: {
    images: ['/og/excel-to-pdf.png'],
    title: 'Excel to PDF — Convert XLSX to PDF Free | DiemDesk',
    description: 'Turn spreadsheets into shareable PDFs free — converted securely and deleted immediately.',
    type: 'website',
  },
};

const steps = [
  'Drop your spreadsheet in — it uploads over an encrypted connection.',
  'Our server lays every sheet out onto PDF pages.',
  'The PDF downloads automatically — and your spreadsheet is deleted immediately.',
];

const faqs = [
  { q: 'How are big sheets paginated?', a: 'The same way Excel prints: wide sheets flow across pages left-to-right, then down. If your workbook has a print area or page setup defined, it’s respected — setting those in Excel first gives you full control of the layout.' },
  { q: 'Does it convert every sheet?', a: 'Yes — all sheets in the workbook become part of one PDF, in order. Formulas are rendered as their computed values, exactly as a printout would show.' },
  { q: 'What happens to my file?', a: 'Encrypted in transit, converted in an isolated temporary folder, deleted the moment your download starts. Spreadsheets are often the most sensitive files people have — nothing is stored or read.' },
  { q: 'Which formats can I convert?', a: 'XLSX, the older XLS, ODS, and plain CSV. After converting, “Keep moving” hands the PDF straight to Compress, Merge, Watermark, or Protect.' },
  { q: 'Is there a size limit?', a: 'Up to 50 MB per file.' },
  { q: 'Is it really free?', a: 'Yes — free, no signup, no watermark.' },
];

export default function ExcelToPdfPage() {
  return (
    <PdfToolPage
      title="Excel to PDF"
      description="Convert Excel spreadsheets to clean, shareable PDFs — every sheet paginated like a perfect printout. Free, fast, and handled honestly: encrypted, converted, deleted immediately."
      steps={steps}
      faqs={faqs}
    >
      <OfficeToPdfTool kindId="excel" />
    </PdfToolPage>
  );
}
