import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { FaviconTool } from '@/components/tools/favicon-tool';

export const metadata: Metadata = {
  title: 'Favicon Generator — Every Size, One Image | DiemDesk',
  description: 'Turn a logo into a favicon pack — PNGs, a real multi-size .ico, a web manifest and the HTML. On your device, nothing uploaded. Free.',
  alternates: { canonical: '/favicon-generator' },
  // Gated (coming_soon): keep a thin "coming soon" page out of the index. Remove
  // this line the day the tool un-gates — everything else is already in place.
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Favicon generator — private, in your browser',
    description: 'One logo in, every icon a site needs out — including a real .ico. Made on your device.',
    type: 'website',
  },
};

const steps = [
  'Drop your logo — PNG, JPG, SVG or WebP. It’s drawn in your browser, never uploaded.',
  'Adjust the padding, background or rounding if the mark needs breathing room, and watch every size update.',
  'Download the pack — six PNGs, a real multi-size favicon.ico, a web manifest and the HTML to paste. Free.',
];

const faqs = [
  { q: 'Which sizes do I actually need?', a: 'Six, and each has a real consumer: 16 and 32 for browser tabs, 48 for the Windows taskbar, 180 for the iPhone home screen, and 192 and 512 for Android and its splash screen. The twenty-file sets you sometimes see are mostly obsolete — this generates what browsers ask for today, labelled so you can see why.' },
  { q: 'Do I still need a favicon.ico?', a: 'Yes. Browsers and crawlers still request /favicon.ico directly, whatever your HTML says, so leaving it out means 404s in your logs. The pack includes a genuine multi-size .ico containing the 16, 32 and 48 icons — not a renamed PNG, which is what a lot of generators hand you.' },
  { q: 'My logo looks cramped in the tab.', a: 'A wordmark or a tall logo often does at 16px. Add a little padding so it isn’t touching the edges, and consider a solid background — a mark that reads at 512px frequently doesn’t at 16, which is worth checking on the previews before you ship it.' },
  { q: 'Should I use a square image?', a: 'Ideally, but it isn’t required. Anything else is centred and fitted inside the square without cropping — a logo with its edges cut off is worse than one with space around it.' },
  { q: 'Is my logo uploaded?', a: 'No. Every icon is drawn and zipped in this browser tab. That matters for an unreleased brand — most favicon generators upload the image to a server, and some keep it.' },
  { q: 'Where do the files go?', a: 'In the root of your site, alongside index.html, and paste the HTML snippet into your <head>. There’s a README in the zip saying the same thing.' },
];

export default function FaviconGeneratorPage() {
  return (
    <PdfToolPage
      title="Favicon generator"
      description="Turn one logo into every icon a site needs — the PNG sizes browsers ask for, a real multi-size .ico, a web manifest and the HTML to paste. It runs in your browser, so your logo is never uploaded."
      steps={steps}
      faqs={faqs}
    >
      <FaviconTool />
    </PdfToolPage>
  );
}
