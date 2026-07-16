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
  { q: 'Which image formats are supported?', a: 'JPG/JPEG and PNG images. You can mix both in a single PDF.' },
  { q: 'Can I put several images into one PDF?', a: 'Yes. Add as many images as you like and drag them into the order you want — each becomes a page.' },
  { q: 'Can I choose the page size?', a: 'Yes. Fit each page exactly to the image, or use A4 or US Letter with your choice of orientation and margins.' },
  { q: 'Will the image quality drop?', a: 'No. Your images are embedded at their original quality — nothing is re-compressed.' },
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
