import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { OutlineTool } from '@/components/pdf/outline-tool';

export const metadata: Metadata = {
  title: 'Add Bookmarks to a PDF — Edit the Outline | DiemDesk',
  description:
    'Add, rename and nest PDF bookmarks — or build the whole outline from the document’s own headings in one click. Free, in your browser.',
  alternates: { canonical: '/add-bookmarks-to-pdf' },
  openGraph: {
    images: ['/og.png'],
    title: 'Add Bookmarks to a PDF — build the outline in one click',
    description: 'Edit a PDF’s table of contents, or generate it from the document’s headings. Private, in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF — any bookmarks it already has are loaded for editing.',
  'Build the outline from the document’s headings, or add entries yourself.',
  'Rename, renumber, reorder and nest, then save. The panel opens on its own.',
];

const faqs = [
  {
    q: 'What are PDF bookmarks?',
    a: 'The clickable table of contents down the side of a PDF reader — the panel that lets someone jump straight to a section instead of scrolling through eighty pages. They are stored inside the file, so they travel with it. They are not the same as your browser’s bookmarks.',
  },
  {
    q: 'Can it build the outline for me?',
    a: 'Yes, and this is the part worth trying first. We read the document’s own headings — worked out from the size and weight of the type, the same way our PDF-to-Markdown tool does — and turn them into a nested outline in one click. On a long report that is the difference between a minute and an afternoon. Check it before saving: it is a starting point, and a document with unusual typesetting can confuse it.',
  },
  {
    q: 'Can I nest them?',
    a: 'Yes. Any bookmark can become a sub-bookmark of the one above it, as deep as you like, and the arrows move entries around. Deleting a parent keeps its children rather than taking the whole branch with it.',
  },
  {
    q: 'Will they work in every reader?',
    a: 'They should. Bookmarks are a standard part of the PDF format and we write the structure the specification describes, including telling the reader to open the panel. Each one jumps to the top of its page and leaves the reader’s zoom alone, rather than rescaling the view.',
  },
  {
    q: 'Can I remove the bookmarks a file came with?',
    a: 'Yes — delete them all and save. The outline is removed, and so is the instruction that tells readers to open a panel for it, so nobody gets an empty sidebar.',
  },
  {
    q: 'Does it change the pages?',
    a: 'No. Bookmarks live alongside the pages, not on them. Nothing is re-rendered, re-compressed or moved, and the page count stays exactly as it was.',
  },
  {
    q: 'Is my file uploaded?',
    a: 'No. The PDF is read and rewritten inside your browser and never reaches a server. There is no page limit and no daily cap, because it costs us nothing to run.',
  },
];

export default function AddBookmarksToPdfPage() {
  return (
    <PdfToolPage
      title="Add bookmarks to a PDF"
      description="Give a long document a proper table of contents — nested, clickable, and built from its own headings if you want it done in one click."
      steps={steps}
      faqs={faqs}
    >
      <OutlineTool />
    </PdfToolPage>
  );
}
