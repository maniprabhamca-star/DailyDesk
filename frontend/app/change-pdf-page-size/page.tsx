import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PageSizeTool } from '@/components/pdf/page-ops-tool';

export const metadata: Metadata = {
  title: 'Change PDF Page Size — Resize to A4, Letter or Unify | DiemDesk',
  description:
    'Set every PDF page to A4, Letter or any size — or make a document with mixed page sizes consistent. Free, and your file never leaves your browser.',
  alternates: { canonical: '/change-pdf-page-size' },
  openGraph: {
    images: ['/og.png'],
    title: 'Change PDF Page Size — Resize or Unify | DiemDesk',
    description: 'Resize PDF pages, or make a mixed-up document one consistent size, privately in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF whose pages are the wrong size, or disagree with each other.',
  'Either unify it to whatever size it mostly already uses, or pick one.',
  'Download — content is scaled to fit and centred, never cropped.',
];

const faqs = [
  { q: 'Why would a PDF have different page sizes?', a: 'Because it was assembled. Merge a scanned receipt into a Letter report and add an A4 invoice, and you have three sizes in one file. It reads oddly on screen and prints worse, with pages jumping between trays or being scaled unpredictably.' },
  { q: 'What does “unify” do?', a: 'It finds the size the document already uses most and makes every page match it. A file that is mostly A4 with two stray pages becomes all A4 — rather than all converted to something new that none of it was.' },
  { q: 'Will anything be cut off?', a: 'No. Each page is scaled to fit inside the new size and centred, so a page going to a different shape gains a margin rather than losing its edges.' },
  { q: 'Does it stay sharp?', a: 'Yes. Pages are re-placed as vector content, so text and lines stay crisp at any size — this is not a re-scan.' },
  { q: 'Is my file uploaded?', a: 'No. Everything happens inside your browser and the document never reaches a server.' },
];

export default function ChangePdfPageSizePage() {
  return (
    <PdfToolPage
      title="Change page size"
      description="Give every page one size — A4, Letter, or whatever the document mostly already uses. Nothing is cropped."
      steps={steps}
      faqs={faqs}
    >
      <PageSizeTool />
    </PdfToolPage>
  );
}
