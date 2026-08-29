import type { Metadata } from 'next';
import { AlternativePage, type AltData } from '@/components/marketing/alternative-page';

export const metadata: Metadata = {
  title: "Soda PDF Alternative — No Account, No Cloud Storage | DiemDesk",
  description:
    "A Soda PDF alternative: DiemDesk works in your browser with no account and no cloud storage of your documents. Free during launch, compared honestly.",
  alternates: { canonical: '/sodapdf-alternative' },
  openGraph: {
    images: ['/og.png'],
    title: "The private Soda PDF alternative — DiemDesk",
    description: "No account, no cloud drive holding your documents.",
    type: 'website',
  },
};

const data: AltData = {
  competitor: "Soda PDF",
  competitorUrl: "https://www.sodapdf.com/pricing/",
  tagline: "The same everyday jobs, without a cloud drive holding your documents.",
  intro:
    "Soda PDF sells a Windows desktop app and a browser version on the same subscription, and bundles cloud storage with it. That is a reasonable shape for a document product. It also means your files live in an account. DiemDesk does the everyday jobs with no account at all, and keeps the file in your browser.",
  reasons: [
    { title: "No account to open", body: "Most of our tools work the moment the page loads. Nothing to sign up for, nothing to remember later." },
    { title: "No cloud drive", body: "Soda PDF bundles cloud storage with its plans. We deliberately do not store your documents — the file goes back to your download folder and we keep nothing." },
    { title: "Free at the point of use", body: "Every in-browser tool, no daily cap, during launch. Soda PDF is a paid subscription across its plans." },
  ],
  rows: [
    { label: "Account required", us: "No, for most tools", them: "Yes" },
    { label: "Your documents stored in their cloud", us: false, them: "Yes, storage is part of the plan" },
    { label: "Files stay on your device", us: "Yes, in-browser tools", them: "Desktop app yes; browser version uploads" },
    { label: "Free tier", us: "Every in-browser tool, no daily cap", them: "See their pricing page" },
    { label: "Windows desktop app", us: false, them: true },
    { label: "Works on macOS / Linux / phone", us: true, them: "Browser version" },
    { label: "Chain tools into one workflow", us: true, them: false },
  ],
  faqs: [
    { q: "What does Soda PDF cost?", a: "Soda PDF lists Pro, Team and Business plans and puts the actual figures behind a \"see prices\" step on its own site, so we would rather link you there than quote a number that might be out of date. What we can compare is the shape: theirs is a subscription with cloud storage attached, ours is free to use in the browser with nothing stored." },
    { q: "Does Soda PDF work offline?", a: "Its Windows desktop app does. The browser version, like most online PDF services, sends the file to a server. Ours runs the work in the browser itself, which is why it keeps working when the connection drops." },
    { q: "Can I edit PDF text like Soda PDF?", a: "Yes — Edit PDF changes text and images in place, and Annotate and Redact sit next to it. Soda PDF has been at this longer and it shows in the deeper prepress features; for the everyday edit, ours does the job without a subscription." },
  ],
};

export default function SodaPdfAlternativePage() {
  return <AlternativePage data={data} />;
}
