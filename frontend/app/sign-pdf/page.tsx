import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { SignTool } from '@/components/pdf/sign-tool';

export const metadata: Metadata = {
  title: 'Sign PDF — Draw, Type or Upload a Signature Free | DiemDesk',
  description:
    "Sign a PDF free in your browser: draw your signature, type it in a script style or upload an image, then drag it into place. Nothing leaves your device.",
  alternates: { canonical: '/sign-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Sign PDF — Draw, Type or Upload a Signature Free | DiemDesk',
    description: 'Draw, type, or upload a signature and place it on any page — privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in and pick the page that needs signing.',
  'Draw your signature, type your name in a script style, or upload an image of it.',
  'Drag the signature exactly into place, set its size, and download the signed PDF.',
];

const faqs = [
  { q: 'Is my document uploaded to a server?', a: 'No — and for contracts, offer letters, and agreements that matters more than anywhere else. The document and your signature are processed entirely on your device; neither is transmitted, stored, or seen by anyone.' },
  { q: 'How do I create the signature?', a: 'Three ways: draw it with your mouse, finger, or stylus; type your name and pick a script, italic, or plain style; or upload an existing image — a PNG with a transparent background looks best, but a photo of your signature on white paper works too.' },
  { q: 'Can I place it exactly where the signature line is?', a: 'Yes — the signature appears as a draggable box on a live preview of the actual page. Drag it onto the signature line, adjust the size slider, and what you see is exactly what lands in the file.' },
  { q: 'Can I sign a specific page?', a: 'Yes — a thumbnail strip lets you jump to any page. Sign one page, download, and run it again if more pages need signatures.' },
  { q: 'Is this a legally binding e-signature?', a: 'The tool draws your signature into the PDF — the same as printing, signing, and scanning. Many everyday agreements accept that; for regulated use cases requiring certificate-based digital signatures or audit trails (like notarized documents), use a dedicated e-signature service.' },
  { q: 'Does it change the rest of the document?', a: 'No — the pages are untouched except for the signature image placed where you dropped it. Text stays selectable and quality is preserved.' },
];

export default function SignPdfPage() {
  return (
    <PdfToolPage
      title="Sign PDF"
      description="Draw, type, or upload your signature and drag it exactly into place on a live page preview — free, instant, and private. Contracts never leave your browser."
      steps={steps}
      faqs={faqs}
    >
      <SignTool />
    </PdfToolPage>
  );
}
