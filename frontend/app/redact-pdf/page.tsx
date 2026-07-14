import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { RedactTool } from '@/components/pdf/redact-tool';

export const metadata: Metadata = {
  title: 'Redact PDF — Permanently Black Out Text, Free | DiemDesk',
  description:
    "Redact a PDF in your browser: black out sensitive text and the content underneath is permanently removed — not just covered. Private, never uploaded.",
  alternates: { canonical: '/redact-pdf' },
  robots: { index: false, follow: false },
  openGraph: {
    images: ['/og.png'],
    title: 'Redact PDF — DiemDesk',
    description: 'Permanently black out sensitive PDF content, right in your browser. Nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop in a PDF — it opens right in your browser, never uploaded.',
  'Drag boxes over anything sensitive — pick black, white or a labelled bar.',
  'Download your redacted PDF: the covered content is permanently removed, and hidden metadata is stripped.',
];

const faqs = [
  { q: 'Is the text really removed, or just covered?', a: 'Really removed. Each redacted page is rebuilt as a flat image with the boxes burned in, so the hidden text is gone — it can’t be copied, searched, or peeled back. Many free tools just lay a box on top; we don’t.' },
  { q: 'Is my file uploaded anywhere?', a: 'No. Redaction runs entirely in your browser — the document is opened locally and rebuilt on your device. Nothing is sent to a server.' },
  { q: 'Does it remove hidden information too?', a: 'Yes — the exported file has its metadata (author, title, keywords, producer) stripped, so hidden details don’t travel with it.' },
  { q: 'Can I redact several pages?', a: 'Yes. Move between pages and box anything sensitive; every page you mark is redacted in the final file. Pages you don’t touch are copied through untouched.' },
  { q: 'Can it find and redact every match for me? (Pro)', a: 'Yes — Find & redact is a Pro feature. Search the document’s text for a word, name or number and it boxes every match at once, plus one-tap presets for emails, phone numbers, SSNs and card numbers. It finds the matches for you to review, then the export removes them for good. Drawing boxes by hand is always free.' },
];

export default function RedactPdfPage() {
  return (
    <PdfToolPage
      title="Redact PDF"
      description="Permanently black out sensitive text — the content underneath is removed, not just covered. Runs in your browser; your file never leaves your device."
      steps={steps}
      faqs={faqs}
      wide
    >
      <RedactTool />
    </PdfToolPage>
  );
}
