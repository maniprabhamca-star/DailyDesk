import type { Metadata } from 'next';
import { FolderOpen } from 'lucide-react';
import { SiteHeader } from '@/components/app/site-header';
import { SiteFooter } from '@/components/app/site-footer';
import { ToolGate } from '@/components/app/tool-gate';
import { FolderPreviewTool } from '@/components/tools/folder-preview-tool';

export const metadata: Metadata = {
  title: 'Preview Every File in a Folder — Free | DiemDesk',
  description:
    'Preview every file in a folder — PDFs, spreadsheets, markdown, code, fonts, SVGs. Runs in your browser; the folder is never uploaded.',
  alternates: { canonical: '/folder-preview' },
  robots: { index: false, follow: true },
  openGraph: {
    images: ['/og.png'],
    title: 'Preview every file in a folder',
    description: 'Windows thumbnails pictures and videos. This previews everything else too, without uploading a thing.',
    type: 'website',
  },
};

const FAQS = [
  {
    q: 'Is my folder uploaded?',
    a: 'No. The folder is read inside this browser tab and nothing is sent anywhere — open your Network tab while you use it and you will see zero uploads. It is also why this can exist at all: reading somebody’s whole folder is not a thing you would do with a site that takes copies.',
  },
  {
    q: 'Why does Windows only show thumbnails for photos?',
    a: 'Explorer ships thumbnail handlers for images and video and falls back to a generic icon for everything else. So a folder of forty PDFs, spreadsheets and markdown files is forty identical rectangles, and the only way to find one is to open them one at a time.',
  },
  {
    q: 'Can I delete files from here?',
    a: 'In Chrome and Edge, yes — and they move to a _trash folder inside the folder you picked rather than being destroyed, so getting one back is a drag in File Explorer. Other browsers do not offer the folder permission that requires, so the button is not shown there rather than failing when you press it.',
  },
  {
    q: 'What can’t it preview?',
    a: 'Photoshop, Illustrator, Word, Excel, PowerPoint and archives — each needs a parser or a rasteriser a browser does not have. Those files are still listed, with the reason, because hiding them would make your folder look emptier than it is.',
  },
  {
    q: 'How many files can it handle?',
    a: 'Free previews up to 30 files, which covers most real folders. Pro removes the cap. Either way it stops before it would try to render something like node_modules, and tells you it stopped.',
  },
];

export default function FolderPreviewPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <FolderOpen className="size-3.5" /> On your device
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Preview every file in a folder
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Your file explorer lists them; this shows you what is inside them. Windows draws a
            thumbnail for pictures and videos and gives everything else the same grey icon, so
            a folder of PDFs, spreadsheets, markdown and code is a wall of identical rectangles.
            Here each one previews itself, and you find what you want by looking rather than by
            opening forty files one at a time.
          </p>
        </div>

        <ToolGate>
          <FolderPreviewTool />
        </ToolGate>

        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight">Questions</h2>
          <dl className="mt-4 space-y-3">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-xl border p-4">
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
