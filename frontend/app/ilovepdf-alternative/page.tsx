import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: 'Free iLovePDF Alternative — No Ads, No Upload | DiemDesk',
  description:
    "An iLovePDF alternative: DiemDesk runs PDF tools in your browser — no ads, no uploads, no batch caps. Free during launch. An honest, sourced comparison.",
  alternates: { canonical: '/ilovepdf-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: 'The private iLovePDF alternative — DiemDesk',
    description: 'PDF tools that run in your browser: no ads, no uploads, no batch caps.',
    type: 'website',
  },
};

const data: AltData = {
  competitor: 'iLovePDF',
  competitorUrl: 'https://www.ilovepdf.com/pricing',
  tagline: 'Same PDF suite — without the ads or the upload.',
  intro:
    'iLovePDF’s free plan shows ads, caps batches (two files on Compress, one on most tools) and processes everything on its servers. DiemDesk does the same jobs in your browser — ad-free, with nothing uploaded.',
  reasons: [
    { title: 'No ads on the free plan', body: 'DiemDesk is ad-free and tracker-free. iLovePDF shows ads to free users and reserves an ad-free experience for Premium.' },
    { title: 'Nothing gets uploaded', body: 'The in-browser tools rebuild your file on your device. iLovePDF uploads it to their servers for regional processing.' },
    { title: 'Combine files without caps', body: 'Merge and images→PDF are unlimited and free. iLovePDF’s free merge stops at 25 files and Compress at two.' },
  ],
  rows: [
    { label: 'Free plan', us: 'Every in-browser tool, no daily cap', them: 'Limited tasks + ads' },
    { label: 'Files stay on your device', us: true, them: false },
    { label: 'Ad-free on free plan', us: true, them: false },
    { label: 'Use without an account', us: true, them: 'For most' },
    { label: 'Combine unlimited files free', us: true, them: 'Up to 25 files' },
    { label: 'Paid plan', us: 'Free now · Pro ~$5.98/mo planned', them: '$5/mo annual · $9 monthly' },
    { label: 'Beyond PDF (image, QR, video)', us: true, them: 'PDF-focused' },
  ],
  faqs: [
    { q: 'Is DiemDesk free without ads, unlike iLovePDF?', a: 'Yes — DiemDesk is free with no ads and no trackers, where iLovePDF shows ads on its free plan. The in-browser tools have no daily limit; the few server-side Office conversions give you 3 free a day, and Pro adds scale features rather than removing ads.' },
    { q: 'Does DiemDesk upload my files like iLovePDF?', a: 'No. The in-browser tools process your file locally, so it never leaves your browser. iLovePDF uploads files for server-side (regional) processing. A few DiemDesk tools genuinely need a server (Office conversions, and later OCR) — those are clearly labelled and your file is deleted right after.' },
    { q: 'Can DiemDesk merge and compress like iLovePDF?', a: 'Yes — and without iLovePDF’s free caps (its free Merge stops at 25 files, Compress at two). DiemDesk’s merge and images→PDF are unlimited and free, and compression handles files up to 100 MB in the browser.' },
  ],
};

export default function IlovepdfAlternativePage() {
  return <AlternativePage data={data} />;
}
