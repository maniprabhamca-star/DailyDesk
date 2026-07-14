import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { WordCounterTool } from '@/components/tools/word-counter-tool';

export const metadata: Metadata = {
  title: "Word Counter — Words, Characters & Reading Time | DiemDesk",
  description:
    "Count words, characters, sentences and paragraphs live as you type — with reading time, speaking time and keyword density. Nothing leaves your browser.",
  alternates: { canonical: '/word-counter' },
  openGraph: {
    images: ['/og.png'],
    title: 'Word Counter — Count Words, Characters & Reading Time | DiemDesk',
    description: 'Live word and character counts with reading time and keyword density — private, in your browser.',
    type: 'website',
  },
};

const steps = [
  'Type or paste your text — counts update live with every keystroke.',
  'Check words, characters, sentences, reading and speaking time at a glance.',
  'Use the keyword density list and case converters to polish your writing.',
];

const faqs = [
  { q: 'Is my text sent anywhere?', a: 'No — and for essays, work emails, and drafts, that matters. Everything is counted on your own device; nothing is uploaded, stored, or logged.' },
  { q: 'What does it count?', a: 'Words, characters with and without spaces, sentences, paragraphs, lines, and unique words — plus average word length and words per sentence.' },
  { q: 'How is reading time calculated?', a: 'Reading time uses 200 words per minute (average silent reading) and speaking time uses 130 words per minute (a comfortable presentation pace).' },
  { q: 'What is keyword density?', a: 'The words you use most, with counts and percentages (common words like “the” are excluded). Useful for spotting repetition and for checking SEO copy.' },
  { q: 'Can I change letter casing?', a: 'Yes — one click converts your whole text to UPPERCASE, lowercase, Title Case, or Sentence case.' },
  { q: 'Does it work for essays with word limits?', a: 'Yes — paste your draft and watch the live count while you edit. The count matches what Word and Google Docs report for the same text.' },
];

export default function WordCounterPage() {
  return (
    <PdfToolPage
      title="Word counter"
      description="Count words, characters, sentences, and reading time live as you type — with keyword density and case converters. Free and private: your text never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <WordCounterTool />
    </PdfToolPage>
  );
}
