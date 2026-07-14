import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ExtractImagesTool } from '@/components/pdf/extract-images-tool';

export const metadata: Metadata = {
  title: 'Extract Images from PDF — Original Quality, Free | DiemDesk',
  description:
    "Pull every embedded image out of a PDF at original quality, free in your browser. Photos export as JPGs, graphics as lossless PNGs. Nothing uploaded.",
  alternates: { canonical: '/extract-images-from-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Extract Images from PDF — Original Quality, Free | DiemDesk',
    description: 'Get the actual pictures inside a PDF — original JPGs and lossless PNGs, privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Hit Extract — the tool finds every embedded picture, right in your browser.',
  'Preview each image, then download them one by one or all as a ZIP.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — extracting images from a PDF is completely free, with no signup, no watermark, and no per-day limit.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. The extraction happens entirely inside your browser on your device, so your PDF and its images never leave your computer.' },
  { q: 'What does "original quality" mean?', a: 'Photos are stored inside PDFs as complete JPEG files. This tool pulls those exact bytes out unchanged — you get the original image that was placed in the PDF, not a re-compressed copy or a screenshot of the page. Images stored losslessly come out as lossless PNGs.' },
  { q: 'How is this different from PDF to JPG?', a: 'PDF to JPG photographs each whole page and gives you one image per page. Extract images digs out the individual pictures embedded inside the pages — logos, photos, figures — at the resolution they were originally added at, which is often higher than the page render.' },
  { q: 'Is transparency preserved?', a: 'Yes. Logos and graphics with soft transparency are exported as PNGs with their alpha channel intact, shown on a checkerboard in the preview so you can see it.' },
  { q: 'Why did I get "no embedded images found"?', a: 'Some PDFs are pure text and vector drawings with no raster pictures inside. If you want an image of each page instead, use the PDF to JPG tool.' },
  { q: 'Does it work on scanned PDFs?', a: 'Yes — scanned pages (including JPEG 2000, CCITT and JBIG2 fax encodings) are decoded in your browser. Photographic scans export as high-quality JPGs; black-and-white fax pages export as crisp PNGs. For scans, each page usually contains one full-page image.' },
  { q: 'Are tiny icons and spacers included?', a: 'No — decorative fragments smaller than 24 pixels and solid-colour patches are skipped automatically so the real pictures aren’t buried in junk.' },
];

export default function ExtractImagesPage() {
  return (
    <PdfToolPage
      title="Extract images from PDF"
      description="Pull the actual pictures out of a PDF — photos as byte-for-byte original JPGs, graphics as lossless PNGs. Free, instant, and private: nothing leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <ExtractImagesTool />
    </PdfToolPage>
  );
}
