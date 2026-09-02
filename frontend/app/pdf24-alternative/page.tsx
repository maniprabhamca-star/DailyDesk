import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: "PDF24 Alternative — No Upload, No Install | DiemDesk",
  description:
    "A PDF24 alternative: DiemDesk runs in your browser, so files stay on your device — nothing to install. No ads, no uploads, free during launch.",
  alternates: { canonical: '/pdf24-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: "The private PDF24 alternative — DiemDesk",
    description: "Files stay on your device in the browser — no Windows install, no ads.",
    type: 'website',
  },
};

const data: AltData = {
  competitor: "PDF24",
  competitorUrl: "https://tools.pdf24.org/en/",
  tagline: "The privacy PDF24 reserves for its Windows app — in your browser.",
  intro:
    "PDF24 is genuinely free and genuinely broad, and it is honest about the trade: its online tools upload your file. Its own site says so, and points you at PDF24 Creator, a Windows download, if you want files to stay on your machine. DiemDesk gives you that on any operating system, in the browser, with nothing to install.",
  reasons: [
    { title: "On-device without a download", body: "PDF24 tells you to install PDF24 Creator for Windows if you want files to stay on your PC. Our in-browser tools already do that — on macOS, Linux, Android and iOS too." },
    { title: "No ads on your document", body: "PDF24 funds unlimited free use with advertising on the tool pages. We do not run ads, and we never will on a page where you are handling a private file." },
    { title: "More than PDF", body: "Image, video, QR, developer and data tools sit alongside the PDF suite, and Saved Workflows chains them into one drop." },
  ],
  rows: [
    { label: "Files stay on your device", us: "Yes, in the browser", them: "Only in the Windows app" },
    { label: "Works without installing anything", us: true, them: "Online tools only (which upload)" },
    { label: "Offline on macOS / Linux / phone", us: true, them: false },
    { label: "Ads on tool pages", us: false, them: true },
    { label: "Free use", us: "Every in-browser tool, no daily cap", them: "Free, ad-supported" },
    { label: "Tool count", us: "114", them: "~100" },
    { label: "Chain tools into one workflow", us: true, them: false },
  ],
  faqs: [
    { q: "Is PDF24 safe?", a: "PDF24 is upfront about how it works, which is more than most: it encrypts transfers and says files are removed from its servers after a short time. But the file does go to their servers first. If that is the part you would rather avoid, our in-browser tools never send it anywhere — there is nothing to delete afterwards because nothing arrived." },
    { q: "Why not just use PDF24 Creator?", a: "It is a good answer if you are on Windows and happy to install software. It is not an answer on a Mac, a Chromebook, a Linux desktop or a phone, and it is not an answer on a work machine where you cannot install anything. That is the gap this fills." },
    { q: "Does DiemDesk have as many tools as PDF24?", a: "Yes — 114 against their roughly 100, and the overlap is high on the everyday PDF jobs. Where we differ is what sits around them: on-device processing by default, no ads, and Saved Workflows for chaining several tools into a single drop." },
  ],
};

export default function Pdf24AlternativePage() {
  return <AlternativePage data={data} />;
}
