import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: "Foxit Alternative — Free, No 14-Day Trial Clock | DiemDesk",
  description:
    "A Foxit PDF Editor alternative: DiemDesk runs in your browser with no licence, no trial countdown and no upload. Free during launch, compared honestly.",
  alternates: { canonical: '/foxit-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: "The free Foxit alternative — DiemDesk",
    description: "No licence, no 14-day clock, nothing uploaded.",
    type: 'website',
  },
};

const data: AltData = {
  competitor: "Foxit",
  competitorUrl: "https://www.foxit.com/pdf-editor/",
  tagline: "For the jobs you do a few times a month, not a $209 licence.",
  intro:
    "Foxit PDF Editor is proper desktop software and priced like it: from $10.99 a month, $159.99 a year for PDF Editor+, or $209.99 once for a perpetual licence, after a 14-day trial. If you edit PDFs professionally every day that can be money well spent. If you merge, compress, sign or convert a handful of files a month, you are buying a workshop to hang a picture.",
  reasons: [
    { title: "No licence, no clock", body: "Foxit gives you 14 days and then asks for a licence. Our in-browser tools have no trial period and no per-seat cost." },
    { title: "Nothing to install", body: "Foxit is software you install and update. This opens in the tab you already have, on whatever machine you are sitting at." },
    { title: "The file stays put", body: "Foxit is strong here too — desktop software keeps files local. Our point is that you get the same thing in a browser, without an install or a purchase." },
  ],
  rows: [
    { label: "Cost to start", us: "Free", them: "14-day trial, then paid" },
    { label: "Cheapest ongoing price", us: "Free now · Pro ~$5.98/mo planned", them: "From $10.99/mo" },
    { label: "One-off purchase option", us: false, them: "$209.99 perpetual" },
    { label: "Install required", us: false, them: true },
    { label: "Files stay on your device", us: true, them: true },
    { label: "Works on any OS from a browser", us: true, them: "Desktop, web and mobile apps" },
    { label: "Deep PDF editing (prepress, forms, mature redaction)", us: "Growing — Edit, Annotate, Redact", them: "Mature" },
  ],
  faqs: [
    { q: "Is DiemDesk a full replacement for Foxit PDF Editor?", a: "Honestly, not for everyone. Foxit is a mature desktop editor with years of work in it, and if your job is production PDF work you will want that depth. What we replace is the reason most people buy a licence: the occasional merge, compress, convert, sign or redact that does not justify $159 a year." },
    { q: "How much does Foxit cost?", a: "Foxit lists PDF Editor from $10.99 a month, PDF Editor+ at $159.99 per user per year, and a perpetual licence at $209.99, with a 14-day trial that does not ask for a card. Prices are theirs and can change — check their page before deciding." },
    { q: "Do my files get uploaded?", a: "Not by our in-browser tools, which open and rebuild the file on your device. A few tools genuinely need a server — Office conversions, and OCR later — and those are labelled as such, with the file deleted straight after." },
  ],
};

export default function FoxitAlternativePage() {
  return <AlternativePage data={data} />;
}
