'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setHandoff } from '@/lib/handoff';
import { downloadBlob as download } from '@/lib/download';
import { nextFor } from '@/lib/tool-graph';
import { KeepMoving, type MoveAction } from './keep-moving';
import { KeepGoing } from './keep-going';
import { ResultActions } from './result-actions';

// Shared "done" footer for any tool that outputs a single PDF: a success banner,
// a download-again button, the "Keep moving" chained actions (carry this PDF
// straight into the next tool, no re-upload) and the "Keep going" rail.
// One line to add to a tool: <PdfDone blob name currentHref fromLabel />.
// Suggestions come from lib/tool-graph so they're contextual to the current tool.

export function PdfDone({ blob, name, currentHref, fromLabel, hideBanner = false }: { blob: Blob; name: string; currentHref: string; fromLabel: string; hideBanner?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Bring the result + "Keep moving" into view so small-screen users don't have
  // to scroll to find it. Skip when embedded (hideBanner) — the parent tool owns
  // the scroll/focus in that case (e.g. Compress shows its own result + button).
  useEffect(() => {
    if (!hideBanner) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hideBanner]);

  // Carry this PDF straight into the two most relevant next tools that accept a
  // PDF — ordered per-tool by lib/tool-graph, no re-upload.
  const actions: MoveAction[] = nextFor(currentHref, 10)
    .filter((t) => t.acceptsPdf)
    .slice(0, 2)
    .map((t) => ({
      count: 1,
      fromIcon: FileText,
      toIcon: t.icon,
      toName: t.name,
      label: t.moveLabel,
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
      <ResultActions blob={blob} name={name} fromLabel={fromLabel} />
      <KeepMoving actions={actions} />
      <KeepGoing exclude={currentHref} />
    </div>
  );
}
