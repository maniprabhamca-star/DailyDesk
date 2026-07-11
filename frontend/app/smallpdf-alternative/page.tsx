import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: 'Free Smallpdf Alternative — Private, No Daily Limits | DiemDesk',
  description:
    'Looking for a Smallpdf alternative? DiemDesk runs PDF tools in your browser — no uploads, no 2-task daily limit, no watermarks. Free during launch. Compare honestly.',
  alternates: { canonical: '/smallpdf-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: 'The private Smallpdf alternative — DiemDesk',
    description: 'PDF tools that run in your browser: no uploads, no daily limits, no watermarks.',
    type: 'website',
  },
};

const data: AltData = {
  competitor: 'Smallpdf',
  competitorUrl: 'https://smallpdf.com/pricing',
  tagline: 'Same PDF jobs — without the 2-a-day limit or the upload.',
  intro:
    'Smallpdf caps its free plan at two file tasks a day and processes everything on its servers. DiemDesk does the same everyday jobs — merge, split, compress, sign and more — right inside your browser, with no daily limit and nothing uploaded.',
  reasons: [
    { title: 'Nothing gets uploaded', body: 'DiemDesk’s in-browser tools open and rebuild your file on your device. Smallpdf uploads it to their cloud.' },
    { title: 'No 2-tasks-a-day wall', body: 'Use every in-browser tool as often as you like — no daily limit, no watermark. (Office conversions: 3 free a day.)' },
    { title: 'More than PDF', body: 'Image, QR, password and video tools live alongside the PDF suite — one private toolkit, not a single-purpose site.' },
  ],
  rows: [
    { label: 'Free plan', us: 'Every in-browser tool, no daily cap', them: '2 tasks / day' },
    { label: 'Files stay on your device', us: true, them: false },
    { label: 'Use without an account', us: true, them: 'For most' },
    { label: 'No watermarks on free', us: true, them: 'Some limits' },
    { label: 'Combine unlimited files free', us: true, them: 'Capped / paid' },
    { label: 'Paid plan', us: 'Free now · Pro ~$5.98/mo planned', them: '~$10–15/mo' },
    { label: 'Beyond PDF (image, QR, video)', us: true, them: 'PDF-focused' },
  ],
  faqs: [
    { q: 'Is DiemDesk really free like Smallpdf’s free plan?', a: 'The in-browser tools are free with no daily limit — where Smallpdf’s free plan stops at two tasks a day on everything. Our few server tools (Office conversions) give you 3 free a day; a Pro plan makes those unlimited and adds batch and bigger files. The in-browser tools cost nothing to run, so they stay free.' },
    { q: 'Does DiemDesk upload my files like Smallpdf?', a: 'No. The in-browser tools process your file locally, so it never leaves your browser. A few tools genuinely need a server (Office conversions and — later — OCR); for those we’re upfront and delete your file right after.' },
    { q: 'Does DiemDesk have the same tools as Smallpdf?', a: 'It covers the core PDF jobs — merge, split, compress, convert, rotate, sign, protect, unlock, watermark and more — plus image, QR, password and video tools. Annotate, Redact and OCR are rolling out and marked coming soon.' },
  ],
};

export default function SmallpdfAlternativePage() {
  return <AlternativePage data={data} />;
}
