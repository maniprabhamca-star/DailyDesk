import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { JpgToPdfTool } from '@/components/pdf/jpg-to-pdf-tool';

export const metadata: Metadata = {
  title: "JPG to PDF — Convert Images to PDF, Free | DiemDesk",
  description:
    "Convert JPG and PNG images to a PDF free and instantly. Reorder pages, choose page size, no signup, no watermark — images never leave your browser.",
  alternates: { canonical: '/jpg-to-pdf' },
  openGraph: {
    images: ['/og/jpg-to-pdf.png'],
    title: 'JPG to PDF — Convert Images to PDF Free | DiemDesk',
    description: 'Turn JPG and PNG images into a PDF, privately in your browser. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your JPG or PNG images in, or click to choose them.',
  'Drag to reorder, or turn on Screenshot Story mode for captions and page numbers.',
  'Click Convert and your PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — converting images to PDF is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Are my images uploaded to a server?', a: 'No. The conversion happens entirely inside your browser using your device, so your images never leave your computer.' },
  { q: 'Which image formats are supported?', a: 'JPG/JPEG, PNG, HEIC/HEIF (the format iPhones save photos in), WebP, AVIF, BMP and GIF. You can mix them in one PDF. HEIC photos are decoded in your browser, so they work here even on Chrome, Edge and Firefox, which cannot normally open them.' },
  { q: 'How big will the PDF be?', a: 'The default, "Smaller file", resizes each photo to about 4 megapixels and re-compresses it — a 12 megapixel phone photo goes from roughly 1.6MB to under 300KB, with text still sharp enough to read and print. Choose "Original quality" if you want every photo embedded exactly as it is with no re-compression, which is right for archiving or printing at full size but produces a much larger file. "Smallest file" goes down to about 1.5 megapixels for something that only needs to be read on screen.' },
  { q: 'Can I put several images into one PDF?', a: 'Yes. Add as many images as you like and drag them into the order you want — each becomes a page.' },
  { q: 'Can I choose the page size?', a: 'Yes. Fit each page exactly to the image, or use A4 or US Letter with your choice of orientation and margins.' },
  { q: 'Will the image quality drop?', a: 'On the default setting photos are resized to about 4 megapixels and re-compressed, so the PDF is small enough to email — documents and photographs still look right, and text stays legible. If you would rather keep every pixel, choose "Original quality" and your images are embedded byte for byte with nothing re-compressed. The tool describes what each setting does before you convert.' },
];

export default function JpgToPdfPage() {
  return (
    <PdfToolPage
      title="JPG to PDF"
      description="Convert JPG and PNG images into a PDF — free, instantly, and privately. Your images never leave your browser."
      steps={steps}
      faqs={faqs}
    >
      <JpgToPdfTool />
    </PdfToolPage>
  );
}
