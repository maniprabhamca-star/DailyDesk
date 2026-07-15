import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { PdfViewerTool } from '@/components/tools/pdf-viewer-tool';

export const metadata: Metadata = {
  title: 'PDF Viewer — Open & Read PDFs Free, Private | DiemDesk',
  description: 'Open and read any PDF in your browser — pages, zoom, search and thumbnails — then send it straight to any tool with no re-upload. Never uploaded.',
  alternates: { canonical: '/pdf-viewer' },
  openGraph: { images: ['/og.png'], title: 'PDF Viewer — private, in your browser', description: 'Read any PDF on your device, then hand it to any tool with no re-upload.', type: 'website' },
};

const steps = [
  'Drop a PDF in (or click to choose) — it opens on your device, nothing uploaded.',
  'Read it: flip pages, zoom, search the text, jump around with thumbnails.',
  'Hit “Do more” to send the same file straight to a tool — compress, sign, fill, split — with no re-upload.',
];

const faqs = [
  { q: 'Is my PDF uploaded to view it?', a: 'No. The viewer renders your PDF entirely in your browser with the same engine our other tools use — the file never leaves your device.' },
  { q: 'What does “Do more” do?', a: 'It hands the file you have open straight to another tool (Compress, Sign, Fill, Split and more) without making you upload it again — the whole workflow stays on your device.' },
  { q: 'Can I search inside the PDF?', a: 'Yes — type in the search box and it lists every page that contains your text; click a page to jump there. (Scanned image-only PDFs have no text layer; use OCR first.)' },
  { q: 'Does it work on big files?', a: 'Yes — pages render on demand and thumbnails load lazily, so even large documents open quickly. Very large files are bounded by your device’s memory, not a server limit.' },
  { q: 'Can I make DiemDesk open PDFs from my email like other apps?', a: 'On the way — once you install DiemDesk (it’s a PWA), it can register as an “Open with” option (Android share sheet + desktop Chrome/Edge). A native app will complete this on iPhone.' },
];

export default function PdfViewerPage() {
  return (
    <PdfToolPage
      title="PDF viewer"
      description="Open and read any PDF privately in your browser — pages, zoom, search, thumbnails — then send the same file straight to any tool with no re-upload."
      steps={steps}
      faqs={faqs}
      wide
    >
      <PdfViewerTool />
    </PdfToolPage>
  );
}
