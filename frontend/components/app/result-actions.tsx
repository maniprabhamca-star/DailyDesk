'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileOutput, Share2, Printer, FileImage, FileType, FileSpreadsheet, Presentation, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setHandoff } from '@/lib/handoff';
import { downloadBlob } from '@/lib/download';

// Result-screen actions (Export as / Share / Print), client-side only.
// - Export as → Image (JPG) hands the file straight to /pdf-to-jpg (no re-upload).
//   Office formats are server-side conversions, shown as "soon" until they ship.
// - Share uses the Web Share API when files are supported, else falls back to a
//   download (never a dead end).
// - Print loads the PDF in a hidden iframe and prints it (falls back to a new tab).

export function ResultActions({ blob, name }: { blob: Blob; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function exportImage() {
    setOpen(false);
    setHandoff({ files: [new File([blob], name, { type: 'application/pdf' })], from: 'your compressed PDF' });
    router.push('/pdf-to-jpg');
  }

  async function share() {
    const file = new File([blob], name, { type: 'application/pdf' });
    try {
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch { /* cancelled or unsupported — fall through */ }
    downloadBlob(blob, name); // fallback so the button is never a dead end
  }

  function print() {
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    iframe.src = url;
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      catch { window.open(url, '_blank'); }
    };
    document.body.appendChild(iframe);
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* gone */ } URL.revokeObjectURL(url); }, 60000);
  }

  const soon = [
    { name: 'Word (.docx)', icon: FileType },
    { name: 'Excel (.xlsx)', icon: FileSpreadsheet },
    { name: 'PowerPoint (.pptx)', icon: Presentation },
  ];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div ref={ref} className="relative">
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <FileOutput className="size-4" /> Export as <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border bg-popover p-1 shadow-lift">
            <button onClick={exportImage} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-300"><FileImage className="size-4" /></span>
              Image (JPG)
            </button>
            {soon.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.name} className="flex w-full cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="size-4" /></span>
                  {s.name}
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">soon</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={share}><Share2 className="size-4" /> Share</Button>
      <Button variant="outline" size="sm" onClick={print}><Printer className="size-4" /> Print</Button>
    </div>
  );
}
