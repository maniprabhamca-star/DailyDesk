import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: "pdf.net Alternative — 114 Tools, On Device | DiemDesk",
  description:
    "A pdf.net alternative: DiemDesk has 114 tools to their ~35, and most run in your browser instead of uploading. Free during launch, compared honestly.",
  alternates: { canonical: '/pdfnet-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: "The private pdf.net alternative — DiemDesk",
    description: "114 tools, most of them running on your device rather than their server.",
    type: 'website',
  },
};

const data: AltData = {
  competitor: "pdf.net",
  competitorUrl: "https://pdf.net/",
  tagline: "Three times the tools, and most of them never send your file anywhere.",
  intro:
    "pdf.net is a polished, well-built PDF site with roughly 35 tools, and its real strength is a large library of US tax and immigration forms sitting behind them. Every one of its tools uploads your file to its servers. DiemDesk has 114 tools and most of them run inside your browser, which is a different answer to the same jobs.",
  reasons: [
    { title: "114 tools against about 35", body: "OCR, redaction, PDF repair, EPUB both ways, video and audio, developer and data tools — whole categories they do not cover." },
    { title: "Most of it never uploads", body: "Their tools are server-side, and their own FAQ says files go to their servers and are deleted after. Ours mostly do not go at all." },
    { title: "Tools that chain", body: "Saved Workflows runs several tools on one drop — compress, then watermark, then flatten — without a round trip per step." },
  ],
  rows: [
    { label: "Tools", us: "114", them: "~35" },
    { label: "Files stay on your device", us: "Most tools", them: false },
    { label: "Works offline", us: true, them: false },
    { label: "US tax and immigration forms library", us: false, them: "225 pages" },
    { label: "Languages", us: "English", them: "7" },
    { label: "OCR, redaction, PDF repair", us: true, them: false },
    { label: "Chain tools into one workflow", us: true, them: false },
  ],
  faqs: [
    { q: "What does pdf.net do better?", a: "Two things, clearly. It has a large library of filled-in US tax and immigration form pages — W-9, I-9 and hundreds more — with the form attached to each, which is genuinely useful if that is what you came for. And it is available in seven languages against our one. We would rather say that than pretend otherwise." },
    { q: "Why does on-device matter if they delete the file anyway?", a: "Because deletion is a promise and on-device is a property. With our in-browser tools there is no upload to trust, no retention window, and nothing on a server to be breached, subpoenaed or misconfigured. You can watch it in your browser network tab — no request carries the file." },
    { q: "Is DiemDesk free like pdf.net?", a: "Every in-browser tool is free with no daily cap during launch. A few tools genuinely need a server — Office conversions now, OCR later — and those are labelled and capped on the free tier." },
  ],
};

export default function PdfNetAlternativePage() {
  return <AlternativePage data={data} />;
}
