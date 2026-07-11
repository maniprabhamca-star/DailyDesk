import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: 'Free Adobe Acrobat Alternative — No Subscription | DiemDesk',
  description:
    'Looking for an Adobe Acrobat alternative? DiemDesk runs PDF tools free in your browser — no $20/mo subscription, no install, no account. An honest, sourced comparison.',
  alternates: { canonical: '/adobe-acrobat-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: 'The private Adobe Acrobat alternative — DiemDesk',
    description: 'Everyday PDF tools free in your browser — no subscription, no install, no account.',
    type: 'website',
  },
};

const data: AltData = {
  competitor: 'Adobe Acrobat',
  competitorUrl: 'https://www.adobe.com/acrobat/pricing.html',
  tagline: 'The everyday PDF jobs — without the $20-a-month subscription.',
  intro:
    'Adobe Acrobat Pro runs about $19.99–$29.99 a month and wants an account and an install. DiemDesk does the everyday PDF jobs — merge, split, compress, convert, sign — free in your browser, with no subscription and nothing uploaded. (For heavy professional editing, Acrobat still goes deeper — we’re honest about that below.)',
  reasons: [
    { title: 'No subscription', body: 'Free during launch; a later Pro plan is planned at about $5.98/mo — a fraction of Acrobat’s $19.99–$29.99/mo.' },
    { title: 'Nothing to install', body: 'Every tool runs in your browser — no download, no account, no Creative Cloud. Just open a tool and go.' },
    { title: 'Private by design', body: 'In-browser tools process your file on your device, so it’s never uploaded. Acrobat’s online tools upload to Adobe’s cloud.' },
  ],
  rows: [
    { label: 'Price (paid plan)', us: 'Free now · Pro ~$5.98/mo planned', them: '$19.99–29.99/mo' },
    { label: 'Free plan', us: 'Every in-browser tool, no daily cap', them: '7-day trial only' },
    { label: 'Runs in any browser, no install', us: true, them: 'App / account' },
    { label: 'Use without an account', us: true, them: 'Account required' },
    { label: 'In-browser tools upload your file', us: false, them: true },
    { label: 'Beyond PDF (image, QR, video)', us: true, them: 'PDF / Acrobat' },
  ],
  faqs: [
    { q: 'Is DiemDesk a free replacement for Adobe Acrobat?', a: 'For the everyday jobs — merge, split, compress, convert, sign, protect, unlock and more — yes, free and in your browser. Acrobat still goes deeper on heavy professional editing; DiemDesk’s full in-place text editing is a planned Pro feature, and Annotate and Redact are rolling out (marked coming soon).' },
    { q: 'Do I need to subscribe or install anything?', a: 'No. There’s no subscription and nothing to install — every tool runs in your browser. It’s free during launch, and a later optional Pro plan is planned at about $5.98/mo, well below Acrobat’s $19.99–$29.99/mo.' },
    { q: 'Does DiemDesk edit and sign PDFs like Acrobat?', a: 'Signing is live and free today. Annotate and basic redaction are coming soon (and will be free); full in-place text editing and search-and-pattern redaction are planned Pro features. For the deepest professional editing, Acrobat remains more capable — we’d rather say so than overpromise.' },
  ],
};

export default function AdobeAcrobatAlternativePage() {
  return <AlternativePage data={data} />;
}
