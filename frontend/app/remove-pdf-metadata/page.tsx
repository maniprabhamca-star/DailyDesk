import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { MetadataTool } from '@/components/pdf/metadata-tool';

export const metadata: Metadata = {
  title: "Remove PDF Metadata — Clean Hidden Info, Free | DiemDesk",
  description:
    "See and remove the hidden metadata in a PDF — author, editing software, timestamps, XMP history — free in your browser. Nothing uploaded, pages untouched.",
  alternates: { canonical: '/remove-pdf-metadata' },
  openGraph: {
    images: ['/og/remove-pdf-metadata.png'],
    title: 'Remove PDF Metadata — Clean Author & Hidden Info Free | DiemDesk',
    description: 'Wipe author names, software traces and timestamps from a PDF, privately in your browser. Free, no signup.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in — it is scanned instantly, right in your browser.',
  'Review the hidden info it carries: author, software, dates, XMP history.',
  'Click Remove all metadata and download the cleaned PDF.',
];

const faqs = [
  { q: 'What metadata does a PDF contain?', a: 'Most PDFs quietly carry the author’s name, the software that created them, creation and modification timestamps, and an XMP data packet with editing history. Files exported from Word, for example, usually embed the Windows account name of whoever wrote them.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Both the scan and the cleaning run entirely inside your browser on your device — the file never leaves your computer, which matters when the whole point is privacy.' },
  { q: 'What exactly gets removed?', a: 'The document Info dictionary (Title, Author, Subject, Keywords, Creator, Producer, dates and any custom fields), the XMP metadata stream, embedded page thumbnails, and private application data (/PieceInfo). The visible pages are not modified at all.' },
  { q: 'Does this redact the content of my pages?', a: 'No — this cleans hidden document metadata only. Anything visible on the pages (names in the text, headers, scanned signatures) stays exactly as it is. A redaction tool is on our roadmap for that.' },
  { q: 'Will the file still look the same?', a: 'Yes, pixel for pixel. Metadata lives outside the page content, so removing it never changes how the document renders or prints.' },
  { q: 'Why is the cleaned file smaller?', a: 'The XMP packet and thumbnails take real bytes — a few KB in a typical office PDF. Removing them plus repacking usually makes the file slightly smaller, never larger.' },
  { q: 'Is it really free?', a: 'Yes — scanning and cleaning PDF metadata is completely free, with no signup and no watermark.' },
];

export default function RemovePdfMetadataPage() {
  return (
    <PdfToolPage
      title="Remove PDF metadata"
      description="See what your PDF quietly says about you — author, software, timestamps, editing history — and wipe it in one click. Free, instant, and private: nothing leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <MetadataTool />
    </PdfToolPage>
  );
}
