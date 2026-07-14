import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: "Sejda Alternative — No Hourly Limit, No Upload | DiemDesk",
  description:
    "A Sejda alternative: DiemDesk runs PDF tools in your browser — no 3-tasks-per-hour limit, no 50 MB / 200-page cap. Free during launch, compared honestly.",
  alternates: { canonical: '/sejda-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: 'The private Sejda alternative — DiemDesk',
    description: 'PDF tools in your browser: no hourly limit, no 50 MB / 200-page cap, nothing uploaded.',
    type: 'website',
  },
};

const data: AltData = {
  competitor: 'Sejda',
  competitorUrl: 'https://www.sejda.com/upgrade',
  tagline: 'Same PDF jobs — without the hourly limit or the 50 MB cap.',
  intro:
    'Sejda’s free web plan resets after 3 tasks an hour and caps files at 50 MB and 200 pages. DiemDesk does the same jobs in your browser with no hourly limit, up to 100 MB, and any page count — and nothing is uploaded.',
  reasons: [
    { title: 'No 3-an-hour limit', body: 'Use any tool as many times as you like — DiemDesk has no hourly task reset to wait out.' },
    { title: 'No 50 MB / 200-page ceiling', body: 'In-browser tools handle files up to 100 MB and PDFs of any length — we’ve rotated a 1 GB, 4,000-page PDF in under a minute.' },
    { title: 'Nothing gets uploaded', body: 'DiemDesk’s web tools run on your device, in any browser, with no install. Sejda’s online tools upload your file to their servers.' },
  ],
  rows: [
    { label: 'Free plan', us: 'Every tool, no hourly cap', them: '3 tasks / hour' },
    { label: 'Free file-size limit', us: 'Up to 100 MB', them: '50 MB' },
    { label: 'Free page limit', us: 'Any length', them: '200 pages' },
    { label: 'Online tools upload your file', us: false, them: true },
    { label: 'Paid plan', us: 'Free now · Pro ~$5.98/mo planned', them: '$7.50/wk · $9.50/mo · $63/yr' },
    { label: 'Beyond PDF (image, QR, video)', us: true, them: 'PDF-focused' },
  ],
  faqs: [
    { q: 'Is DiemDesk better than Sejda’s free plan?', a: 'For everyday use, it lifts the limits people hit most on Sejda: there’s no 3-tasks-per-hour reset, no 50 MB size cap and no 200-page limit on the in-browser tools. Everything is free during launch.' },
    { q: 'Does DiemDesk work locally like Sejda Desktop?', a: 'Sejda offers a paid desktop app that runs offline. DiemDesk’s in-browser tools also run on your device — no upload, nothing to install — and many keep working offline once the page has loaded. A few tools (Office conversions, and later OCR) genuinely need a server and are labelled clearly.' },
    { q: 'Can DiemDesk handle large or long PDFs?', a: 'Yes. In-browser tools handle files up to 100 MB and PDFs of any page count — well past Sejda’s free 50 MB / 200-page cap — because the work happens on your own device instead of an upload server.' },
  ],
};

export default function SejdaAlternativePage() {
  return <AlternativePage data={data} />;
}
