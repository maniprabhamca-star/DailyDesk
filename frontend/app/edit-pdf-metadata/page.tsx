import type { Metadata } from 'next';
import { PdfToolPage } from '@/components/pdf/tool-page';
import { DocInfoTool } from '@/components/pdf/docinfo-tool';

export const metadata: Metadata = {
  title: 'Edit PDF Metadata — Change Title, Author, Subject | DiemDesk',
  description:
    'Change a PDF’s title, author, subject and keywords — and fix files whose readers disagree. Free, and your file never leaves your browser.',
  alternates: { canonical: '/edit-pdf-metadata' },
  openGraph: {
    images: ['/og.png'],
    title: 'Edit PDF Metadata — Title, Author and Subject | DiemDesk',
    description: 'Set the title, author and subject on a PDF, privately in your browser.',
    type: 'website',
  },
};

const steps = [
  'Drop in the PDF. The form fills with whatever the file already says.',
  'Edit the title, author, subject, keywords or dates.',
  'Save. The new details are written everywhere the file records them.',
];

const faqs = [
  {
    q: 'Why does my PDF show the wrong title in the tab?',
    a: 'Because the title in the document information is not the filename. A file saved as contract-final.pdf can still announce itself as "Microsoft Word - Untitled1" — that string was written when the document was first created and it travels with the file. Set the Title field here and it stops.',
  },
  {
    q: 'I changed the author in another tool and it still shows the old one. Why?',
    a: 'Almost certainly because the file records the same facts twice. There is the old information block, and there is a newer XMP packet, and Acrobat believes the XMP one. Tools that write only the information block appear to work and change nothing a reader will show. We write both, and tell you when a file disagrees with itself.',
  },
  {
    q: 'Is this the same as removing metadata?',
    a: 'No. This sets what the fields say. Remove PDF metadata deletes them, along with hidden traces you cannot see here — the XMP history, page thumbnails and private application data. Clearing every box here blanks the visible fields; it is not a privacy wipe.',
  },
  {
    q: 'Can I set the same author across a stack of files?',
    a: 'Yes. Drop several PDFs and fill in only the fields you want to apply. Anything you leave empty is left as it is in each file, so you can stamp one author across a folder without flattening everything else.',
  },
  {
    q: 'Does editing the details change the pages?',
    a: 'No. Nothing on any page is touched, and no page is re-rendered or re-compressed. Only the record of what the document is changes.',
  },
  {
    q: 'Is my file uploaded?',
    a: 'No. The PDF is read and rewritten inside your browser and never reaches a server — which matters, because document properties are exactly where names, employers and internal filenames tend to sit.',
  },
];

export default function EditPdfMetadataPage() {
  return (
    <PdfToolPage
      title="Edit PDF details"
      description="Change what a PDF says it is — title, author, subject, keywords and dates — and fix the files that tell two different stories."
      steps={steps}
      faqs={faqs}
    >
      <DocInfoTool />
    </PdfToolPage>
  );
}
