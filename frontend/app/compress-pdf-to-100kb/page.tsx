import type { Metadata } from 'next';
import { KeywordLanding } from '@/components/app/keyword-landing';

export const metadata: Metadata = {
  title: 'Compress PDF to 100 KB Online Free — Exact Size | DiemDesk',
  description:
    'Compress a PDF to under 100 KB (or 50 KB, 200 KB, 500 KB, 1 MB) for exam, visa and government portal uploads — free, instant, and 100% on your device. Nothing is uploaded.',
  alternates: { canonical: '/compress-pdf-to-100kb' },
  openGraph: { images: ['/og.png'], title: 'Compress PDF to 100 KB — Free | DiemDesk', description: 'Hit an exact KB limit for portal uploads, on your device.', type: 'website' },
};

export default function Page() {
  return (
    <KeywordLanding
      h1="Compress a PDF to 100 KB (or any exact size)"
      lede="Government exam and visa portals demand tiny files — often under 100 KB. Drop your PDF in, pick the target, and get a file that fits under the limit, without uploading anything."
      ctaHref="/compress-to-size"
      ctaLabel="Compress to a target size"
      bullets={[
        'Presets for 50 KB, 100 KB, 200 KB, 500 KB, 1 MB, 2 MB — or a custom KB value',
        'Portal presets: UPSC 40 KB, SSC 100 KB, IBPS/SBI 50 KB, US visa 240 KB and more',
        'Runs entirely in your browser — the PDF never leaves your device',
        'No signup, no watermark, no daily limit',
      ]}
      faqs={[
        { q: 'How do I compress a PDF to under 100 KB?', a: 'Open the tool, drop your PDF in, tap the 100 KB preset (or type a custom value) and press Compress. We reduce the resolution and quality just enough to land under your limit, then you download it.' },
        { q: 'What if it can’t reach 100 KB?', a: 'For a big multi-page scan, 100 KB can be physically impossible. We hand back the smallest version we could make and tell you — try a slightly larger target, or split the PDF first.' },
        { q: 'Is my file uploaded?', a: 'No. Everything runs inside your browser — you can verify in the Network tab.' },
      ]}
    />
  );
}
