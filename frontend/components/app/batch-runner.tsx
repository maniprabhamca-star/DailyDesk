'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, Loader2, Download, Check, Sparkles, Package, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlan, FREE_MAX_BATCH } from '@/lib/plan';
import { downloadBlob } from '@/lib/download';
import { trackProUse } from '@/lib/track-pro';

// Reusable ON-DEVICE BATCH runner — the flagship Pro differentiator. Give it a
// list of files and a per-file `process(file) -> {blob,name}` (a headless tool
// core) and it runs them one at a time in the browser (never uploaded), shows
// per-file progress + savings, and offers a single zip download. Free users get
// the Pro upsell (they process one file at a time in the tool itself); Pro/owner
// gets the full batch. Any tool with a clean core can adopt this.

type Res = { name: string; status: 'queued' | 'running' | 'done' | 'error'; blob?: Blob; before?: number; after?: number };

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function BatchRunner({ files, process, controls, actionLabel = 'Process all', zipName = 'diemdesk-batch.zip', fileIcon, onReset }: {
  files: File[];
  process: (file: File) => Promise<{ blob: Blob; name: string; before?: number; after?: number }>;
  controls?: ReactNode;
  actionLabel?: string;
  zipName?: string;
  /** Row icon (defaults to an image icon — PDF tools pass FileText). */
  fileIcon?: LucideIcon;
  onReset: () => void;
}) {
  const plan = usePlan();
  const RowIcon = fileIcon ?? ImageIcon;
  const isPro = plan === 'pro'; // owner cookie / localhost / Pro email resolve to 'pro'
  const gated = !isPro && files.length > FREE_MAX_BATCH;
  const [results, setResults] = useState<Res[]>(() => files.map((f) => ({ name: f.name, status: 'queued' as const })));
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);

  const doneCount = results.filter((r) => r.status === 'done').length;
  const finished = results.every((r) => r.status === 'done' || r.status === 'error');
  const allSettled = doneCount + results.filter((r) => r.status === 'error').length === files.length && (running === false) && doneCount > 0;

  async function runAll() {
    // A real on-device batch by a Pro subscriber = a Pro feature actually used.
    if (isPro && files.length > 1) trackProUse('batch');
    setRunning(true);
    for (let i = 0; i < files.length; i++) {
      setResults((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'running' } : r)));
      try {
        const out = await process(files[i]);
        setResults((rs) => rs.map((r, j) => (j === i ? { name: out.name, status: 'done', blob: out.blob, before: out.before, after: out.after } : r)));
      } catch {
        setResults((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'error' } : r)));
      }
    }
    setRunning(false);
  }

  async function downloadZip() {
    setZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = new Set<string>();
      for (const r of results) {
        if (r.status !== 'done' || !r.blob) continue;
        let n = r.name;
        if (used.has(n)) {
          const dot = n.lastIndexOf('.');
          let k = 2;
          const at = (i: number) => (dot > 0 ? `${n.slice(0, dot)}-${i}${n.slice(dot)}` : `${n}-${i}`);
          while (used.has(at(k))) k++;
          n = at(k);
        }
        used.add(n);
        zip.file(n, r.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, zipName);
    } finally {
      setZipping(false);
    }
  }

  if (gated) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.10] to-orange-500/[0.06] p-5 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"><Sparkles className="size-5" /></span>
        <p className="mt-3 text-sm font-semibold text-foreground">On-device batch is a Pro feature</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">You dropped <b className="text-foreground">{files.length} files</b>. Pro processes them all at once — <b className="text-foreground">privately, on your device</b>, nothing uploaded. On Free, add one file at a time.</p>
        <div className="mt-3.5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" className="border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md"><Link href="/pricing"><Sparkles className="size-3.5" /> Go Pro — batch all {files.length}</Link></Button>
          <Button size="sm" variant="outline" onClick={onReset}>Use one file</Button>
        </div>
      </div>
    );
  }

  const totalBefore = results.reduce((s, r) => s + (r.before || 0), 0);
  const totalAfter = results.reduce((s, r) => s + (r.after || 0), 0);
  const savedPct = totalBefore && allSettled ? Math.round(100 * (1 - totalAfter / totalBefore)) : 0;

  return (
    <div>
      {controls}
      <div className="mt-4 flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">{files.length} files
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">On-device</span>
          <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">Pro</span>
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{doneCount}/{files.length} done</span>
      </div>
      <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto rounded-xl border bg-card p-1.5 [scrollbar-width:thin]">
        {results.map((r, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <span className="flex size-5 shrink-0 items-center justify-center">
              {r.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" />
                : r.status === 'done' ? <Check className="size-4 text-emerald-500" />
                : r.status === 'error' ? <X className="size-4 text-destructive" />
                : <span className="size-2 rounded-full bg-muted-foreground/40" />}
            </span>
            <RowIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{r.name}</span>
            {r.status === 'done' && r.before != null && r.after != null && (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmt(r.before)} → <b className="text-emerald-600 dark:text-emerald-400">{fmt(r.after)}</b></span>
            )}
            {r.status === 'done' && r.blob && (
              <button onClick={() => downloadBlob(r.blob!, r.name)} className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={`Download ${r.name}`}><Download className="size-3.5" /></button>
            )}
            {r.status === 'error' && <span className="shrink-0 text-[11px] text-destructive">failed</span>}
          </li>
        ))}
      </ul>
      {allSettled && savedPct > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Saved <b className="text-emerald-600 dark:text-emerald-400">{savedPct}%</b> across {doneCount} files — {fmt(totalBefore)} → {fmt(totalAfter)}.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!finished ? (
          <Button className="min-w-[12rem] flex-1" size="lg" onClick={runAll} disabled={running}>
            {running ? <><Loader2 className="size-4 animate-spin" /> Processing {doneCount}/{files.length}…</> : <><Package className="size-4" /> {actionLabel} ({files.length})</>}
          </Button>
        ) : (
          <Button className="min-w-[12rem] flex-1" size="lg" onClick={downloadZip} disabled={zipping}>
            {zipping ? <><Loader2 className="size-4 animate-spin" /> Zipping…</> : <><Download className="size-4" /> Download all (.zip)</>}
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={onReset}>Clear</Button>
      </div>
    </div>
  );
}
