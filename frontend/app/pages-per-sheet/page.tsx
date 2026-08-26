import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PagesPerSheetTool } from '@/components/pdf/page-ops-tool';

export const metadata: Metadata = {
  title: 'Pages Per Sheet — Print Multiple PDF Pages on One Page | DiemDesk',
  description:
    'Put 2, 4, 9 or 16 PDF pages on one sheet — save paper, and turn a long document short. Free, no signup, and your file never leaves your browser.',
  alternates: { canonical: '/pages-per-sheet' },
  openGraph: {
    images: ['/og.png'],
    title: 'Pages Per Sheet — Multiple PDF Pages on One Sheet | DiemDesk',
    description: 'Lay several PDF pages onto one sheet for printing, privately in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF you want to print more compactly.',
  'Choose how many pages go on each sheet, and the paper size.',
  'Download the new PDF and print it — a quarter of the paper at 4-up.',
];

const faqs = [
  { q: 'What does “pages per sheet” mean?', a: 'It puts several of the document’s pages side by side on one printed sheet, shrinking each to fit. Printing a 40-page report 4-up turns it into 10 sheets. Printers call the same thing N-up.' },
  { q: 'How many can I fit?', a: '2, 4, 6, 8, 9 or 16. Beyond about 9 the text on a normal document stops being comfortable to read, so treat 16 as a contact-sheet view rather than something to read properly.' },
  { q: 'Does the text stay sharp?', a: 'Yes. The pages are placed as vector content, not screenshots, so they print at your printer’s full resolution however small they are on the sheet.' },
  { q: 'Why not just use my printer’s own N-up setting?', a: 'You can — but printer drivers differ wildly, many mobile and web print paths do not offer it, and you cannot email a driver setting to someone. This produces an actual PDF laid out that way, which anyone can print or read.' },
  { q: 'Is my file uploaded?', a: 'No. The layout is done inside your browser and the document never reaches a server.' },
];

export default function PagesPerSheetPage() {
  return (
    <PdfToolPage
      title="Pages per sheet"
      description="Put several PDF pages on a single sheet — 2, 4, 9 or 16 up. Read a long document short, and use a fraction of the paper."
      steps={steps}
      faqs={faqs}
    >
      <PagesPerSheetTool />
    </PdfToolPage>
  );
}
