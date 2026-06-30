'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, Scissors, RotateCw, Combine, FileMinus, Shrink, Download, CheckCircle2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { KeepMoving, type MoveAction } from './keep-moving';
import { KeepGoing } from './keep-going';

// Shared "done" footer for any tool that outputs a single PDF: a success banner,
// a download-again button, the "Keep moving" chained actions (carry this PDF
// straight into the next tool, no re-upload) and the "Keep going" rail.
// One line to add to a tool: <PdfDone blob name currentHref fromLabel />.

type Target = { href: string; name: string; label: string; blurb: string; icon: LucideIcon };

const PDF_TARGETS: Target[] = [
  { href: '/compress-pdf', name: 'Compress PDF', label: 'Make it smaller', blurb: 'Shrink the file, keep text crisp', icon: Shrink },
  { href: '/pdf-to-jpg', name: 'PDF to JPG', label: 'Convert to images', blurb: 'Turn this PDF into crisp images', icon: ImageIcon },
  { href: '/split-pdf', name: 'Split PDF', label: 'Split pages', blurb: 'Pull out just the pages you need', icon: Scissors },
  { href: '/rotate-pdf', name: 'Rotate PDF', label: 'Rotate pages', blurb: 'Fix sideways or upside-down pages', icon: RotateCw },
  { href: '/delete-pages-from-pdf', name: 'Delete Pages', label: 'Remove pages', blurb: 'Drop the pages you don’t need', icon: FileMinus },
  { href: '/merge-pdf', name: 'Merge PDF', label: 'Merge with more', blurb: 'Combine it with other PDFs', icon: Combine },
];

export function PdfDone({ blob, name, currentHref, fromLabel, hideBanner = false }: { blob: Blob; name: string; currentHref: string; fromLabel: string; hideBanner?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Bring the result + "Keep moving" into view so small-screen users don't have
  // to scroll to find it. Skip when embedded (hideBanner) — the parent tool owns
  // the scroll/focus in that case (e.g. Compress shows its own result + button).
  useEffect(() => {
    if (!hideBanner) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hideBanner]);
  const actions: MoveAction[] = PDF_TARGETS.filter((t) => t.href !== currentHref)
    .slice(0, 2)
    .map((t) => ({
      count: 1,
      fromIcon: FileText,
      toIcon: t.icon,
      toName: t.name,
      label: t.label,
      blurb: t.blurb,
      onClick: () => {
        setHandoff({ files: [new File([blob], name, { type: 'application/pdf' })], from: fromLabel });
        router.push(t.href);
      },
    }));

  return (
    <div ref={ref} className="mt-5 scroll-mt-20">
      {!hideBanner && (
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Done — {name} saved to your device</span>
          <Button size="sm" variant="outline" onClick={() => download(blob, name)}><Download className="size-4" /> Download again</Button>
        </div>
      )}
      <KeepMoving actions={actions} />
      <KeepGoing exclude={currentHref} />
    </div>
  );
}
