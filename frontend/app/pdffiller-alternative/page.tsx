import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: "pdfFiller Alternative — No 30-Day Trial, No Cloud Account | DiemDesk",
  description:
    "A pdfFiller alternative: DiemDesk fills, signs and edits PDFs in your browser with no account and nothing stored in a cloud. Free during launch, compared honestly.",
  alternates: { canonical: '/pdffiller-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: "The private pdfFiller alternative — DiemDesk",
    description: "Fill and sign PDFs without an account or a cloud document store.",
    type: 'website',
  },
};

const data: AltData = {
  competitor: "pdfFiller",
  competitorUrl: "https://www.pdffiller.com/",
  tagline: "Fill and sign without handing the document to a cloud account.",
  intro:
    "pdfFiller, owned by airSlate, is a cloud document platform: you make an account, your documents live in its storage, and you start on a 30-day free trial. That suits teams routing paperwork through a shared workspace. It is a lot of account for someone who needs to fill in one form and sign it.",
  reasons: [
    { title: "No account, no trial clock", body: "Our in-browser tools open and work. There is no 30-day countdown and no card to remember to cancel." },
    { title: "The document does not move", body: "pdfFiller stores your documents in its cloud by design. Ours are opened and rebuilt in the browser and never uploaded." },
    { title: "Sign and fill for free", body: "Sign PDF, fill forms, annotate and flatten are all in the free set — the exact jobs people reach for pdfFiller to do once." },
  ],
  rows: [
    { label: "Account required", us: "No, for most tools", them: "Yes" },
    { label: "Free to use", us: "Every in-browser tool, no daily cap", them: "30-day free trial, then paid" },
    { label: "Documents stored in their cloud", us: false, them: "Yes, by design" },
    { label: "Files stay on your device", us: true, them: false },
    { label: "Fill and sign a PDF", us: true, them: true },
    { label: "Team routing, audit trails, bulk send", us: false, them: true },
    { label: "Works offline", us: true, them: false },
  ],
  faqs: [
    { q: "Is there a free pdfFiller alternative?", a: "This is one. pdfFiller runs a 30-day free trial and then charges; our in-browser tools — including fill, sign, annotate and flatten — are free with no daily cap and no account for most of them." },
    { q: "What does pdfFiller do that DiemDesk does not?", a: "Workflow. It is built for teams sending documents out for signature and tracking what came back, with audit trails and bulk sending. We do not do that, and are not pretending to. If you need a signature request sent to someone else, pdfFiller is the right shape of product." },
    { q: "Where do my files go?", a: "Nowhere. The in-browser tools do the work on your device, so the filled and signed PDF is saved straight back to your downloads. There is no copy in an account for you to remember to delete later." },
  ],
};

export default function PdfFillerAlternativePage() {
  return <AlternativePage data={data} />;
}
