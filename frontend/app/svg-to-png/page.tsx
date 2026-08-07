import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SvgConvertTool } from '@/components/tools/svg-convert-tool';

export const metadata: Metadata = {
  title: 'SVG to PNG — Convert at Any Size | DiemDesk',
  description: 'Turn an SVG into a PNG or JPG at any size, with transparency kept. Runs on your device, nothing uploaded. Free, no signup.',
  alternates: { canonical: '/svg-to-png' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'SVG to PNG — private, in your browser',
    description: 'Convert an SVG to PNG or JPG at any size on your device — transparency kept, nothing uploaded.',
    type: 'website',
  },
};

const steps = [
  'Drop an SVG — it’s read and drawn by your own browser, never uploaded.',
  'Pick the width you need, or a 2× / 4× preset. The height follows the drawing’s proportions.',
  'Download the PNG (transparency kept) or a JPG. Free, unlimited, no signup.',
];

const faqs = [
  { q: 'Why does my SVG export blank elsewhere?', a: 'Usually because the file has a viewBox but no width and height. Several browsers then draw it at zero size, and you get an empty PNG. We read the viewBox and set explicit dimensions before rendering, which is why this one comes out.' },
  { q: 'What size should I export?', a: 'Whatever the SVG will be displayed at, then double it for high-density screens — the 2× preset does that in one click. An SVG has no resolution of its own, so you can go as large as you like without it going soft; 8000px is our ceiling to keep the tab healthy.' },
  { q: 'Is transparency kept?', a: 'In PNG, yes — leave the transparent background box ticked. JPG has no transparency at all, so anything see-through is filled white; that’s the format, not the tool.' },
  { q: 'What about fonts and linked images?', a: 'Anything referenced from outside the file won’t load — browsers block external fetches from an SVG rendered this way, and it’s the same protection that stops a hostile file phoning home. Convert text to outlines, or embed the image as a data URI, before exporting.' },
  { q: 'Is my file uploaded?', a: 'No. Your browser draws it and encodes the image locally. We also strip any script or event handler out of the SVG before it goes near the preview — an SVG is executable XML, and most converters just upload it to a server instead.' },
  { q: 'Can I get a PDF instead?', a: 'Yes — switch the output to PDF here, or start at /svg-to-pdf. The page is sized to the drawing rather than stretched onto A4.' },
];

export default function SvgToPngPage() {
  return (
    <PdfToolPage
      title="SVG to PNG"
      description="Turn an SVG into a PNG or JPG at any size, with transparency kept. Your browser does the drawing, so the file is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <SvgConvertTool defaultFormat="png" />
    </PdfToolPage>
  );
}
