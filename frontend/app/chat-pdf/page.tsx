import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ChatPdfTool } from '@/components/tools/chat-pdf-tool';

export const metadata: Metadata = {
  title: 'Chat with PDF — Ask Your Document, Private | DiemDesk',
  description: 'Ask any PDF questions and get answers with the exact page — the file never leaves your browser. Only relevant snippets go to the AI. Private by design.',
  alternates: { canonical: '/chat-pdf' },
  openGraph: { images: ['/og.png'], title: 'Chat with PDF — private, cited answers', description: 'Ask your PDF and get answers with the page they came from. The file never leaves your device.', type: 'website' },
};

const steps = [
  'Drop a PDF in — it opens on your device and the text is read in your browser, never uploaded.',
  'Ask anything: “what’s the total?”, “summarize this”, “any deadlines?”. Tap a starter or type your own.',
  'Get a plain-spoken answer with the page it came from — click the page chip to jump straight there.',
];

const faqs = [
  { q: 'Is my PDF uploaded to the AI?', a: 'No — the file never leaves your browser. We read the text on your device and send only the few snippets relevant to your question to our server, which asks Claude. The document itself is never uploaded, stored, or used for training.' },
  { q: 'How accurate are the answers?', a: 'Every answer is grounded in your document’s text and cites the page it used, so you can verify it. If something isn’t in the document, the assistant says so instead of guessing.' },
  { q: 'Does it work on scanned PDFs?', a: 'Only if they have a text layer. A photo-only scan has no selectable text — run it through OCR first, then come back and chat with it.' },
  { q: 'Why is this a Pro feature when the other tools are free?', a: 'AI is our only per-question running cost. To keep it sustainable it’s part of Pro, on an efficient model with strict daily limits — so it never costs more than it earns. Every in-browser tool stays free and unlimited.' },
  { q: 'What does DiemDesk keep?', a: 'Nothing about your document. We log that a question was asked (for usage counts and your daily limit) but never the question, the answer, or any of the content.' },
];

export default function ChatPdfPage() {
  return (
    <PdfToolPage
      title="Chat with PDF"
      description="Ask your document questions and get answers with the page they came from. The text is read in your browser — only the snippets needed to answer go to the AI, never the file."
      steps={steps}
      faqs={faqs}
      wide
    >
      <ChatPdfTool />
    </PdfToolPage>
  );
}
