import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SummarizePdfTool } from '@/components/tools/summarize-pdf-tool';

export const metadata: Metadata = {
  title: 'Summarize PDF with AI — Page-Cited, Private | DiemDesk',
  description: 'AI PDF summarizer with page citations you can check. Pick length, format, audience and language — the file never leaves your browser. Export PDF or Word.',
  alternates: { canonical: '/summarize-pdf' },
  openGraph: { images: ['/og.png'], title: 'Summarize PDF — cited, checkable, private', description: 'Every claim in the summary carries the page it came from. The file never leaves your device.', type: 'website' },
};

const steps = [
  'Drop a PDF in — it opens on your device and the text is read in your browser, never uploaded.',
  'Choose how you want it: length, paragraphs or bullets, who it’s written for, the summary language, even a focus like “financial risks”.',
  'Get a summary where every claim cites its page — click a page chip to verify it, then export as PDF, Word, Markdown or text.',
];

const faqs = [
  { q: 'Is my PDF uploaded?', a: 'No — the file never leaves your browser. We read the text on your device and send only text to our server, which asks Claude for the summary. The document itself is never uploaded, stored, or used for training. Even the PDF/Word export is generated on your device.' },
  { q: 'How is this different from other AI summarizers?', a: 'Two big ways. First, every claim in the summary carries a page citation, so you can check it against the document instead of trusting a black box. Second, you control far more: audience (simple vs technical), the summary’s language, a custom focus, executive-brief and section-by-section modes.' },
  { q: 'Can it summarize in a different language than the document?', a: 'Yes — pick any of 30+ languages and the summary is written in it, whatever language the document is in. Summarize a German contract in English, or an English report in Hindi or Tamil.' },
  { q: 'Does it work on scanned PDFs?', a: 'Only if they have a text layer. A photo-only scan has no selectable text — run it through OCR first, then summarize it.' },
  { q: 'Why is this a Pro feature?', a: 'AI is our only per-use running cost. To keep it sustainable it’s part of Pro, on an efficient model with strict monthly limits. Every in-browser tool stays free and unlimited.' },
];

export default function SummarizePdfPage() {
  return (
    <PdfToolPage
      title="Summarize PDF"
      description="A summary you can actually check: every claim cites the page it came from. Pick the length, format, audience and language — the text is read in your browser and the file never leaves your device."
      steps={steps}
      faqs={faqs}
      wide
    >
      <SummarizePdfTool />
    </PdfToolPage>
  );
}
