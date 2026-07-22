import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { LinkInBioTool } from '@/components/tools/link-in-bio-tool';

export const metadata: Metadata = {
  title: 'Link in Bio — One Page for All Your Links | DiemDesk',
  description: 'Build a clean link-in-bio page at your own diemdesk.com/u/handle — links, avatar, themes. A Pro feature, with no ads on your page.',
  alternates: { canonical: '/link-in-bio' },
  openGraph: { images: ['/og.png'], title: 'Link in Bio — one page for all your links', description: 'A clean, ad-free link page at diemdesk.com/u/your-handle.', type: 'website' },
};

const steps = [
  'Claim your handle — your page lives at diemdesk.com/u/your-handle.',
  'Add your name, a photo, a short bio, and your links; pick a theme. The preview updates as you go.',
  'Save and share the one link — visitors get a fast, clean page with no ads.',
];

const faqs = [
  { q: 'What’s at the address?', a: 'A single tidy page with your photo, bio and links — the “one link for everything” you put in a social profile. It lives at diemdesk.com/u/your-handle and loads fast.' },
  { q: 'Are there ads on my page?', a: 'No. Your page carries only your content and a small “Made with DiemDesk” credit — no ads, no trackers following your visitors.' },
  { q: 'Why is this a Pro feature?', a: 'Unlike our in-browser tools, a link page is hosted and served by us around the clock — that’s a real running cost, so it’s part of Pro.' },
  { q: 'Can I change my handle or hide the page later?', a: 'Yes — change the handle any time (if it’s free), and toggle the page between Live and Hidden whenever you like.' },
];

export default function LinkInBioPage() {
  return (
    <PdfToolPage
      title="Link in Bio"
      description="One clean, ad-free page for all your links — at your own diemdesk.com/u/handle. Build it here, share the single link everywhere."
      steps={steps}
      faqs={faqs}
      wide
    >
      <LinkInBioTool />
    </PdfToolPage>
  );
}
