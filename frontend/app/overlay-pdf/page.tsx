import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OverlayTool } from '@/components/pdf/overlay-tool';

export const metadata: Metadata = {
  title: 'Overlay PDF — Stamp One PDF Onto Another, Free | DiemDesk',
  // Kept under 155 characters — Google truncates around there, and the QA suite
  // fails the build over it (that check caught this one).
  description:
    'Lay one PDF over another — letterhead behind an invoice, a pre-printed background, a DRAFT stamp. Free, and your files never leave your browser.',
  alternates: { canonical: '/overlay-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Overlay PDF — Stamp One PDF Onto Another | DiemDesk',
    description: 'Put a letterhead, background or stamp page over a PDF, privately in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF you want stamped.',
  'Add the PDF to lay over it — a letterhead, a pre-printed form, a stamp page.',
  'Choose on top or behind, set the opacity, and download. Nothing is uploaded.',
];

const faqs = [
  { q: 'What is a PDF overlay for?', a: 'Putting one PDF on top of another. The common cases are company letterhead behind an invoice or letter, a pre-printed form background under typed content, and a stamp page such as DRAFT, PAID or CONFIDENTIAL applied across a document.' },
  { q: 'How is this different from Watermark?', a: 'Watermark adds text or an image. This takes a whole PDF page as the stamp, so vectors, embedded fonts and transparency come through exactly as they were designed — a real letterhead rather than a picture of one.' },
  { q: 'Can I put the overlay behind the page instead of on top?', a: 'Yes. Behind only shows through where the page is genuinely transparent, though — many PDFs paint a solid white rectangle before anything else, and nothing behind that will be visible. On those, put the overlay on top and lower the opacity instead.' },
  { q: 'Can I apply a different overlay page to each page?', a: 'Yes. Choose "Page for page" and the overlay is matched to the document page by page, cycling if the overlay has fewer pages. The default uses the overlay’s first page on every page.' },
  { q: 'Are my files uploaded?', a: 'No. Both PDFs are opened and combined inside your browser, so neither the document nor the letterhead ever reaches a server. That matters here more than on most tools — letterheaded invoices and stamped contracts are exactly the files people should not be uploading.' },
  { q: 'Will it work on a password-protected PDF?', a: 'Not directly — unlock it first with our Unlock PDF tool, then overlay it.' },
];

export default function OverlayPdfPage() {
  return (
    <PdfToolPage
      title="Overlay PDF"
      description="Lay one PDF over another — letterhead behind an invoice, a pre-printed background, a DRAFT stamp. Both files stay in your browser."
      steps={steps}
      faqs={faqs}
    >
      <OverlayTool />
    </PdfToolPage>
  );
}
