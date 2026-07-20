import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfQuestionGeneratorTool } from '@/components/tools/pdf-question-generator-tool';

export const metadata: Metadata = {
  title: 'Question Generator from PDF — Quiz, Flashcards | DiemDesk',
  description: 'Turn any PDF into quiz questions, flashcards or a printable test — with difficulty, thinking-level control and Anki/Moodle export. Private: the file never leaves your browser.',
  alternates: { canonical: '/pdf-question-generator' },
  openGraph: { images: ['/og.png'], title: 'PDF question generator — quiz, flashcards, exports', description: 'MCQ, true/false, flashcards and more, each citing its page. Export to Anki, Moodle or a printable quiz sheet.', type: 'website' },
};

const steps = [
  'Drop a PDF in — study notes, a textbook chapter, a report. The text is read in your browser, never uploaded.',
  'Choose the question style (MCQ, true/false, fill-in-the-blank, flashcards, open or mixed), how many, the difficulty, and the thinking level.',
  'Review the questions — each cites the page its answer comes from — then export a printable quiz sheet (answers on the last page), Word, Anki/Quizlet flashcards or Moodle GIFT.',
];

const faqs = [
  { q: 'Is my PDF uploaded?', a: 'No — the file never leaves your browser. We read the text on your device and send only text to our server, which asks Claude to write the questions. Nothing is stored or used for training, and every export is generated on your device.' },
  { q: 'What can I export?', a: 'A print-ready PDF quiz sheet with the answer key on the last page, a Word document, Anki/Quizlet-compatible flashcard CSV, Moodle GIFT format for LMS import, and Markdown.' },
  { q: 'What is the thinking-level option?', a: 'It targets questions at a level of Bloom’s taxonomy: recall (facts), understand (concepts), apply (use it on a new case) or analyze (compare and reason). Teachers use it to build assessments beyond memorization — no other PDF toolbox offers it.' },
  { q: 'Are the answers reliable?', a: 'Every question is generated strictly from the document’s text and carries the page its answer comes from, so you can verify it in one click. Explanations say why the answer is right.' },
  { q: 'Does it work on scanned PDFs?', a: 'Only if they have a text layer. Run a photo-only scan through OCR first, then generate questions.' },
];

export default function PdfQuestionGeneratorPage() {
  return (
    <PdfToolPage
      title="Question generator"
      description="Turn any PDF into a quiz, flashcards or a printable test. Six question styles, difficulty and thinking-level control, page-cited answers — and one-click export to Anki, Moodle or paper. The file never leaves your device."
      steps={steps}
      faqs={faqs}
      wide
    >
      <PdfQuestionGeneratorTool />
    </PdfToolPage>
  );
}
