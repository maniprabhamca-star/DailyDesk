import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { BatesNumberingTool } from '@/components/tools/bates-numbering-tool';

export const metadata: Metadata = {
  title: 'Bates Numbering — Stamp PDFs Free, In Your Browser | DiemDesk',
  description: 'Add sequential Bates numbers to PDFs for legal discovery — prefix, start number, padding and position, continuous across many files. On-device, never uploaded.',
  alternates: { canonical: '/bates-numbering' },
  openGraph: {
    images: ['/og.png'],
    title: 'Bates Numbering — private, in your browser',
    description: 'Stamp sequential Bates numbers across a set of PDFs for discovery — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop one or more PDFs — the whole set is numbered in the order you add them, on your device.',
  'Set your prefix, starting number, padding and corner — the live preview shows exactly how each stamp will look.',
  'Download the stamped PDF (or a .zip for a set) — numbering runs continuously across every file, always free.',
];

const faqs = [
  { q: 'What is Bates numbering?', a: 'Bates numbering (or Bates stamping) puts a unique sequential identifier — usually a prefix plus a zero-padded number like ABC-000001 — on every page of a document set. It’s a legal standard for discovery, so every page can be referenced unambiguously across a case.' },
  { q: 'Does the numbering continue across multiple files?', a: 'Yes. Drop several PDFs and the count carries across the whole set in the order you added them: if file one ends on ABC-000040, file two starts at ABC-000041. You get each file stamped, delivered as a .zip when there’s more than one.' },
  { q: 'Can I control the format and position?', a: 'Yes — set a prefix and optional suffix, the starting number, how many digits to zero-pad to, the text size, and which of six corners the stamp sits in. A live preview shows the result before you export. You can also limit stamping to a page range.' },
  { q: 'Are my documents uploaded?', a: 'No. Legal and discovery documents are exactly what you shouldn’t send to a random server, so we don’t — the stamping runs entirely in your browser. Nothing is uploaded, stored, or seen by anyone but you. You can verify it in your browser’s Network tab.' },
  { q: 'Is it free?', a: 'Yes — it runs on your device, so it costs us nothing to serve and stays free and unlimited, no signup or watermark.' },
];

export default function BatesNumberingPage() {
  return (
    <PdfToolPage
      title="Bates Numbering"
      description="Stamp sequential Bates numbers across one or many PDFs for legal discovery — prefix, start number, padding and corner, continuous across the whole set. It runs entirely in your browser, so your documents are never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <BatesNumberingTool />
    </PdfToolPage>
  );
}
