import type { Metadata } from 'next';
import { FlaskConical, ScanLine, Type, Lock, ArrowRight } from 'lucide-react';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { CompressTool } from '@/components/pdf/compress-tool';

export const metadata: Metadata = {
  title: 'Compress PDF — Reduce PDF File Size Free | DiemDesk',
  description:
    "Compress a PDF free in your browser. Shrinks images and scanned pages — even files other tools leave unchanged — while text stays crisp. Nothing uploaded.",
  alternates: { canonical: '/compress-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Compress PDF — Reduce PDF File Size Free | DiemDesk',
    description: 'Make your PDF smaller privately in your browser. Shrinks images, keeps text sharp. Free, no signup, no watermark.',
    type: 'website',
  },
};

const steps = [
  'Drop your PDF in, or click to choose it.',
  'Pick a level — Recommended is the best balance of size and quality.',
  'Click Compress and your smaller PDF downloads instantly.',
];

const faqs = [
  { q: 'Is it really free?', a: 'Yes — compressing PDFs is completely free, with no signup, no watermark, and no daily limits.' },
  { q: 'Is my PDF uploaded to a server?', a: 'No. Compression runs entirely inside your browser using your device, so your file never leaves your computer.' },
  { q: 'Will my text get blurry?', a: 'No. We only shrink and re-encode the images inside the PDF — the text and vector graphics are left completely untouched, so they stay crisp and selectable.' },
  { q: 'How much smaller will it get?', a: 'It depends on the file. Image-heavy PDFs (scans, photos) often shrink by half or more. PDFs that are mostly text are already small, so there may be little to gain — and we never hand back a larger file.' },
  { q: 'Another tool said my PDF can’t be compressed. Can DiemDesk still shrink it?', a: 'Often, yes — especially scanned documents. Many tools give up on scans stored in formats like JPEG 2000 and hand the file back nearly unchanged. DiemDesk detects those pages and rebuilds them at the right resolution: in our test, a 27 MB scanned book that other tools returned about 1% smaller came out 60–75% smaller — still crisp and readable, and the file never left the browser.' },
  { q: 'Which level should I choose?', a: 'Recommended suits most files. Choose Light to keep the most image detail, or Strong for the smallest possible size when quality is less critical.' },
  { q: 'Is anything besides images touched?', a: 'Two lossless extras: embedded fonts are slimmed (unused glyph outlines removed — the text itself is untouched), and hidden metadata (author name, editing history, the XMP packet, embedded thumbnails) is cleaned out. That saves bytes and doubles as a small privacy win — the document looks and renders exactly the same.' },
  { q: 'Is there a file size limit?', a: 'No server limit — nothing is uploaded, so it all runs in your browser. The practical limit is your device’s memory rather than a fixed number: most PDFs are fine, and very large scanned files simply take longer (a desktop with more RAM helps).' },
];

export default function CompressPdfPage() {
  return (
    <PdfToolPage
      title="Compress PDF"
      description="Make your PDF smaller without wrecking it — we shrink the images and leave your text perfectly crisp. Free, instant, and private. Your file never leaves your browser."
      steps={steps}
      faqs={faqs}
    >
      <CompressTool />

      {/* Put to the test — proof-led differentiator band. Every number here is a
          real, documented test result (27.1MB JPEG-2000 scanned book: Smallpdf/
          iLovePDF ≈1%, DiemDesk Recommended 60% / Maximum 75%) — keep it honest
          if levels are ever retuned. */}
      <section aria-label="Put to the test" className="mt-8 rounded-2xl border bg-card p-6 shadow-soft sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <FlaskConical className="size-3.5" /> Put to the test
        </span>
        <div className="mt-4 grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">The scans other tools give up on</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We tested a 27 MB scanned book that big-name tools returned almost unchanged.
              DiemDesk rebuilt it page by page — without the file ever leaving your browser.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: ScanLine, label: 'Scanned-page intelligence' },
                { icon: Type, label: 'Text stays crisp' },
                { icon: Lock, label: 'Zero upload — check the Network tab' },
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                  <c.icon className="size-3.5" /> {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="text-center sm:border-l sm:pl-6">
            <p className="flex items-baseline justify-center gap-2">
              <span className="text-sm text-muted-foreground line-through">27.1 MB</span>
              <ArrowRight className="size-4 self-center text-muted-foreground" />
              <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">6.8 MB</span>
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">75% saved on Maximum</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Other tools managed about 1%</p>
          </div>
        </div>
      </section>
    </PdfToolPage>
  );
}
