import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { TranslatePdfTool } from '@/components/tools/translate-pdf-tool';

export const metadata: Metadata = {
  title: 'Translate PDF with AI — 30+ Languages, Private | DiemDesk',
  description: 'Translate PDF text into 30+ languages with tone control, a glossary and translator notes. The file never leaves your browser. Export Word or PDF.',
  alternates: { canonical: '/translate-pdf' },
  openGraph: { images: ['/og.png'], title: 'Translate PDF — faithful, side-by-side, private', description: 'Clean translated text beside the original, with notes on ambiguous terms. The file never leaves your device.', type: 'website' },
};

const steps = [
  'Drop a PDF in — it opens on your device and the text is read in your browser, never uploaded.',
  'Pick the target language, the tone (formal or informal), and list any names or terms that must stay untranslated.',
  'Read the translation beside the original, page by page — with translator notes on genuinely ambiguous terms — then export as Word, side-by-side Word, PDF or text.',
];

const faqs = [
  { q: 'Is my PDF uploaded?', a: 'No — the file never leaves your browser. We read the text on your device and send only text to our server, which asks Claude for the translation. Nothing is stored or used for training, and the exports are generated on your device too.' },
  { q: 'Does it keep the original layout?', a: 'No — and we say so up front. You get clean, faithful translated text, page by page, exported as a fresh PDF or Word document. Tools that promise translated files with the exact original layout usually deliver broken formatting; we chose text you can actually use.' },
  { q: 'What are translator notes?', a: 'When a term is genuinely ambiguous — like German “Werktage”, which can mean Mon–Sat or Mon–Fri depending on context — the tool flags it and explains the choice instead of silently picking one. No other PDF translator does this.' },
  { q: 'What languages are supported?', a: 'Over 30, including Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Gujarati, Punjabi and Urdu alongside Spanish, French, German, Chinese, Arabic, Japanese and more.' },
  { q: 'Is there a size limit?', a: 'Up to 30 pages per run — translation processes the whole text in and out, which is the most expensive AI operation we run. Split a bigger document first, then translate the parts.' },
];

export default function TranslatePdfPage() {
  return (
    <PdfToolPage
      title="Translate PDF"
      description="Faithful translation into 30+ languages, shown beside the original — with tone control, a do-not-translate list for names and terms, and notes on anything ambiguous. The file never leaves your device."
      steps={steps}
      faqs={faqs}
      wide
    >
      <TranslatePdfTool />
    </PdfToolPage>
  );
}
