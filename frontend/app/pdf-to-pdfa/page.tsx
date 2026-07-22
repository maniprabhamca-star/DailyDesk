import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { ServerConvertTool } from '@/components/tools/server-convert-tool';

export const metadata: Metadata = {
  title: 'PDF to PDF/A — Archival Format Converter | DiemDesk',
  description: 'Convert a PDF to PDF/A (ISO 19005) for long-term archiving and legal filing. 3 free a day, unlimited on Pro. Converted then deleted, never stored.',
  alternates: { canonical: '/pdf-to-pdfa' },
  openGraph: { images: ['/og.png'], title: 'PDF to PDF/A — archival format', description: 'Make a PDF that opens identically for decades. Converted on our server, then deleted immediately.', type: 'website' },
};

const steps = [
  'Drop your PDF — it’s sent over an encrypted connection to our converter.',
  'It’s rewritten to the PDF/A-2b archival standard: fonts embedded, colors made self-contained.',
  'Download the PDF/A file for your archive or filing. Your original is deleted the moment it downloads.',
];

const faqs = [
  { q: 'What is PDF/A and when do I need it?', a: 'PDF/A is an ISO standard (19005) for long-term preservation — everything needed to render the file exactly is embedded inside it, so it opens identically decades from now. Courts, governments and archives often require it for filings and records.' },
  { q: 'Which PDF/A version does this produce?', a: 'PDF/A-2b, produced with Ghostscript — the widely-accepted archival conformance level. It embeds fonts and normalizes color so the file is self-contained.' },
  { q: 'Why does this one upload?', a: 'Proper PDF/A conversion needs a document engine that can’t run in a browser. Your file is sent over an encrypted connection, converted, and deleted immediately — never stored, never read.' },
  { q: 'Is it free?', a: 'Three conversions a day are free, no signup; Pro removes the daily cap and the size limit. Our in-browser tools stay free and unlimited.' },
];

export default function PdfToPdfaPage() {
  return (
    <PdfToolPage
      title="PDF to PDF/A"
      description="Convert a PDF to PDF/A — the ISO archival standard for filings and long-term records that must open identically for decades. Runs on our server; your file is converted and deleted immediately, never stored."
      steps={steps}
      faqs={faqs}
    >
      <ServerConvertTool
        endpoint="/api/convert/pdf-to-pdfa"
        sessionKey="pdf-to-pdfa"
        outExt="pdf"
        ctaLabel="Convert to PDF/A"
        hint="Get an archival PDF/A-2b file — up to 50 MB, 3 free a day"
        excludeHref="/pdf-to-pdfa"
        disclosure="Unlike our in-browser tools, converting to the PDF/A archival format needs our server: your PDF is sent over an encrypted connection, converted, and deleted immediately — never stored, never read."
      />
    </PdfToolPage>
  );
}
