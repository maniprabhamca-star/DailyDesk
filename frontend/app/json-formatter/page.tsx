import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { JsonFormatterTool } from '@/components/tools/json-formatter-tool';

export const metadata: Metadata = {
  title: 'JSON Formatter — Beautify, Validate & Minify JSON | DailyDesk',
  description:
    'Format, validate, and minify JSON instantly in your browser — clear error messages with line and column, sorted keys, syntax highlighting. Free, no signup, and your data never leaves your device.',
  alternates: { canonical: '/json-formatter' },
  openGraph: {
    images: ['/og.png'],
    title: 'JSON Formatter — Beautify, Validate & Minify JSON | DailyDesk',
    description: 'Pretty-print, validate, and minify JSON privately in your browser, with line/column error messages.',
    type: 'website',
  },
};

const steps = [
  'Paste your JSON (or open a .json file).',
  'Hit Format to pretty-print, or Minify for the smallest output.',
  'Fix any error using the line and column pointer, then copy or download.',
];

const faqs = [
  { q: 'Is my JSON uploaded anywhere?', a: 'No — and that matters more than people think: API responses often contain tokens, keys, and customer data. Everything here parses and formats on your own device.' },
  { q: 'What happens when my JSON is invalid?', a: 'You get the exact reason with the line and column where parsing failed — not just a red X. Fix it and format again.' },
  { q: 'Can I control the indentation?', a: 'Yes — 2 spaces, 4 spaces, or tabs. There’s also a Sort keys option that alphabetizes every object recursively, which makes diffs and comparisons much easier.' },
  { q: 'What does Minify do?', a: 'It strips all whitespace to produce the smallest valid JSON — handy for embedding in configs or query strings. Format turns it back into readable form any time.' },
  { q: 'Is there a size limit?', a: 'No hard limit — multi-megabyte files parse fine. Syntax highlighting steps aside on very large outputs to keep everything fast.' },
];

export default function JsonFormatterPage() {
  return (
    <PdfToolPage
      title="JSON formatter"
      description="Beautify, validate, and minify JSON with precise error messages — instantly, in your browser. Free, no signup, and your data stays on your device."
      steps={steps}
      faqs={faqs}
    >
      <JsonFormatterTool />
    </PdfToolPage>
  );
}
