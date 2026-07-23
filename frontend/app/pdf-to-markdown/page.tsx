import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfToMarkdownTool } from '@/components/tools/pdf-to-markdown-tool';

export const metadata: Metadata = {
  title: 'PDF to Markdown — Convert in Your Browser | DiemDesk',
  description: 'Turn a PDF into clean Markdown — headings, lists and tables preserved as GitHub-flavoured Markdown. Runs on your device, never uploaded. Free.',
  alternates: { canonical: '/pdf-to-markdown' },
  openGraph: {
    images: ['/og.png'],
    title: 'PDF to Markdown — private, in your browser',
    description: 'Convert a PDF to clean GitHub-flavoured Markdown on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop a PDF — it’s read on your device with the same engine as our other tools, never uploaded.',
  'We rebuild the structure from the layout: headings, bullet and numbered lists, and tables as GitHub-flavoured Markdown.',
  'Preview it rendered or raw, then Copy the Markdown or download a .md file — all in your browser, free.',
];

const faqs = [
  { q: 'What is Markdown good for?', a: 'Markdown is plain text with light formatting (#, -, tables) that renders cleanly everywhere — notes apps like Obsidian and Notion, static sites, GitHub, and as a tidy, token-efficient way to paste a document into an AI chat. Converting a PDF to Markdown gives you editable, portable text instead of a locked layout.' },
  { q: 'Does it keep tables and headings?', a: 'Yes. Headings are detected from font size and weight, lists from their bullets or numbers, and genuinely tabular pages are rebuilt as GitHub-flavoured Markdown tables. You can toggle heading detection and table output on or off and preview the result before you export.' },
  { q: 'Is my PDF uploaded?', a: 'No. The whole conversion runs in your browser — the file never leaves your device, so it’s safe for private or confidential documents. You can confirm it in your browser’s Network tab: nothing is sent.' },
  { q: 'What about scanned PDFs?', a: 'A scanned PDF is an image with no selectable text, so there’s nothing to convert directly. Run it through our OCR tool first to add a text layer, then convert it to Markdown.' },
  { q: 'Does it extract images?', a: 'Not yet — this version focuses on text structure (headings, lists, tables), which is what most people want for notes and AI prompts. Image extraction is planned for a later update.' },
  { q: 'Is it free?', a: 'Yes — it runs on your device, so it costs us nothing to serve and stays free and unlimited, no signup.' },
];

export default function PdfToMarkdownPage() {
  return (
    <PdfToolPage
      title="PDF to Markdown"
      description="Turn a PDF into clean, editable Markdown — headings, lists and tables preserved as GitHub-flavoured Markdown. It runs entirely in your browser, so your file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <PdfToMarkdownTool />
    </PdfToolPage>
  );
}
