import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { HtmlToExcelTool } from '@/components/tools/html-to-excel-tool';

export const metadata: Metadata = {
  title: 'HTML to Excel — Web Page Tables to .xlsx | DiemDesk',
  description: 'Pull every table out of a web page into Excel or CSV — merged cells handled properly. Runs in your browser, nothing uploaded. Free.',
  alternates: { canonical: '/html-to-excel' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'HTML to Excel — private, in your browser',
    description: 'Turn the tables on a web page into a spreadsheet, on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a saved web page, paste its source, or try a URL — everything is read in your browser, never uploaded.',
  'Every real table on the page is found and laid out as a grid, with merged cells expanded so the columns still line up.',
  'Fix any cell, drop rows you don’t want, then download .xlsx (one sheet per table) or CSV — free, no signup.',
];

const faqs = [
  { q: 'Why not just copy and paste the table?', a: 'Copy-paste breaks the moment a table uses merged cells: the value only lands in the first square, so every row after it shifts by a column and the numbers end up under the wrong headings. This lays the cells out the way a browser does, then repeats a merged value across the squares it covers, so what you get in Excel matches what you saw on the page.' },
  { q: 'Can I just give it a URL?', a: 'You can try, and it often works. Your browser fetches the page directly — nothing passes through us — but most sites refuse to be read by another page, which is a security feature on their side, not a fault on ours. We don’t proxy it through a server, because then your browsing history would run through us. When a site refuses, save the page with Ctrl+S and drop the file.' },
  { q: 'It says there are no tables, but I can see one.', a: 'Plenty of sites draw what looks like a table using styled boxes rather than a real table. There’s no structure to read in that case, so anything we produced would be a guess. Dashboards and pricing pages are the usual culprits.' },
  { q: 'What about several tables on one page?', a: 'All of them are found, and each is named after its caption or the heading it sits under. Export gives you one sheet per table, or you can combine them into a single sheet with a divider row between each.' },
  { q: 'Are numbers kept as numbers?', a: 'Yes — anything that reads as a number is written as one, so Excel can sum it straight away instead of treating it as text. Everything else is left exactly as it appeared.' },
  { q: 'Is anything uploaded?', a: 'No. The page is parsed in your browser and the .xlsx file is written there too. You can confirm it in your browser’s Network tab — the only request is the one you asked for if you used a URL.' },
];

export default function HtmlToExcelPage() {
  return (
    <PdfToolPage
      title="HTML to Excel"
      description="Pull every table out of a web page and into a spreadsheet — merged cells handled properly, numbers kept as numbers. It runs in your browser, so nothing is uploaded."
      steps={steps}
      faqs={faqs}
    >
      <HtmlToExcelTool />
    </PdfToolPage>
  );
}
