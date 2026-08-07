import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { DocExportTool } from '@/components/tools/doc-export-tool';

export const metadata: Metadata = {
  title: 'Markdown to PDF — Convert in Your Browser | DiemDesk',
  description: 'Turn Markdown into a clean PDF or Word document — headings, lists and tables kept. On your device, nothing uploaded. Free, no signup.',
  alternates: { canonical: '/markdown-to-pdf' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Markdown to PDF — private, in your browser',
    description: 'Convert Markdown to a clean PDF or Word document on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a .md file, or paste the Markdown straight in.',
  'Headings, bullet and numbered lists, quotes, code and tables are laid out for reading.',
  'Download a PDF or a Word document — or copy the plain text. Free, no signup.',
];

const faqs = [
  { q: 'What Markdown does it understand?', a: 'The parts that carry structure: ATX and underlined headings, bullet and numbered lists, block quotes, fenced code, horizontal rules, and GitHub-style tables. Inline marks like **bold**, `code` and links are cleaned up — a link becomes its text followed by the URL, so nothing is lost on paper.' },
  { q: 'PDF or Word — which should I pick?', a: 'PDF for something you’re sending or printing and don’t want edited. Word if someone needs to keep working on it. Tables survive properly in Word; in the PDF each row is laid out as a line, because the PDF writer here is built for reading rather than typesetting.' },
  { q: 'What about non-Latin text?', a: 'The built-in PDF fonts cover Latin only, so Tamil, Arabic, Chinese and similar would come out as empty boxes. The tool spots that and tells you — Word and plain text keep every character.' },
  { q: 'Are images included?', a: 'Not yet. An image’s alt text comes through so the meaning stays, but the picture itself isn’t embedded. That’s the next addition to this tool.' },
  { q: 'Is anything uploaded?', a: 'No. The Markdown is parsed and the PDF or Word file written in this browser tab. Notes and drafts are usually the last thing you want to hand to a website.' },
  { q: 'Can I go the other way?', a: 'Yes — PDF to Markdown, at /pdf-to-markdown, rebuilds headings, lists and tables out of a PDF’s layout.' },
];

export default function MarkdownToPdfPage() {
  return (
    <PdfToolPage
      title="Markdown to PDF"
      description="Turn Markdown into a clean PDF or Word document — headings, lists, quotes and tables laid out for reading. It runs in your browser, so nothing is uploaded."
      steps={steps}
      faqs={faqs}
    >
      <DocExportTool
        source="markdown"
        to={['pdf', 'docx', 'txt']}
        dropTitle="Drop a Markdown file"
        dropHint="headings, lists and tables laid out for reading — on your device, never uploaded"
        pasteHint={'# Quarterly notes\n\nRevenue held steady, with **two** exceptions:\n\n- Design tools grew 12%\n- Print declined\n\n| Region | Q1 |\n| --- | --- |\n| India | 1400 |\n| UK | 68 |'}
      />
    </PdfToolPage>
  );
}
