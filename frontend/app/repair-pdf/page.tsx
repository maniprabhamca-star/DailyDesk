import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { RepairPdfTool } from '@/components/tools/repair-pdf-tool';

export const metadata: Metadata = {
  title: 'Repair PDF — Fix Corrupt Files, In Your Browser | DiemDesk',
  description: 'Fix a PDF that won’t open or shows “file is corrupt” — rebuilds the page index on your device. Never uploaded, always free.',
  alternates: { canonical: '/repair-pdf' },
  openGraph: { images: ['/og.png'], title: 'Repair PDF — fix corrupt files, privately', description: 'Rebuild a damaged PDF in your browser. The broken file is never uploaded.', type: 'website' },
};

const steps = [
  'Drop the PDF that won’t open — it’s read and rebuilt on your device, never uploaded.',
  'We reconstruct the page index (the part that’s usually broken) and drop corrupted junk.',
  'Download the repaired file and open it to confirm — all in your browser, always free.',
];

const faqs = [
  { q: 'What kinds of damage can this fix?', a: 'The common ones: a broken cross-reference table or trailer (the index a reader uses to find pages), truncated or badly-written files, and malformed metadata. Rebuilding the file from a tolerant parse fixes most “won’t open” and “file is corrupt” cases.' },
  { q: 'What can’t it fix?', a: 'If the actual page content — not just the index — is destroyed (for example a download that cut off mid-file), those pages can’t be invented back. We tell you honestly how many pages were recoverable rather than handing you a silently incomplete file.' },
  { q: 'Is my broken file uploaded anywhere?', a: 'No. A damaged document is exactly the file you shouldn’t send to a random server. The repair runs entirely in your browser — nothing is uploaded, stored, or seen by anyone but you.' },
  { q: 'Is it really free?', a: 'Yes — it runs on your device, so it costs us nothing and stays free and unlimited, no signup.' },
];

export default function RepairPdfPage() {
  return (
    <PdfToolPage
      title="Repair PDF"
      description="Fix a PDF that won’t open, shows up blank, or reports “file is corrupt”. We rebuild the page index on your device — the broken file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <RepairPdfTool />
    </PdfToolPage>
  );
}
