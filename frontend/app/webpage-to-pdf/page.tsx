import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { WebpageToPdfTool } from '@/components/tools/webpage-to-pdf-tool';

export const metadata: Metadata = {
  title: 'Webpage to PDF — Save Any URL as a PDF | DiemDesk',
  description:
    'Turn a web address into a PDF exactly as it looks today — useful when a page might change or vanish. 3 free a day, unlimited on Pro.',
  alternates: { canonical: '/webpage-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Webpage to PDF — save a URL exactly as it looks now',
    description: 'Capture any public web page as a PDF. Rendered by a real browser on our server, then deleted.',
    type: 'website',
  },
};

const steps = [
  'Paste the web address you want to keep.',
  'Pick the paper size, and whether to keep the page’s backgrounds.',
  'Download the PDF — a record of the page exactly as it is today.',
];

const faqs = [
  {
    q: 'What is this actually for?',
    a: 'Keeping a page that might not stay the way it is. A price before it changes, terms before they are updated, a listing before it is taken down, a receipt or confirmation screen, a piece of writing you want to read offline. A screenshot catches one screenful; this catches the whole page.',
  },
  {
    q: 'Will it look exactly like my browser?',
    a: 'Very close. It is a real browser — the same engine as Chrome — visiting the page at desktop width and printing it. What differs is anything that depends on being you: pages behind a login, region-specific content, and cookie banners, which often appear because our visit is a first visit.',
  },
  {
    q: 'Can it capture a page I have to log into?',
    a: 'No. Our server visits the address as an anonymous visitor with no access to your accounts, and we would not ask you for a password to do otherwise. For anything behind a login, print to PDF from your own browser.',
  },
  {
    q: 'Why does this one use your server when the other tools do not?',
    a: 'Because a page has to actually be visited to be captured, and your browser is not allowed to fetch another site’s pages and hand them to a script — that restriction is a security feature of the web, not an oversight. So a browser on our server does it, and the page is printed and discarded. We keep no copy.',
  },
  {
    q: 'Can I use it on an internal address?',
    a: 'No, and this is deliberate. Addresses on private networks — anything like localhost, 10.x, 192.168.x or a cloud metadata endpoint — are refused, including public web addresses that quietly point at one. A service that renders any address it is given is a service that can be pointed at its own insides.',
  },
  {
    q: 'Is it free?',
    a: 'Three captures a day are free, no signup; Pro removes the daily cap. Our in-browser tools stay free and unlimited — this one costs us a browser.',
  },
];

export default function WebpageToPdfPage() {
  return (
    <PdfToolPage
      title="Webpage to PDF"
      description="Save any public web page as a PDF, exactly as it looks today — for the pages that might not look like that tomorrow."
      steps={steps}
      faqs={faqs}
    >
      <WebpageToPdfTool />
    </PdfToolPage>
  );
}
