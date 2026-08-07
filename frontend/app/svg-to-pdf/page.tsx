import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SvgConvertTool } from '@/components/tools/svg-convert-tool';

export const metadata: Metadata = {
  title: 'SVG to PDF — Convert in Your Browser | DiemDesk',
  description: 'Turn an SVG into a PDF sized to the drawing, not stretched onto A4. Runs on your device, nothing uploaded. Free, no signup.',
  alternates: { canonical: '/svg-to-pdf' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'SVG to PDF — private, in your browser',
    description: 'Convert an SVG into a PDF page sized to the drawing itself, on your device — nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop an SVG — your browser draws it, and the file is never uploaded.',
  'The PDF page takes the drawing’s own dimensions, so a 400 × 300 graphic becomes a 400 × 300pt page.',
  'Download it. Free, unlimited, no signup.',
];

const faqs = [
  { q: 'What page size do I get?', a: 'The drawing’s own. A logo doesn’t want to be marooned in the middle of an A4 sheet with white all around it, so the page is made to match the artwork exactly — which is what you want for placing it in another document, or sending it to a printer.' },
  { q: 'Is the result vector or a picture?', a: 'A picture. The SVG is drawn at high resolution and embedded, rather than translated shape-by-shape into PDF drawing commands. That means it prints crisply at the intended size but won’t scale infinitely the way the original SVG does — keep the .svg as your master.' },
  { q: 'What about text in the SVG?', a: 'It’s rendered as it looks in your browser, using the fonts your machine has. It becomes part of the image, so it won’t be selectable or searchable in the PDF. Convert text to outlines first if exact letterforms matter.' },
  { q: 'Is my file uploaded?', a: 'No — the drawing and the PDF are both made in this browser tab. Scripts and event handlers are stripped from the SVG first, since an SVG is executable XML and you often can’t see what’s inside one.' },
  { q: 'Can I get a PNG instead?', a: 'Yes — switch the output here, or start at /svg-to-png, where you can set an exact pixel width.' },
  { q: 'Is it free?', a: 'Yes. It runs on your computer, so it costs us nothing to offer — no cap, no watermark, no signup.' },
];

export default function SvgToPdfPage() {
  return (
    <PdfToolPage
      title="SVG to PDF"
      description="Turn an SVG into a PDF page sized to the drawing itself, rather than stretched onto A4. Your browser does the rendering, so the file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SvgConvertTool defaultFormat="pdf" />
    </PdfToolPage>
  );
}
